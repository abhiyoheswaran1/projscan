import type { ReviewReport } from '../types.js';

/**
 * 1.9+ — Intent-grounded review.
 *
 * An agent (or human) calling `projscan_review` may pass a short
 * natural-language description of what the PR is *trying* to do
 * ("refactor auth middleware", "add caching to /users endpoint",
 * "docs: fix codex setup snippet"). projscan parses the intent into
 *
 *   - an action type (feature / fix / refactor / perf / test / docs /
 *     chore / remove / unknown), and
 *   - a list of "scope tokens" (file-paths, package names,
 *     identifiers extracted from the prose),
 *
 * and then classifies each finding in the review report as one of
 *
 *   - "expected"     — the finding type is typical for this action
 *                      AND the finding's location overlaps the
 *                      stated scope. The reviewer should expect to
 *                      see it.
 *   - "unexpected"   — the finding type is NOT typical for this
 *                      action, but the location IS in scope. The
 *                      PR claims to do X but actually also does Y
 *                      in the area it's touching. Worth a look.
 *   - "out-of-scope" — the finding is outside the stated scope.
 *                      Either the intent description missed naming
 *                      the area, or the PR has side-effects beyond
 *                      what was advertised.
 *   - "unknown"      — no intent given, or the parser couldn't
 *                      derive an action.
 *
 * Crucially: intent does NOT change the verdict. The verdict stays
 * structural — risk score, new cycles, new taint flows. Intent only
 * adds a layer on top so the agent narrating the review can say
 * "here's what you intended, here's what you got, here's what was
 * unexpected." The advisor stays honest; intent just gives the
 * agent better adjectives.
 *
 * No LLM. Rule-driven keyword tables + heuristic token extraction.
 * The non-goal of "no inference inside projscan" applies here too.
 */

export type IntentAction =
  | 'feature'
  | 'fix'
  | 'refactor'
  | 'perf'
  | 'test'
  | 'docs'
  | 'chore'
  | 'remove'
  | 'unknown';

export type IntentAlignment = 'expected' | 'unexpected' | 'out-of-scope' | 'unknown';

export interface ParsedIntent {
  /** Echo of the input string, trimmed. */
  raw: string;
  /** Highest-scoring action from the keyword table, or 'unknown'. */
  action: IntentAction;
  /**
   * Scope tokens extracted from the prose: identifiers, file paths,
   * path-like fragments. Used to match against finding locations.
   * Sorted, deduplicated, lowercased.
   */
  scopeTokens: string[];
}

export interface IntentNotable {
  kind: 'file' | 'function' | 'cycle' | 'taint' | 'dependency';
  label: string;
  alignment: IntentAlignment;
  reason: string;
}

export interface IntentAnalysis {
  intent: ParsedIntent;
  totals: Record<IntentAlignment, number>;
  /**
   * Up to 5 findings worth surfacing in the summary — biased toward
   * "unexpected" (the most useful signal to the reviewer), then
   * "out-of-scope" if the unexpected list is short.
   */
  notable: IntentNotable[];
}

type FindingKind =
  | 'file-added'
  | 'file-modified'
  | 'file-removed'
  | 'function-added'
  | 'function-jumped'
  | 'function-crossed-threshold'
  | 'cycle-new'
  | 'cycle-expanded'
  | 'taint-flow'
  | 'dep-added'
  | 'dep-removed'
  | 'dep-bumped';

// ── parsing ──────────────────────────────────────────────────────────

/**
 * Action keyword table. Ordered loosely from most-specific to most-
 * generic. Each list contains lowercase prefix tokens; matching is
 * whole-word case-insensitive against the intent prose. `parseIntent`
 * scores each action by counted keyword hits and returns the highest
 * — ties resolved by the iteration order of the table.
 */
