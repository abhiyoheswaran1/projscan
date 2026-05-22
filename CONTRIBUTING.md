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

## Stable surface

The MCP tool inventory, CLI command list, and exit codes documented in `docs/STABILITY.md` are the **public contract**. CI runs `npm run check:stability` which compares the current build against `stability-baseline.json` checked into the repo root.

- **Adding** a new MCP tool, optional argument, or CLI command is fine - the guard prints additions but does not fail.
- **Removing** or **renaming** anything in the stable surface fails the guard. Either restore the surface or, if the change is intentional and warrants a major version bump, regenerate the baseline:

  ```sh
  npm run build
  node scripts/check-stability.mjs --update
  ```

  Only run `--update` when you genuinely intend to break the contract (i.e. a major-version release). The friction is the point.

## Areas wanting help

Concrete on-ramps for new contributors. Each is scoped to fit a first PR. Pre-drafted starter tasks live under [`.github/seed-issues/`](.github/seed-issues/) — pick one and either claim its corresponding GitHub issue or open one and link the file.

- **New language adapters.** The `LanguageAdapter` interface (`src/core/languages/LanguageAdapter.ts`) is the cleanest entry point. Seven languages are wired today (JS, TS, Python, Go, Java, Ruby, Rust). The Python and Rust adapters are good references — Python for the simplest shape, Rust for a recent end-to-end example. Each adapter is ~200 LOC plus walkers (imports, exports, CC, per-fn CC, callSites) and a vendored tree-sitter grammar wasm. Pre-drafted tickets: [PHP](.github/seed-issues/02-add-php-language-adapter.md), [C#](.github/seed-issues/03-add-c-sharp-language-adapter.md). Plus a [step-by-step walkthrough doc](.github/seed-issues/08-doc-walkthrough-language-adapter.md) is itself an open issue.
- **New analyzers.** Issue checkers live in `src/analyzers/`. Each is a pure function `(rootPath, files) => Promise<Issue[]>`. Existing ones (`testCheck`, `prettierCheck`, `securityCheck`, `dependencyRiskCheck`, `cycleCheck`) are good shape templates. Wire into `src/core/issueEngine.ts`. Tests in `tests/analyzers/`.
- **New reporters.** Output formatters in `src/reporters/`. Implement the same surface as `consoleReporter.ts` / `markdownReporter.ts` / `jsonReporter.ts` / `htmlReporter.ts`. Pre-drafted tickets: [HTML for `pr-diff`](.github/seed-issues/04-html-reporter-for-pr-diff.md), [HTML for `coverage`](.github/seed-issues/05-html-reporter-for-coverage.md).
- **MCP tools.** Each tool is a `{name, description, inputSchema, handler}` object exported from `src/mcp/tools/<name>.ts` and registered in `src/mcp/tools.ts`. Mirror an existing one (e.g. `src/mcp/tools/coupling.ts` is a clean shape). Add a `tools/list` assertion to `tests/mcp/server.test.ts`.
- **Fix-suggest templates.** The rule-driven action-prompt registry in `src/core/fixSuggest.ts` covers ~12 issue families. Each new template is ~25 LOC. Pre-drafted ticket: [eslint-* template](.github/seed-issues/06-eslint-fix-suggest-template.md).
- **UX polish.** Small, high-leverage CLI ergonomics. Pre-drafted ticket: [impact-symbol disambiguation warning](.github/seed-issues/07-impact-cli-symbol-disambiguation.md).
- **Documentation.** `docs/GUIDE.md` covers the agent journey + per-command reference; tighter sections still wanted: per-analyzer "what triggers / how to silence" tables, monorepo setup walkthroughs, framework-specific guides.

### First-time contributor walkthrough

If you've never landed a PR on this repo before, the smallest possible loop:

```sh
# 1. Fork on GitHub, then locally:
git clone git@github.com:<your-username>/projscan.git
cd projscan

# 2. Verify the baseline works (no code changes yet)
npm install
npm test                              # 800+ tests, ~6s
npm run lint                          # eslint, no errors expected
npm run build                         # tsc + wasm copy + manifest generation
npm run check:stability               # baseline diff; should be clean

# 3. Pick a seed issue, mirror the template it points at
#    e.g. .github/seed-issues/06-eslint-fix-suggest-template.md
#    -> open src/core/fixSuggest.ts, find the existing templates,
#       mirror one, write tests, run npm test

# 4. Commit + push to your fork
git checkout -b feat/eslint-fix-template
git add -A
git commit -m "Add fix-suggest template for eslint-* rules"
git push origin feat/eslint-fix-template

# 5. Open a PR back to abhiyoheswaran1/projscan:main
#    Reference the seed issue file in the PR description.
```

CI runs the same checks (`npm test`, `npm run lint`, `npm run check:stability`) on every PR. As long as those pass, a maintainer will review.

For larger work (refactors, cross-cutting changes), open an issue first to discuss the approach. We'd rather agree on the shape before you spend a weekend on it.

## Releasing

A release is a five-step ritual now that `.github/workflows/release.yml` (1.6.1+) does the heavy lifting. Steps 1-3 prep + ship the npm + GitHub Release surfaces; steps 4-5 are the manual surfaces (MCP Registry + website) that need interactive auth CI can't do safely.

1. **Bump version + write the CHANGELOG entry** in a PR against `main`:
   - `package.json#version` → new semver (patch for fixes, minor for features, major if anything breaks).
   - `.github/mcp-registry/server.json` — bump BOTH `version` fields (top-level and `packages[0].version`). Description must stay ≤ 100 chars (registry limit).
   - `CHANGELOG.md` — add a `## [X.Y.Z] — YYYY-MM-DD` section at the top in Keep-a-Changelog format. Cover Added / Changed / Removed / Notes; be honest about tradeoffs. The release workflow slices this verbatim into the GitHub Release body.
   - Sweep for "X tools" / "Y languages" counts in `README.md`, `docs/GUIDE.md`, `docs/ROADMAP.md` and update them.
   - **Regenerate the dogfood health badge.** Run `npx projscan badge` against the prepped tree. If the letter or score in the README badge changed, update `README.md` to match. **A drop in letter (e.g., A → B) is a release blocker** — fix the underlying signal before tagging. (The badge is a static `img.shields.io/badge` snapshot, not a live endpoint, so it stays consistent until the next release intentionally moves it.)
   - Run `npm run release:check`. It reports version/changelog drift, dirty worktree state, tag state, and the next release action. When there are no metadata or git blockers, it also runs the build, release gate, tests, lint, stability check, SBOM generation, and packed install smoke.

2. **Merge the PR.** Per the project's PR-and-review rule, every change including release prep goes through review.

3. **Tag and push.** From `main`:
   ```
   git tag -a vX.Y.Z -m "Release vX.Y.Z"
   git push origin vX.Y.Z
   ```
   The `Release` workflow fires automatically. It validates versions, runs the full build / test / lint / stability gate, slices the CHANGELOG entry, creates the GitHub Release with `dist/tool-manifest.json` attached, and publishes to npm with provenance. If anything fails, no GitHub Release is created and no npm publish happens — fix and re-tag, or use the workflow's `workflow_dispatch` re-run with the same tag (the workflow is idempotent).

4. **MCP Registry republish (manual).** From your machine, after the workflow turns green:
   ```
   ~/bin/mcp-publisher publish .github/mcp-registry/server.json
   ```
   If it 401s, refresh with `~/bin/mcp-publisher login github`. The registry stores all published versions; not republishing means the registry's "latest" pointer drifts behind npm.

5. **Bump the website's expectations** (separate repo). In the personal-website repo, open `tools.astro` (or wherever the EXPECTED block lives) and edit:
   - The hardcoded **manifest URL pin** → swap `releases/download/vX.Y.Z/tool-manifest.json` for the new tag.
   - `EXPECTED.minVersion` → the new version.
   - `EXPECTED.requiredTools` → append any new MCP tool names the release added.

   The website build refuses to run until all three edits are in. That friction is the feature — it prevents the docs page from drifting out of sync with the published tool surface. The changelog page is regenerated from `CHANGELOG.md` on `main` at build time, so the next site build naturally picks up the new entry.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
