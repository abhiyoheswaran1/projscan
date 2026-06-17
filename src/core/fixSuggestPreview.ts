import type { Issue } from '../types.js';
import { parseDepName } from './fixSuggestDependencyNames.js';

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
  if (issue.id.startsWith('unused-dependency-'))
    return `Remove or wire up "${parseDepName(issue.id)}".`;
  if (issue.id === 'dep-risk-no-lockfile') return 'Run `npm install` and commit the lockfile.';
  if (issue.id.startsWith('dep-risk-'))
    return `Audit "${issue.id.slice('dep-risk-'.length)}" or pin to an exact version.`;
  if (issue.id.startsWith('audit-')) return 'Try `npm audit fix`, then upgrade or pin manually.';
  if (issue.id.startsWith('cycle-detected-'))
    return 'Break the cycle by extracting a shared module.';
  if (issue.id.startsWith('large-') && issue.id.endsWith('-dir'))
    return 'Split the directory by domain.';
  if (issue.id === 'dead-code' || issue.id.startsWith('dead-code-'))
    return 'Confirm with `projscan_semantic_graph { query: { direction: "importers", file: "<file>" } }` then delete or expose.';
  if (issue.id === 'missing-test-framework' || issue.id === 'missing-python-test-framework')
    return issue.id.includes('python')
      ? 'Install pytest + write one smoke test.'
      : 'Install vitest + write one smoke test.';
  if (issue.id === 'no-test-files' || issue.id === 'no-python-test-files')
    return 'Write the first test against your top hotspot.';
  if (
    issue.id === 'missing-linter' ||
    issue.id === 'missing-python-linter' ||
    issue.id === 'missing-formatter' ||
    issue.id === 'missing-python-formatter'
  )
    return issue.id.includes('python')
      ? 'Add ruff and run `ruff check . --fix` once.'
      : 'Add eslint + prettier; baseline with `--fix`.';
  if (issue.id.startsWith('cross-package-violation-'))
    return "Use the package's public entry, or widen the importPolicy.";
  if (issue.id.startsWith('eslint-')) {
    const ruleName = issue.id.slice('eslint-'.length);
    return `Fix per docs, or scope a disable to the line with a reason: \`${ruleName}\`.`;
  }
  if (issue.id.startsWith('python-type-error-'))
    return 'Refine the annotation, narrow at the call site, or pin a `# type: ignore[code]`.';
  return null;
}