const ACTION_KEYWORDS: Record<Exclude<IntentAction, 'unknown'>, string[]> = {
  test: ['test', 'tests', 'testing', 'spec', 'specs', 'unit', 'integration', 'coverage'],
  docs: ['doc', 'docs', 'documentation', 'readme', 'comment', 'comments', 'changelog', 'guide'],
  chore: ['bump', 'upgrade', 'deps', 'dependencies', 'lint', 'format', 'pin', 'lock', 'chore'],
  remove: ['remove', 'delete', 'deprecate', 'drop', 'retire', 'unused'],
  perf: ['optimize', 'optimise', 'perf', 'performance', 'faster', 'speed', 'cache', 'memoize', 'parallelize'],
  fix: ['fix', 'bug', 'bugfix', 'resolve', 'patch', 'repair', 'correct', 'address', 'hotfix'],
  refactor: ['refactor', 'rename', 'extract', 'restructure', 'rewrite', 'consolidate', 'tidy', 'cleanup'],
  feature: ['add', 'adding', 'implement', 'introduce', 'support', 'enable', 'create', 'feature'],
};

/**
 * Tokens NEVER counted as scope. English stopwords, common PR-prose
 * filler, and the action keywords themselves (they belong to the
 * action classifier, not the scope).
 */
const STOPWORDS = new Set<string>([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'when', 'where', 'what',
  'which', 'their', 'them', 'they', 'have', 'has', 'are', 'was', 'were', 'will',
  'should', 'would', 'could', 'can', 'not', 'but', 'all', 'any', 'some', 'one',
  'two', 'three', 'first', 'last', 'before', 'after', 'while', 'over', 'under',
  'between', 'against', 'across', 'during', 'because', 'about', 'also', 'just',
  'only', 'than', 'then', 'these', 'those', 'how', 'why', 'who', 'whom',
  // common PR-prose
  'pr', 'mr', 'feature', 'feat', 'request', 'requested', 'merge', 'pull',
  'review', 'reviewed', 'change', 'changes', 'changed', 'changing', 'update',
  'updates', 'updated', 'updating', 'work', 'working', 'wip',
  'project', 'projscan', 'code', 'codebase', 'repository', 'repo', 'branch',
  // 1.9+ — very generic path-component tokens that match nearly every
  // file. Including these as scope would make almost any change look
  // "in scope," defeating the purpose. The path-boundary regex below
  // already narrows the match shape; this set narrows the token set.
  'src', 'lib', 'dist', 'build', 'test', 'tests', 'spec', 'specs',
  'app', 'apps', 'pkg', 'pkgs', 'package', 'packages', 'main', 'index',
]);

/**
 * 1.9+ — Maximum intent string length. Caps the input to a sane bound
 * before any regex / tokenization work runs. Without this, a 10MB
 * intent argument would force the action-keyword scoring loop into
 * ~50 regex scans across the full payload (catastrophic backtracking
 * risk with repeated keywords). Agents passing real PR descriptions
 * stay well under this cap; anything bigger is almost certainly a
 * mistake or an attack on resources.
 */
const MAX_INTENT_LENGTH = 8192;

function isActionKeyword(token: string): boolean {
  for (const list of Object.values(ACTION_KEYWORDS)) {
    if (list.includes(token)) return true;
  }
  return false;
}

/**
 * Parse a free-text intent string. Returns null when the input is
 * empty / whitespace-only. Returns an intent with `action: 'unknown'`
 * when no action keyword matched — callers should treat that as
 * "scope known, action unclassified" and downgrade alignment labels
 * to 'unknown'.
 */
