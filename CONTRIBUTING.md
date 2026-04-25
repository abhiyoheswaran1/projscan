# Contributing to projscan

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/abhiyoheswaran1/projscan.git
cd projscan
npm install
npm run build
```

### Running locally

```bash
# Run the CLI directly from source
node dist/cli/index.js doctor

# Watch mode for development
npm run dev
```

### Running tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

### Linting and formatting

```bash
npm run lint          # ESLint
npm run format        # Prettier
```

## How to Contribute

### Reporting Bugs

Open an [issue](https://github.com/abhiyoheswaran1/projscan/issues/new?template=bug_report.md) with:
- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS

### Suggesting Features

Open an [issue](https://github.com/abhiyoheswaran1/projscan/issues/new?template=feature_request.md) describing:
- The problem you're trying to solve
- Your proposed solution
- Alternative approaches you've considered

### Submitting Pull Requests

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add or update tests as needed
4. Run `npm test` and `npm run lint` to verify
5. Write a clear PR description explaining the change

## Project Structure

```
src/
├── cli/          # Command definitions (Commander.js)
├── core/         # Scanners, detectors, issue engine, hotspots, file inspector
│   └── languages/  # LanguageAdapter + per-language parsers (JS via babel, Python via tree-sitter)
├── analyzers/    # Issue checkers (eslint, prettier, test, architecture, deps, security, python*)
├── fixes/        # Auto-fix implementations (ESLint, Prettier, Vitest, EditorConfig)
├── reporters/    # Output formatters (console, JSON, markdown, SARIF)
├── mcp/          # MCP server - tools, prompts, resources for AI agents
└── utils/        # Shared utilities (config loader, changed-files, baseline, banner, logger)
```

### Adding a language

As of 0.10, projscan has a `LanguageAdapter` interface (`src/core/languages/LanguageAdapter.ts`). Adding a new language means:

1. Implement the interface in `src/core/languages/<lang>Adapter.ts`. The Python adapter (`pythonAdapter.ts`) is the reference - it wraps a tree-sitter grammar, extracts imports/exports/symbol defs, resolves imports, and detects package roots.
2. Register the adapter in `src/core/languages/registry.ts`.
3. If the parser needs a grammar binary (e.g. another tree-sitter language), vendor the wasm under `dist/grammars/` via `scripts/copy-wasm.mjs` and add a test in `tests/integration/packSmokeTest.test.ts` that asserts it ships in the tarball.
4. Add language-specific analyzers under `src/analyzers/<lang>*.ts` (see `pythonTestCheck.ts`, `pythonLinterCheck.ts` for the pattern) and wire them into `src/core/issueEngine.ts`.
5. Add tests mirroring `tests/core/languages/pythonAdapter.*.test.ts` coverage (parse, imports, exports, resolver, package roots).

## Code Style

- TypeScript with strict mode
- ESLint + Prettier for formatting
- Keep dependencies minimal - avoid adding new runtime dependencies unless necessary
- Write tests for new analyzers and fixers

## Releasing

A release is a six-step ritual. Skipping any step leaves something out of sync.

1. **Bump version** in `package.json` (semver: patch for fixes, minor for features, major if anything breaks).
2. **Write the CHANGELOG entry** at the top of `CHANGELOG.md` using the existing Keep-a-Changelog format. Cover Added / Changed / Removed / Notes. Be honest about tradeoffs.
3. **Verify the build artifact** locally: `npm run build && npm run test`. The build runs `tsc + copy-wasm + generate-tool-manifest`; all three must succeed. Tests must be green.
4. **Tag and publish.** Merge to `main`, then `git tag vX.Y.Z && git push origin vX.Y.Z && npm publish`.
5. **Create the GitHub Release** at the new tag and **attach `dist/tool-manifest.json`** as a release asset (`gh release create vX.Y.Z dist/tool-manifest.json --title ... --notes ...`). The website's docs page reads this asset.
6. **Bump the website's expectations.** In the personal-website repo, open `tools.astro` (or wherever the EXPECTED block lives) and edit:
   - The hardcoded **manifest URL pin** → swap `releases/download/vX.Y.Z/tool-manifest.json` for the new tag
   - `EXPECTED.minVersion` → the new version
   - `EXPECTED.requiredTools` → append any new MCP tool names the release added

   The website build refuses to run until all three edits are in. That friction is the feature — it prevents the docs page from drifting out of sync with the published tool surface.

   The changelog page does NOT need a manual bump — it pulls `CHANGELOG.md` from `main` at build time, so the next site build after the release naturally picks up the new entry.

The MCP-tool count, runtime-dep count, and any "X tools" / "Y languages" claims in `README.md` and `docs/` are hand-edited; sweep for them when the release adds tools or languages.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
