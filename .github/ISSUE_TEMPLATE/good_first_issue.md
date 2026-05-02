---
name: Good first issue
about: Maintainer-tagged starter task for new contributors
title: '[good first issue] '
labels: ['good first issue']
assignees: ''
---

<!--
Use this template only when proposing or claiming a maintainer-flagged
starter task. For general feature requests, use feature_request.md.
For bugs, use bug_report.md.
-->

## What needs to happen

<!-- Concrete, scoped, testable. One file or one feature, not a refactor. -->

## Where in the codebase

<!-- File paths the work touches, e.g. `src/analyzers/<new>.ts` plus a test
file under `tests/analyzers/`. Link the closest existing example so the
contributor can mirror it. -->

## Why it's a good first issue

- [ ] Scope fits a single PR
- [ ] No cross-cutting refactor required
- [ ] Has a clear "done" condition
- [ ] An existing file in the repo serves as a template
- [ ] Tests can be written from a single tree-sitter / Babel fixture

## How to verify it works

```sh
npm test                              # all tests must pass
npm run lint                          # lint must be clean
npm run check:stability               # stable surface unchanged
```

If you're adding or changing a public surface (CLI command, MCP tool,
exported type), say so — those land in the next minor release, not as a
patch.
