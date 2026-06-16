# Add HTML reporter for `projscan coverage`

**Difficulty:** small · **Scope:** ~80 LOC + tests · **Template to copy:** `reportHotspotsHtml` in `src/reporters/htmlReporter.ts`

## What

`projscan coverage --format html` currently falls through to the console reporter. Add a dedicated HTML renderer so the "scariest untested files" output can be shared as a PR comment.

## Where

- `src/reporters/htmlReporter.ts` — add `reportCoverageHtml(report: CoverageJoinedReport): void`
- `src/cli/commands/coverage.ts` — wire it into the format switch
- `tests/reporters/htmlReporter.test.ts` — add tests

## How

Mirror `reportHotspotsHtml`. The coverage output is a list of files annotated with risk × coverage; render as a sortable-looking table (no JS, just `<th>` style hints).

Layout:

- `<h1>` "Coverage × Risk"
- Stats line: total covered files, average coverage %
- Table: file, coverage %, risk score, hotspot reasons
- Visual cue: rows with coverage < 50% AND risk > 50 highlighted via the existing `severity-error` class

## Done condition

Same shape as task 04: tests pass, manual smoke-test of the rendered HTML, no type changes.
