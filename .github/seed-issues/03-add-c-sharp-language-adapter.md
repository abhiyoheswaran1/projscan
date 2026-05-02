# Add C# language adapter

**Difficulty:** medium · **Scope:** ~250 LOC + tests · **Template to copy:** `src/core/languages/javaAdapter.ts`

## What

Add a `csharpAdapter` for `.cs` files. C# and Java share enough shape (static typing, classes, namespaces, methods) that the Java adapter is the right starting point.

## Where

Same structure as the Java adapter, with `c-sharp` swapped in for `java`:

- `src/core/languages/csharpAdapter.ts`, plus the walker files
- Tests under `tests/core/languages/csharp*.test.ts` and `tests/integration/csharpEndToEnd.test.ts`
- `tree-sitter-c-sharp` runtime dep

## How

1. Install `tree-sitter-c-sharp`.
2. Imports: `using Foo.Bar;` → resolves into the repo when `Foo/Bar.cs` exists under any source root.
3. Exports: `public class`, `public interface`, `public struct`, `public enum`, `public record`, `public delegate`. Internal-by-default; only `public` items count as exports.
4. CC: `if`, `else if`, `for`, `foreach`, `while`, `do`, `case` (default-case doesn't count), `catch`, `?:`, `??`, `&&`, `||`. Pattern-matching arms (`switch` expression) count one per arm.
5. Source-root detection: `*.csproj` files anchor a project. Walk up to find the closest one.

## Done condition

Same as Rust/PHP: tests, lint, stability check, docs.

## Out of scope

- NuGet dependency resolution (separate analyzer).
- Roslyn-specific features like top-level statements (handle if straightforward; defer if not).
