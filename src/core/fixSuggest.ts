import path from 'node:path';
import fs from 'node:fs/promises';
import type { Issue, IssueLocation, FixSuggestion } from '../types.js';

/**
 * Rule-driven fix suggestion engine. projscan does not run an LLM; this
 * module ships templated guidance keyed by issue id. The driving agent (the
 * LLM) is expected to read the FixSuggestion and act on its `instruction`
 * field, optionally pulling more context via `projscan_explain_issue`.
 *
 * Template resolution: walk the registry in order, return the first match.
 * The fallback template (severity-anchored generic) catches everything that
 * doesn't have a hand-tuned template yet, so the tool is always useful.
 */

interface TemplateContext {
  rootPath: string;
}

interface Template {
  /** Match by issue id prefix or full id. */
  match: (issue: Issue) => boolean;
  render: (issue: Issue, ctx: TemplateContext) => Promise<FixSuggestion> | FixSuggestion;
}

const TEMPLATES: Template[] = [
  // ── Dependencies ──────────────────────────────────────────
  {
    match: (i) => i.id.startsWith('unused-dependency-'),
    render: (i) => ({
      issueId: i.id,
      severity: i.severity,
      category: i.category,
      headline: `Unused dependency: ${parseDepName(i.id)}`,
      why:
        'Declaring a package you never import bloats install size, slows CI, and confuses reviewers about what the project actually depends on. ' +
        'projscan flags it because no source file under this manifest imports the name.',
      where: i.locations ?? [],
      instruction:
        `Either (a) remove "${parseDepName(i.id)}" from the relevant package.json dependencies/devDependencies block, or ` +
        `(b) confirm it's used implicitly (e.g. plugin loaded by tooling, type-only import) and add it to .projscanrc \`disableRules: ["${i.id}"]\` ` +
        'so projscan stops flagging it. Run the test suite + a build after the change.',
      suggestedTest: 'After removal: `npm install && npm test && npm run build`. CI must pass on all three matrix entries.',
    }),
  },
  {
    match: (i) => i.id === 'dep-risk-no-lockfile',
    render: (i) => ({
      issueId: i.id,
      severity: i.severity,
      category: i.category,
      headline: 'No lockfile found',
      why:
        'Without a lockfile, every install resolves transitive deps fresh - which means CI and the contributor next door can each get different versions. ' +
        'Reproducible builds need a locked dependency tree.',
      where: [{ file: 'package.json' }],
      instruction:
        'Run `npm install` (or `pnpm install` / `yarn install` / `bun install` depending on what the team uses) at the repo root, then commit the resulting lockfile. ' +
        "Add it to .gitignore exceptions if your top-level .gitignore overshadows it. Don't hand-edit lockfiles.",
      suggestedTest: 'After committing the lockfile, run `npm ci` (which fails if the lockfile is out of sync) - it should succeed.',
    }),
  },
  {
    match: (i) => i.id === 'dep-risk-excessive-dependencies' || i.id === 'dep-risk-many-dependencies',
    render: (i) => ({
      issueId: i.id,
      severity: i.severity,
      category: i.category,
      headline: i.title,
      why:
        'High dependency counts compound supply-chain risk and slow installs. Beyond ~50 prod deps, projects rarely need every one - some are dead, some are duplicates, some have native replacements.',
      where: [{ file: 'package.json' }],
      instruction:
        'Run `projscan_dependencies` to see the full list, then `projscan_outdated` and `projscan_audit` for surface area. ' +
        'For each dep that looks suspicious, run `projscan_graph { direction: "package_importers", target: "<name>" }` to see what (if anything) actually uses it. ' +
        'Drop the ones with zero importers; consider native replacements for shimming-shaped deps (e.g. `lodash/get` → optional chaining).',
    }),
  },
  {
    match: (i) =>
      i.id.startsWith('dep-risk-') &&
      !['dep-risk-no-lockfile', 'dep-risk-excessive-dependencies', 'dep-risk-many-dependencies'].includes(i.id),
    render: (i) => {
      const name = i.id.slice('dep-risk-'.length);
      return {
        issueId: i.id,
        severity: i.severity,
        category: i.category,
        headline: i.title,
        why: i.description,
        where: i.locations ?? [{ file: 'package.json' }],
        instruction:
          `Audit "${name}": call \`projscan_graph { direction: "package_importers", target: "${name}" }\` to see who imports it. ` +
          `If it can be replaced with a lighter/native alternative, plan that migration; if it must stay, pin to an exact version (drop the \`^\` / \`>=\`) and document the choice.`,
      };
    },
  },
  {
    match: (i) => i.id.startsWith('audit-'),
    render: (i) => {
      const name = i.id.slice('audit-'.length);
      return {
        issueId: i.id,
        severity: i.severity,
        category: i.category,
        headline: i.title,
        why:
          'A vulnerability in a dep means whatever class of attack it enables (RCE, prototype pollution, ReDoS, etc.) is reachable through your dependency surface. ' +
          'Severity reflects the published advisory.',
        where: i.locations ?? [{ file: 'package.json' }],
        instruction:
          `Try \`npm audit fix\` first - it bumps to the nearest non-vulnerable version when one exists. If that fails: run \`projscan_upgrade { package: "${name}" }\` to preview the upgrade impact, ` +
          'then bump manually. If no patched version exists yet, consider replacing the dep or pinning to a specific transitive resolution via npm `overrides`.',
      };
    },
  },
  // ── Architecture ──────────────────────────────────────────
  {
    match: (i) => i.id.startsWith('cycle-detected-'),
    render: (i) => ({
      issueId: i.id,
      severity: i.severity,
      category: i.category,
      headline: 'Circular import',
      why:
        'Circular imports defeat module-init order, break tree-shaking, and produce undefined-at-import errors that only surface in some build configurations. ' +
        'They also make refactoring brittle: every file in the cycle has to change together.',
      where: i.locations ?? [],
      instruction:
        'Identify the leaf concept being passed around the cycle. The fix pattern is one of: ' +
        '(1) extract that concept into a NEW shared module that all participants import (interface, types, constants), ' +
        '(2) invert one of the dependencies via dependency injection (pass the value in, don\'t import it), or ' +
        '(3) merge two participants if they\'re semantically one unit. Run `projscan coupling --cycles-only` after the fix to confirm the cycle is gone.',
      suggestedTest: 'After: `projscan coupling --cycles-only` should not list these files.',
    }),
  },
  {
    match: (i) => i.id.startsWith('large-') && i.id.endsWith('-dir'),
    render: (i) => ({
      issueId: i.id,
      severity: i.severity,
      category: i.category,
      headline: i.title,
      why:
        'Catch-all directories (utils/helpers/lib/shared) are the project graveyard. Every file under one is implicitly "miscellaneous", which means changes touching it also rarely have a clear owner.',
      where: i.locations ?? [],
      instruction:
        'Group the files under the flagged directory by domain (e.g. `auth/`, `format/`, `validation/`) using `projscan_graph` to see which symbols are imported together. ' +
        'Move them into domain-named subdirectories. Update imports - your editor\'s rename-and-update should handle the bulk; finish with a `projscan analyze` to verify no leftover imports broke.',
    }),
  },
  {
    match: (i) => i.id === 'dead-code' || i.id.startsWith('dead-code-'),
    render: (i) => ({
      issueId: i.id,
      severity: i.severity,
      category: i.category,
      headline: 'Dead export (no importers)',
      why:
        "An export with zero importers either (a) was orphaned by a refactor and is genuinely dead, or (b) is part of the project's public API and projscan can't see who consumes it. " +
        'Either case deserves resolution: cleanup or an explicit "public" annotation.',
      where: i.locations ?? [],
      instruction:
        'For each flagged file: confirm with `projscan_graph { direction: "importers", target: "<file>" }`. ' +
        'If the result is genuinely empty AND this isn\'t package.json#main / #exports, delete the file (or just the unused exports). ' +
        'If it IS public surface (entry point, re-exported), add it to package.json#exports or list the file in .projscanrc `disableRules: ["dead-code"]`.',
    }),
  },
  // ── Test / lint / format presence ─────────────────────────
  {
    match: (i) => i.id === 'missing-test-framework' || i.id === 'missing-python-test-framework',
    render: (i) => ({
      issueId: i.id,
      severity: i.severity,
      category: i.category,
      headline: i.title,
      why:
        'No test runner means no regression coverage and no CI gate to defend against future regressions. The cost of getting one wired up early is small; the cost of retrofitting one onto a year of code is large.',
      where: [{ file: 'package.json' }],
      instruction:
        i.id.includes('python')
          ? 'Add pytest: `pip install -D pytest && python -m pytest --version`. Create a `tests/` directory with one trivial passing test (`def test_smoke(): assert True`). Add `[tool.pytest.ini_options]` to pyproject.toml or a `pytest.ini` so the runner knows where to look.'
          : 'Add vitest: `npm i -D vitest` then add `"test": "vitest run"` to package.json scripts. Create `src/__smoke__.test.ts` with one trivial passing test. Wire `npm test` into your CI workflow.',
      suggestedTest: 'After: `npm test` (or `pytest`) should exit 0 with at least the one smoke test passing.',
    }),
  },
  {
    match: (i) => i.id === 'no-test-files' || i.id === 'no-python-test-files',
    render: (i) => ({
      issueId: i.id,
      severity: i.severity,
      category: i.category,
      headline: i.title,
      why:
        'Test framework is configured but no test files exist. The runner is plumbed; the safety net isn\'t.',
      where: [],
      instruction:
        'Pick the most-changed file (run `projscan_hotspots`) and write the first test against it. Even one test transforms the project: it proves the runner works, exercises the import graph, and gives the next contributor a template. Aim for behavior tests, not 100% coverage.',
    }),
  },
  {
    match: (i) =>
      i.id === 'missing-linter' ||
      i.id === 'missing-python-linter' ||
      i.id === 'missing-formatter' ||
      i.id === 'missing-python-formatter',
    render: (i) => ({
      issueId: i.id,
      severity: i.severity,
      category: i.category,
      headline: i.title,
      why:
        "Style debates eat review time. A linter + formatter pair makes them moot - the tools own the rule, code review owns the design. Without them, you'll re-litigate the same questions every PR.",
      where: [{ file: 'package.json' }],
      instruction:
        i.id.includes('python')
          ? 'Add ruff: `pip install -D ruff` and create a `ruff.toml` (or `[tool.ruff]` in pyproject.toml) with `select = ["E", "F", "I"]`. Run `ruff check . --fix` once to bring the codebase to baseline.'
          : 'Add eslint + prettier: `npm i -D eslint prettier` (and the typescript-eslint preset if TS). Create `eslint.config.js` and `.prettierrc.json`. Run once with `--fix` to baseline; commit the result before further changes so the diff stays clean.',
      suggestedTest: 'After: `npm run lint` and `npm run format -- --check` should both pass.',
    }),
  },
  // ── Cross-package import policy (0.14.0) ─────────────────
  {
    match: (i) => i.id.startsWith('cross-package-violation-'),
    render: (i) => ({
      issueId: i.id,
      severity: i.severity,
      category: i.category,
      headline: i.title,
      why:
        'Cross-package imports that bypass a package\'s declared entry surface make refactoring inside that package impossible without breaking its consumers. The .projscanrc `monorepo.importPolicy` block flagged this specific edge.',
      where: i.locations ?? [],
      instruction:
        'Either (a) replace the deep import with the package\'s public entry (its `main` / `exports`), (b) export the desired symbol from that public entry if it\'s genuinely shared, or ' +
        '(c) widen the .projscanrc importPolicy `allow` list if this edge is intentional. Prefer (a) or (b) - the policy exists to keep refactoring options open.',
    }),
  },
];

