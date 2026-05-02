# Add PHP language adapter

**Difficulty:** medium · **Scope:** ~250 LOC + tests · **Template to copy:** `src/core/languages/rubyAdapter.ts`

## What

Add a `phpAdapter` so projscan parses `.php` files into the standard graph + complexity primitives.

## Where

Mirror the Ruby adapter (closest in shape — both are dynamically-typed, OOP-friendly, no static types):

- `src/core/languages/phpAdapter.ts`, plus the six walker files
- `src/core/languages/registry.ts` — register
- `src/core/languages/LanguageAdapter.ts` — widen `LanguageId`
- `package.json` — `tree-sitter-php` runtime dep
- `scripts/copy-wasm.mjs` — copy grammar
- Tests under `tests/core/languages/php*.test.ts` and `tests/integration/phpEndToEnd.test.ts`

## How

1. Install `tree-sitter-php`, vendor the grammar.
2. Imports: `require`, `require_once`, `include`, `include_once`, `use Namespace\Class`. The `use` form maps cleanly to imports; `require` family resolves to repo-local files.
3. Exports: top-level `function`, `class`, `interface`, `trait`, `enum`. Namespaces are treated as Java-style packages.
4. CC decision points: `if`, `elseif`, `for`, `foreach`, `while`, `do`, `case` (default doesn't count), `catch`, `?:`, `??`, `&&`, `||`, `and`, `or`.
5. Project layout detection: `composer.json` → autoload entries (PSR-4 / classmap). Fall back to file-based scan when no manifest.

## Done condition

Same as the Rust adapter task: tests pass, lint clean, stability-baseline reports an addition only, README + STABILITY updated.

## Out of scope

- Composer dependency resolution against the registry (mirror npm's `outdated` work — separate ticket).
- Laravel / Symfony framework detection (separate analyzer issue).