export function parseIntent(raw: string | undefined | null): ParsedIntent | null {
  if (typeof raw !== 'string') return null;
  // Cap length before any regex work — protects against a pathological
  // mega-string forcing 50+ regex passes over megabytes of input.
  // Slicing in the middle of a word is fine; the action-keyword
  // scoring is robust to truncated keywords (the keyword just won't
  // match), and a real PR description fits comfortably under 8K chars.
  const truncated = raw.length > MAX_INTENT_LENGTH ? raw.slice(0, MAX_INTENT_LENGTH) : raw;
  const trimmed = truncated.trim();
  if (trimmed.length === 0) return null;
  const lower = trimmed.toLowerCase();

  // Score actions by counted keyword hits. Use word-boundary matching
  // so "tested" doesn't trip "test", but treat hyphens / underscores
  // as boundaries since PR prose often runs them together
  // ("feat-add-caching", "refactor_auth").
  let bestAction: IntentAction = 'unknown';
  let bestScore = 0;
  for (const [action, keywords] of Object.entries(ACTION_KEYWORDS) as Array<
    [Exclude<IntentAction, 'unknown'>, string[]]
  >) {
    let score = 0;
    for (const kw of keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Word-ish boundary: anything that isn't an ASCII letter/digit.
      const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'g');
      const matches = lower.match(re);
      if (matches) score += matches.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }

  // Extract scope tokens. Tokenize on whitespace and most punctuation;
  // keep _, -, ., /, : as identifier-like joiners.
  const tokens = new Set<string>();
  const rawTokens = lower.split(/[^a-z0-9_\-./:]+/).filter(Boolean);
  for (const tok of rawTokens) {
    if (tok.length < 3) continue;
    if (STOPWORDS.has(tok)) continue;
    if (isActionKeyword(tok)) continue;
    // Skip pure numerics ("1", "20", "v2") — too generic to scope by.
    if (/^[0-9]+$/.test(tok)) continue;
    tokens.add(tok);
    // Also add path / dot components individually: "src/auth/index.ts"
    // contributes "src", "auth", "index.ts", and "index".
    for (const part of tok.split(/[./]/).filter(Boolean)) {
      if (part.length < 3) continue;
      if (STOPWORDS.has(part)) continue;
      if (isActionKeyword(part)) continue;
      tokens.add(part);
    }
  }

  return {
    raw: trimmed,
    action: bestAction,
    scopeTokens: [...tokens].sort(),
  };
}

// ── alignment classification ─────────────────────────────────────────

/**
 * Per-action expectation table. Maps `(action, findingKind)` to true
 * when the finding kind is *typical* for that action — that is, the
 * reviewer should not be surprised to see it.
 *
 * The table is intentionally generous: when in doubt, treat a finding
 * as "expected for the action" so we don't flag honest PRs as
 * unexpected. The signal value comes from the cases where there's a
 * clear semantic mismatch (test PR touches non-test code, docs PR
 * adds high-CC functions, etc.).
 */
const EXPECTATIONS: Record<IntentAction, Set<FindingKind>> = {
  feature: new Set<FindingKind>([
    'file-added',
    'file-modified',
    'function-added',
    'dep-added',
    'dep-bumped',
  ]),
  fix: new Set<FindingKind>([
    'file-modified',
    'function-jumped',
    'function-crossed-threshold',
  ]),
  refactor: new Set<FindingKind>([
    'file-added',
    'file-modified',
    'file-removed',
    'function-added',
    'function-jumped',
    'function-crossed-threshold',
    'cycle-new',
    'cycle-expanded',
  ]),
  perf: new Set<FindingKind>([
    'file-modified',
    'function-added',
    'function-jumped',
    'function-crossed-threshold',
  ]),
  test: new Set<FindingKind>([
    'file-added',
    'file-modified',
    'file-removed',
  ]),
  docs: new Set<FindingKind>([
    'file-added',
    'file-modified',
    'file-removed',
  ]),
  chore: new Set<FindingKind>([
    'dep-added',
    'dep-removed',
    'dep-bumped',
    'file-modified',
  ]),
  remove: new Set<FindingKind>([
    'file-removed',
    'dep-removed',
  ]),
  unknown: new Set<FindingKind>(),
};

/**
 * Test / docs PRs have an extra constraint: the file path itself must
 * "look like" a test or docs file for the finding to count as
 * expected. Otherwise we'd treat any modified file in a "test:" PR as
 * expected — which defeats the entire purpose of intent grounding.
 */
