# Add Rust language adapter

**Difficulty:** medium · **Scope:** ~250 LOC + tests · **Template to copy:** `src/core/languages/goAdapter.ts`

## What

Add a `rustAdapter` so projscan parses `.rs` files into the same code-graph + complexity + per-function-CC primitives as the existing six languages.

## Where

- `src/core/languages/rustAdapter.ts` (new — copy the structure of `goAdapter.ts`)
- `src/core/languages/rustImports.ts`, `rustExports.ts`, `rustCyclomatic.ts`, `rustCallSites.ts`, `rustFunctions.ts`, `rustManifests.ts` (new walkers — mirror the Go set)
- `src/core/languages/registry.ts` — register the new adapter
- `src/core/languages/LanguageAdapter.ts` — widen `LanguageId` to include `'rust'`
- `package.json` — add `tree-sitter-rust` runtime dep
- `scripts/copy-wasm.mjs` — copy the rust grammar into `dist/grammars/`
- `tests/core/languages/rustAdapter.test.ts` and walker tests (mirror `tests/core/languages/goAdapter.test.ts`)
- `tests/integration/rustEndToEnd.test.ts` (mirror `goEndToEnd.test.ts`)

## How

1. `npm install tree-sitter-rust@^0.23` and verify the wasm grammar ships in the install.
2. Implement the six walkers using the Go adapter as a reference. Decision points for CC: `if`, `else if`, `for`, `while`, `loop` with `break`, `match` arms (one per non-`_` arm), `?` operator, `&&`, `||`. Default arms (`_`) don't count.
3. Add manifest detection: `Cargo.toml` → workspace root.
4. Imports: `use foo::bar` resolves to repo files when the path matches a workspace package.
5. Exports: `pub fn`, `pub struct`, `pub enum`, `pub trait`, `pub mod`. Visibility-by-default-private; only `pub` items are exports.
6. Tests must cover: parse / imports / exports / CC / per-fn CC / callSites / fixture end-to-end.

## Done condition

- `npm test` passes (existing tests + the new ones)
- `npm run lint` clean
- `npm run check:stability` reports `+ MCP tool: …` / `+ arg …` only — no removals
- README and `docs/STABILITY.md` updated to list Rust
- Bench numbers don't regress meaningfully on the existing fixtures

## Why this is a good first issue

The `LanguageAdapter` interface is the cleanest extension point in projscan. Five existing implementations show the shape. The work is mechanical once the tree-sitter-rust node types are read off the grammar README. No cross-cutting changes required.

## Out of scope

- Cargo workspace cross-package edges (mirror the JS workspace work in 0.13 for that — separate ticket).
- Macro expansion. Unexpanded macros are fine; CC is computed on the surface tree.