const FALLBACK: Template = {
  match: () => true,
  render: (i) => ({
    issueId: i.id,
    severity: i.severity,
    category: i.category,
    headline: i.title,
    why: i.description,
    where: i.locations ?? [],
    instruction: severityInstruction(i),
  }),
};

function severityInstruction(i: Issue): string {
  switch (i.severity) {
    case 'error':
      return `Resolve ${i.title}: read the description, locate the file(s), and apply the fix the description suggests. After the change, run \`projscan_doctor\` and confirm this issue (id: ${i.id}) no longer appears.`;
    case 'warning':
      return `Address ${i.title} when convenient. The description explains the rationale; apply the fix at the location(s) listed. If the warning is a false positive in your context, add ${i.id} to .projscanrc \`disableRules\` with a brief comment.`;
    default:
      return `Informational: ${i.title}. No action strictly required - this signal is for awareness. If you want to silence it, add ${i.id} to .projscanrc \`disableRules\`.`;
  }
}

function parseDepName(issueId: string): string {
  // unused-dependency-foo or unused-dependency-packages/a-foo
  // The workspace-aware id has the form `unused-dependency-<workspace>-<name>`
  // but we can't disambiguate without parsing locations; the simple suffix
  // is right in the common case (single-package).
  const tail = issueId.replace(/^unused-dependency-/, '');
  return tail || '<unknown>';
}