function isTestPath(p: string): boolean {
  const lower = p.toLowerCase();
  return /(^|\/)(tests?|__tests__|spec|specs)(\/|$)/.test(lower) ||
    /\.(test|spec)\.[a-z0-9]+$/.test(lower);
}

function isDocsPath(p: string): boolean {
  const lower = p.toLowerCase();
  return /(^|\/)docs?(\/|$)/.test(lower) ||
    /\.(md|mdx|rst|txt|adoc)$/.test(lower) ||
    lower.endsWith('readme') ||
    lower.endsWith('changelog');
}

/**
 * 1.9+ — Match a token against a path at component boundaries. A
 * naive `includes` was too generous: token "src" would match
 * "src/anything", token "api" would match "rapid_test.js", silently
 * declaring nearly every finding in-scope.
 *
 * Boundary semantics: the token matches when surrounded by path
 * separators (`/`, `.`, `-`, `_`, `:`) or by the start/end of the
 * string. So "auth" matches "src/auth/index.ts" and "use_auth_hook"
 * (`_` boundary on each side), but NOT "authority/database.ts" or
 * "useauthhook" (no boundaries).
 */
function tokenMatchesAtBoundary(token: string, target: string): boolean {
  const lowerTarget = target.toLowerCase();
  const idx = lowerTarget.indexOf(token);
  if (idx === -1) return false;
  // Scan all occurrences — the first hit might be inside a larger
  // word, but a later occurrence could land at a boundary.
  let pos = idx;
  while (pos !== -1) {
    const before = pos === 0 ? '/' : lowerTarget[pos - 1];
    const afterIdx = pos + token.length;
    const after = afterIdx >= lowerTarget.length ? '/' : lowerTarget[afterIdx];
    if (isBoundaryChar(before) && isBoundaryChar(after)) return true;
    pos = lowerTarget.indexOf(token, pos + 1);
  }
  return false;
}

function isBoundaryChar(ch: string): boolean {
  return ch === '/' || ch === '.' || ch === '-' || ch === '_' || ch === ':' || ch === '\\';
}

function pathMatchesScope(scopeTokens: string[], path: string): boolean {
  if (scopeTokens.length === 0) return true; // no scope → everything in
  for (const tok of scopeTokens) {
    if (tokenMatchesAtBoundary(tok, path)) return true;
  }
  return false;
}

function symbolMatchesScope(scopeTokens: string[], symbol: string): boolean {
  if (scopeTokens.length === 0) return true;
  for (const tok of scopeTokens) {
    if (tokenMatchesAtBoundary(tok, symbol)) return true;
  }
  return false;
}

function classify(
  intent: ParsedIntent,
  kind: FindingKind,
  inScope: boolean,
  pathHint?: string,
): IntentAlignment {
  if (intent.action === 'unknown') return 'unknown';
  // Type-rooted intents (docs / test): the action implies a path type.
  // If the file's path matches that type, treat it as in-scope even
  // without an explicit scope-token hit — "docs PR" + README.md is
  // intrinsically in scope, the agent shouldn't have to name every
  // file. Scope tokens still narrow when present; this just lifts
  // type-matching paths out of the "out-of-scope" bucket.
  let effectiveInScope = inScope;
  if (!effectiveInScope && pathHint) {
    if (intent.action === 'docs' && isDocsPath(pathHint)) effectiveInScope = true;
    if (intent.action === 'test' && isTestPath(pathHint)) effectiveInScope = true;
  }
  // Extra constraint for test / docs intents: the *path* must also
  // match the action's path expectation for the kind to count as
  // expected.
  let expected = EXPECTATIONS[intent.action].has(kind);
  if (expected && pathHint) {
    if (intent.action === 'test' && !isTestPath(pathHint)) expected = false;
    if (intent.action === 'docs' && !isDocsPath(pathHint)) expected = false;
  }
  if (expected && effectiveInScope) return 'expected';
  if (expected && !effectiveInScope) return 'out-of-scope';
  if (effectiveInScope) return 'unexpected';
  return 'out-of-scope';
}

