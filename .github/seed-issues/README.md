# Seed issues

Drafts for starter contributor tasks. **These are not GitHub issues yet** — they live here as markdown so the maintainer can paste them into the GitHub UI when ready, or the contributor can pick one up directly from this directory.

Each file is one self-contained issue. They are designed to be:

- **Scoped to a single PR** — no week-long refactors.
- **Mirrorable from an existing file in the repo** — every task points at a template to copy.
- **Independently verifiable** — `npm test` + `npm run lint` + `npm run check:stability` decides whether the work is done.

## How to claim one

1. Comment on the corresponding GitHub issue (or, if no GitHub issue exists yet, open one and paste the file's contents into the body).
2. Fork the repo, branch off `main`.
3. Implement.
4. Open a PR linking back to the issue.

If a task here looks stale or already done, it probably is — check `git log` against the file paths it mentions.

## Index

- [02-add-php-language-adapter.md](./02-add-php-language-adapter.md) — second-language scaffold (medium)
- [03-add-c-sharp-language-adapter.md](./03-add-c-sharp-language-adapter.md) — second-language scaffold (medium)
- [04-html-reporter-for-pr-diff.md](./04-html-reporter-for-pr-diff.md) — extend HTML output (small)
- [05-html-reporter-for-coverage.md](./05-html-reporter-for-coverage.md) — extend HTML output (small)
- [07-impact-cli-symbol-disambiguation.md](./07-impact-cli-symbol-disambiguation.md) — UX polish (small)
- [08-doc-walkthrough-language-adapter.md](./08-doc-walkthrough-language-adapter.md) — documentation (small)

### Shipped (kept for reference; the corresponding GitHub issues, if opened, can be closed):

- ~~01-add-rust-language-adapter.md~~ — shipped in 1.1.0.
- ~~06-eslint-fix-suggest-template.md~~ — shipped in 1.1.0.
