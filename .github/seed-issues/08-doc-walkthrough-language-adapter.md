# Write a "Build a language adapter" walkthrough

**Difficulty:** small · **Scope:** ~300 lines of markdown · **Where:** `docs/CONTRIBUTING-LANGUAGE-ADAPTER.md` (new)

## What

The seed-issues for adding Rust / PHP / C# language adapters all point at "mirror the Go adapter" but don't have a step-by-step walkthrough. Write one. Take a real, small language (e.g. **Lua**, **Bash**, or **Elixir**) end-to-end as the worked example, even if we don't actually merge that adapter — the point is the walkthrough.

## Where

- New file: `docs/CONTRIBUTING-LANGUAGE-ADAPTER.md`
- Link from `CONTRIBUTING.md` in the "Areas wanting help" section's "New language adapters" bullet

## How

Walk through, in order:

1. **Pick a tree-sitter grammar.** Show how to find one (`tree-sitter-<lang>` on npm), what the README of the grammar package looks like, and what to verify (browser-compatible build, MIT/Apache license, recent maintenance).
2. **Install + vendor the wasm.** `npm install tree-sitter-<lang>`, then add an entry to `scripts/copy-wasm.mjs` so the wasm lands in `dist/grammars/`.
3. **Skeleton adapter.** Show the file structure: `<lang>Adapter.ts` + the six walker files + `<lang>Manifests.ts`. Explain what each one is responsible for.
4. **Implement imports + exports first.** These are the simplest walkers. Show one each, with the tree-sitter node types listed.
5. **Implement CC + per-function CC.** Decision-point list. Pitfall: nested functions emit their own entries.
6. **Implement callSites + manifests.**
7. **Wire into the registry.** Show the one-line addition to `src/core/languages/registry.ts` and the `LanguageId` widening.
8. **Tests.** Show one walker test and one end-to-end fixture test. Explain how the bench-time wasm loading is mocked.
9. **Stability check.** `npm run check:stability` — should report adapter additions only.
10. **Final sanity.** `npm test`, `npm run lint`, `npm run build`, then `projscan analyze` against a small `.<lang>` fixture.

## Done condition

- A new contributor following this walkthrough produces a working adapter without needing to read the existing adapters first.
- Linked from `CONTRIBUTING.md`.
- README adds a one-line pointer to the walkthrough next to the language-adapter on-ramp.

## Why this is a good first issue

Documentation is the highest-leverage thing a non-code contributor can add. This particular doc is what unblocks the Rust / PHP / C# tickets above.