// ── annotation ───────────────────────────────────────────────────────

/**
 * Annotate a review report's findings in place with `intentAlignment`
 * and return the aggregate IntentAnalysis. Mutates the input report
 * (computeReview is already building it; cheaper than a deep clone).
 *
 * Callers passing in a `null` intent get a no-op analysis with
 * everything labelled 'unknown'.
 */
export function annotateReviewWithIntent(
  report: ReviewReport,
  intent: ParsedIntent,
): IntentAnalysis {
  const totals: Record<IntentAlignment, number> = {
    expected: 0,
    unexpected: 0,
    'out-of-scope': 0,
    unknown: 0,
  };
  const notable: IntentNotable[] = [];

  for (const f of report.changedFiles) {
    const kind: FindingKind =
      f.status === 'added' ? 'file-added' : f.status === 'removed' ? 'file-removed' : 'file-modified';
    const inScope = pathMatchesScope(intent.scopeTokens, f.relativePath);
    const alignment = classify(intent, kind, inScope, f.relativePath);
    f.intentAlignment = alignment;
    totals[alignment] += 1;
    if (alignment === 'unexpected' || alignment === 'out-of-scope') {
      notable.push({
        kind: 'file',
        label: `${f.status} ${f.relativePath}`,
        alignment,
        reason: reasonFor(intent.action, kind, inScope, f.relativePath),
      });
    }
  }

  for (const fn of report.riskyFunctions) {
    const kind: FindingKind =
      fn.reason === 'added'
        ? 'function-added'
        : fn.reason === 'jumped'
          ? 'function-jumped'
          : 'function-crossed-threshold';
    const inScope =
      pathMatchesScope(intent.scopeTokens, fn.file) || symbolMatchesScope(intent.scopeTokens, fn.name);
    const alignment = classify(intent, kind, inScope, fn.file);
    fn.intentAlignment = alignment;
    totals[alignment] += 1;
    if (alignment === 'unexpected' || alignment === 'out-of-scope') {
      notable.push({
        kind: 'function',
        label: `${fn.file}:${fn.line} ${fn.name} (CC ${fn.cyclomaticComplexity})`,
        alignment,
        reason: reasonFor(intent.action, kind, inScope, fn.file),
      });
    }
  }

  for (const c of report.newCycles) {
    const kind: FindingKind = c.classification === 'new' ? 'cycle-new' : 'cycle-expanded';
    // A cycle "matches" scope when ANY of its files does.
    const inScope = c.files.some((f) => pathMatchesScope(intent.scopeTokens, f));
    const alignment = classify(intent, kind, inScope);
    c.intentAlignment = alignment;
    totals[alignment] += 1;
    if (alignment === 'unexpected' || alignment === 'out-of-scope') {
      notable.push({
        kind: 'cycle',
        label: `${c.classification} cycle (${c.size} files): ${c.files.slice(0, 3).join(', ')}${c.files.length > 3 ? '…' : ''}`,
        alignment,
        reason: reasonFor(intent.action, kind, inScope),
      });
    }
  }

  for (const t of report.newTaintFlows) {
    const inScope = t.files.some((f) => pathMatchesScope(intent.scopeTokens, f));
    const alignment = classify(intent, 'taint-flow', inScope);
    t.intentAlignment = alignment;
    totals[alignment] += 1;
    if (alignment === 'unexpected' || alignment === 'out-of-scope') {
      notable.push({
        kind: 'taint',
        label: `${t.source} → ${t.sink} (${t.sourceFn} → ${t.sinkFn})`,
        alignment,
        reason: reasonFor(intent.action, 'taint-flow', inScope),
      });
    }
  }

  for (const dep of report.dependencyChanges) {
    // For dependency changes, "in scope" means the manifest path
    // matches the scope tokens, or the package name does. We use the
    // most-impactful sub-kind (added > removed > bumped).
    const subKind: FindingKind =
      dep.added.length > 0 ? 'dep-added' : dep.removed.length > 0 ? 'dep-removed' : 'dep-bumped';
    const allDepNames = [
      ...dep.added.map((a) => a.name),
      ...dep.removed.map((r) => r.name),
      ...dep.bumped.map((b) => b.name),
    ];
    const inScope =
      pathMatchesScope(intent.scopeTokens, dep.manifestFile) ||
      allDepNames.some((n) => symbolMatchesScope(intent.scopeTokens, n));
    const alignment = classify(intent, subKind, inScope);
    dep.intentAlignment = alignment;
    totals[alignment] += 1;
    if (alignment === 'unexpected' || alignment === 'out-of-scope') {
      notable.push({
        kind: 'dependency',
        label: `${dep.manifestFile}: +${dep.added.length} -${dep.removed.length} ~${dep.bumped.length}`,
        alignment,
        reason: reasonFor(intent.action, subKind, inScope),
      });
    }
  }

  // Notable: bias toward unexpected, then out-of-scope. Cap to 5.
  notable.sort((a, b) => {
    const rank: Record<IntentAlignment, number> = {
      unexpected: 0,
      'out-of-scope': 1,
      expected: 2,
      unknown: 3,
    };
    return rank[a.alignment] - rank[b.alignment];
  });
  const trimmed = notable.slice(0, 5);

  return { intent, totals, notable: trimmed };
}

