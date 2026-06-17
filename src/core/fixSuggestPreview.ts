import type { Issue } from '../types.js';
import { parseDepName } from './fixSuggestDependencyNames.js';

type PreviewRule = {
  matches: (issue: Issue) => boolean;
  headline: (issue: Issue) => string;
};

const TEST_FRAMEWORK_ISSUES = new Set(['missing-test-framework', 'missing-python-test-framework']);
const FIRST_TEST_ISSUES = new Set(['no-test-files', 'no-python-test-files']);
const TOOLING_SETUP_ISSUES = new Set([
  'missing-linter',
  'missing-python-linter',
  'missing-formatter',
  'missing-python-formatter',
]);

const PREVIEW_RULES: PreviewRule[] = [
  {
    matches: (issue) => issue.id.startsWith('unused-dependency-'),
    headline: (issue) => `Remove or wire up "${parseDepName(issue.id)}".`,
  },
  {
    matches: (issue) => issue.id === 'dep-risk-no-lockfile',
    headline: () => 'Run `npm install` and commit the lockfile.',
  },
  {
    matches: (issue) => issue.id.startsWith('dep-risk-'),
    headline: (issue) =>
      `Audit "${issue.id.slice('dep-risk-'.length)}" or pin to an exact version.`,
  },
  {
    matches: (issue) => issue.id.startsWith('audit-'),
    headline: () => 'Try `npm audit fix`, then upgrade or pin manually.',
  },
  {
    matches: (issue) => issue.id.startsWith('cycle-detected-'),
    headline: () => 'Break the cycle by extracting a shared module.',
  },
  {
    matches: (issue) => issue.id.startsWith('large-') && issue.id.endsWith('-dir'),
    headline: () => 'Split the directory by domain.',
  },
  {
    matches: (issue) => issue.id === 'dead-code' || issue.id.startsWith('dead-code-'),
    headline: () =>
      'Confirm with `projscan_semantic_graph { query: { direction: "importers", file: "<file>" } }` then delete or expose.',
  },
  {
    matches: (issue) => TEST_FRAMEWORK_ISSUES.has(issue.id),
    headline: (issue) =>
      issue.id.includes('python')
        ? 'Install pytest + write one smoke test.'
        : 'Install vitest + write one smoke test.',
  },
  {
    matches: (issue) => FIRST_TEST_ISSUES.has(issue.id),
    headline: () => 'Write the first test against your top hotspot.',
  },
  {
    matches: (issue) => TOOLING_SETUP_ISSUES.has(issue.id),
    headline: (issue) =>
      issue.id.includes('python')
        ? 'Add ruff and run `ruff check . --fix` once.'
        : 'Add eslint + prettier; baseline with `--fix`.',
  },
  {
    matches: (issue) => issue.id.startsWith('cross-package-violation-'),
    headline: () => "Use the package's public entry, or widen the importPolicy.",
  },
  {
    matches: (issue) => issue.id.startsWith('eslint-'),
    headline: (issue) => {
      const ruleName = issue.id.slice('eslint-'.length);
      return `Fix per docs, or scope a disable to the line with a reason: \`${ruleName}\`.`;
    },
  },
  {
    matches: (issue) => issue.id.startsWith('python-type-error-'),
    headline: () =>
      'Refine the annotation, narrow at the call site, or pin a `# type: ignore[code]`.',
  },
];

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
  const rule = PREVIEW_RULES.find((candidate) => candidate.matches(issue));
  return rule?.headline(issue) ?? null;
}
