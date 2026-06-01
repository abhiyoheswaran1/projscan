# Third-Party Notices

projscan is licensed under MIT. It also depends on third-party open-source packages that keep their own licenses.

This notice summarizes direct runtime dependencies, optional peer dependencies, and bundled grammar artifacts used by the published package. Transitive dependencies keep their package metadata and license files through npm.

## Direct runtime dependencies

| Package | License |
|---|---|
| `@babel/parser` | MIT |
| `@babel/types` | MIT |
| `chalk` | MIT |
| `commander` | MIT |
| `fast-glob` | MIT |
| `ora` | MIT |
| `tree-sitter-c-sharp` | MIT |
| `tree-sitter-go` | MIT |
| `tree-sitter-java` | MIT |
| `tree-sitter-php` | MIT |
| `tree-sitter-python` | MIT |
| `tree-sitter-ruby` | MIT |
| `tree-sitter-rust` | MIT |
| `web-tree-sitter` | MIT |

## Optional peer dependency

| Package | License | Notes |
|---|---|---|
| `@xenova/transformers` | Apache-2.0 | Optional semantic-search peer. Not required for default BM25 search. |

## Bundled grammar artifacts

projscan packages Tree-sitter wasm grammars under `dist/grammars/` so scans work offline after install.

| Artifact | Source package | License |
|---|---|---|
| `web-tree-sitter.wasm` | `web-tree-sitter` | MIT |
| `tree-sitter-python.wasm` | `tree-sitter-python` | MIT |
| `tree-sitter-go.wasm` | `tree-sitter-go` | MIT |
| `tree-sitter-java.wasm` | `tree-sitter-java` | MIT |
| `tree-sitter-ruby.wasm` | `tree-sitter-ruby` | MIT |
| `tree-sitter-rust.wasm` | `tree-sitter-rust` | MIT |
| `tree-sitter-php.wasm` | `tree-sitter-php` | MIT |
| `tree-sitter-c_sharp.wasm` | `tree-sitter-c-sharp` | MIT |
| `tree-sitter-kotlin.wasm` | `tree-sitter-kotlin` | MIT |
| `tree-sitter-swift.wasm` | `tree-sitter-swift` | MIT |
| `tree-sitter-cpp.wasm` | `tree-sitter-cpp` | MIT |

## Notes for redistributors

If you redistribute projscan, keep the projscan MIT license and preserve required third-party license notices for the packages you redistribute.