/**
 * Pick a template for the issue. Always returns a suggestion - the fallback
 * catches anything without a tailored template. Async because some templates
 * reach into the file system or git for context (none today, but the surface
 * is async-ready).
 */
export async function suggestFixForIssue(
  issue: Issue,
  rootPath: string,
): Promise<FixSuggestion> {
  for (const tpl of TEMPLATES) {
    if (tpl.match(issue)) {
      return await Promise.resolve(tpl.render(issue, { rootPath }));
    }
  }
  return await Promise.resolve(FALLBACK.render(issue, { rootPath }));
}

/**
 * Synchronous one-line preview for inline use in projscan_doctor output.
 * Returns the headline a template would render. We can't run the full
 * template synchronously (some are async-shaped); the headline is a
 * lightweight projection that doesn't need IO.
 */
export function previewSuggestionForIssue(issue: Issue): { summary: string } | null {
  const headline = staticHeadlineFor(issue);
  if (!headline) return null;
  return { summary: headline };
}

function staticHeadlineFor(issue: Issue): string | null {
  if (issue.id.startsWith('unused-dependency-')) return `Remove or wire up "${parseDepName(issue.id)}".`;
  if (issue.id === 'dep-risk-no-lockfile') return 'Run `npm install` and commit the lockfile.';
  if (issue.id.startsWith('dep-risk-')) return `Audit "${issue.id.slice('dep-risk-'.length)}" or pin to an exact version.`;
  if (issue.id.startsWith('audit-')) return 'Try `npm audit fix`, then upgrade or pin manually.';
  if (issue.id.startsWith('cycle-detected-')) return 'Break the cycle by extracting a shared module.';
  if (issue.id.startsWith('large-') && issue.id.endsWith('-dir')) return 'Split the directory by domain.';
  if (issue.id === 'dead-code' || issue.id.startsWith('dead-code-')) return 'Confirm with `projscan_graph importers` then delete or expose.';
  if (issue.id === 'missing-test-framework' || issue.id === 'missing-python-test-framework')
    return issue.id.includes('python') ? 'Install pytest + write one smoke test.' : 'Install vitest + write one smoke test.';
  if (issue.id === 'no-test-files' || issue.id === 'no-python-test-files') return 'Write the first test against your top hotspot.';
  if (
    issue.id === 'missing-linter' ||
    issue.id === 'missing-python-linter' ||
    issue.id === 'missing-formatter' ||
    issue.id === 'missing-python-formatter'
  )
    return issue.id.includes('python') ? 'Add ruff and run `ruff check . --fix` once.' : 'Add eslint + prettier; baseline with `--fix`.';
  if (issue.id.startsWith('cross-package-violation-')) return 'Use the package\'s public entry, or widen the importPolicy.';
  return null;
}