function reasonFor(
  action: IntentAction,
  kind: FindingKind,
  inScope: boolean,
  pathHint?: string,
): string {
  if (!inScope) {
    return `outside the area implied by the intent`;
  }
  if (action === 'test' && pathHint && !isTestPath(pathHint)) {
    return `intent is a test change but this touches non-test code`;
  }
  if (action === 'docs' && pathHint && !isDocsPath(pathHint)) {
    return `intent is a docs change but this touches code`;
  }
  switch (kind) {
    case 'cycle-new':
    case 'cycle-expanded':
      if (action === 'fix' || action === 'docs' || action === 'test' || action === 'chore' || action === 'perf') {
        return `intent is "${action}" but a new import cycle was introduced`;
      }
      return '';
    case 'dep-added':
      if (action === 'fix' || action === 'docs' || action === 'test' || action === 'perf') {
        return `intent is "${action}" but a new dependency was added`;
      }
      return '';
    case 'taint-flow':
      return `intent is "${action}" but a new source-to-sink taint flow was introduced`;
    case 'function-added':
      if (action === 'docs' || action === 'fix') {
        return `intent is "${action}" but a high-complexity function was added`;
      }
      return '';
    default:
      return '';
  }
}

/**
 * Append intent-related bullets to a review's `summary` array. Called
 * from computeReview after annotation. Keeps the summary readable —
 * one bullet per high-signal observation.
 */
export function appendIntentToSummary(
  summary: string[],
  analysis: IntentAnalysis,
): void {
  const { intent, totals, notable } = analysis;
  if (intent.action === 'unknown' && intent.scopeTokens.length === 0) return;
  const head =
    intent.action !== 'unknown'
      ? `Intent: "${intent.action}"${intent.scopeTokens.length > 0 ? ` (scope: ${intent.scopeTokens.slice(0, 4).join(', ')}${intent.scopeTokens.length > 4 ? '…' : ''})` : ''}.`
      : `Intent scope: ${intent.scopeTokens.slice(0, 4).join(', ')}${intent.scopeTokens.length > 4 ? '…' : ''}.`;
  summary.push(head);
  if (totals.unexpected > 0) {
    const sample = notable.find((n) => n.alignment === 'unexpected');
    summary.push(
      `${totals.unexpected} finding(s) unexpected for this intent${sample ? ` — e.g. ${sample.label}` : ''}.`,
    );
  }
  if (totals['out-of-scope'] > 0) {
    summary.push(`${totals['out-of-scope']} finding(s) outside the stated scope.`);
  }
}
