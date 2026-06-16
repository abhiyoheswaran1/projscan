# Add HTML reporter for `projscan pr-diff`

**Difficulty:** small · **Scope:** ~80 LOC + tests · **Template to copy:** `reportReviewHtml` in `src/reporters/htmlReporter.ts`

## What

`projscan pr-diff --format html` currently falls through to the console reporter. Add a dedicated HTML renderer so the structural-diff output can be posted as a PR comment or saved as a CI artifact.

## Where

- `src/reporters/htmlReporter.ts` — add `reportPrDiffHtml(report: PrDiffReport): void`
- `src/cli/commands/prDiff.ts` — wire `case 'html': reportPrDiffHtml(report); break;`
- `tests/reporters/htmlReporter.test.ts` — add a `describe('reportPrDiffHtml', …)` block mirroring the existing `reportReviewHtml` tests

## How

Mirror `reportReviewHtml`. The PR-diff output is simpler — just three lists (added / removed / modified files) and per-file structural changes. Use the existing `htmlShell()`, `escapeHtml()`, and `signed()` helpers.

Layout:

- `<h1>` with the base → head ref summary
- Stats line: total files changed, breakdown
- Three sections: Added / Removed / Modified
- For each Modified file, render exports/imports/calls add/remove/rename lists in a small table

## Done condition

- `npm test` passes including the new tests
- `projscan pr-diff --format html > /tmp/diff.html && open /tmp/diff.html` shows a usable page
- No changes to the `PrDiffReport` type itself

## Why this is a good first issue

The pattern is fully established by the existing five HTML renderers. Pure rendering work; no analysis logic to design.