/**
 * Locate an issue in a doctor result by id. The MCP tool calls this to
 * resolve a fix-suggest request; the issue payload comes from
 * `collectIssues` in the same flow.
 */
export function findIssue(issues: Issue[], issueId: string): Issue | null {
  return issues.find((i) => i.id === issueId) ?? null;
}

/**
 * Construct a synthetic Issue when the caller passes file + rule instead of
 * a known id. Useful when an agent wants guidance for a class of issue
 * without first running doctor. The synthetic issue mimics the schema
 * collectIssues would produce, so the same template registry handles it.
 */
export function syntheticIssue(rule: string, file: string, severity: 'info' | 'warning' | 'error' = 'warning'): Issue {
  return {
    id: rule,
    title: rule,
    description: `Synthetic issue for rule "${rule}" on file "${file}".`,
    severity,
    category: rule.split('-')[0] ?? 'unknown',
    fixAvailable: false,
    locations: file ? [{ file }] : undefined,
  };
}

/**
 * Read a small excerpt of a file around a 1-based line number. Used by
 * projscan_explain_issue for the "show me the surrounding code" panel.
 * Returns null on any IO failure so callers can render gracefully.
 */
export async function readExcerpt(
  rootPath: string,
  loc: IssueLocation,
  context: number = 3,
): Promise<{ file: string; startLine: number; endLine: number; lines: string[] } | null> {
  if (!loc.file) return null;
  const abs = path.isAbsolute(loc.file) ? loc.file : path.join(rootPath, loc.file);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch {
    return null;
  }
  const all = raw.split('\n');
  const center = loc.line ?? 1;
  const start = Math.max(1, center - context);
  const end = Math.min(all.length, (loc.endLine ?? center) + context);
  return {
    file: loc.file,
    startLine: start,
    endLine: end,
    lines: all.slice(start - 1, end),
  };
}
