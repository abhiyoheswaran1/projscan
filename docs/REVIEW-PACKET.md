# Current Train Review Packet

Date: 2026-06-16

This packet packages the current post-4.4 implementation train for review.
It originally held release action until explicit approval. On 2026-06-16 the
user approved finishing the bug pass and cutting the next version, so this
packet is now the review evidence behind the 4.5.0 release candidate.

## Decision Frame

The team/persona loop chose review readiness over starting another feature:

- Platform / Release Owner: needs one reviewer packet before release work.
- Security-Conscious Reviewer: needs a focused trust-boundary pass.
- Agent-Orchestrating Senior Engineer: needs resumable evidence for another
  agent or human.
- OSS Maintainer / MCP Adopter: needs proof examples more than another surface.

Result: package the train, refresh evidence, accept the manual scale sign-off
after the broad bug pass, and release as 4.5.0 if release gates pass.

## Scope

This train contains five product slices plus maintainability cleanup:

1. Roadmap and release-train reliability
   - `docs/ROADMAP.md` now describes the actual post-4.4 train.
   - `src/core/roadmapCatalog.ts` defaults 4.4.x and newer planning output to
     4.5.x through 4.9.x lines.
   - Tests cover 3.x/4.3 compatibility, post-4.4 defaults, and large 3.x minor
     version comparison.

2. Adoption proof and team recipes
   - `docs/examples/swarm-coordination.md` gives a local multi-agent
     coordination workflow.
   - `docs/examples/adoption-workflows.md` covers agent orchestration, package
     ownership, custom policy plugins, and scoped evidence.
   - `README.md` links these examples.

3. Scoped and redacted report exports
   - New local report controls support `--report-policy`, `--report-scope`, and
     `--redact-paths` on `analyze`, `doctor`, and `ci`.
   - Config adds additive `reportPolicies.<name>` presets.
   - Tests cover config normalization, direct flag overrides, unknown policy
     errors, scope filtering, and stable path labels.

4. Python upgrade intelligence
   - `projscan upgrade` and MCP `projscan_upgrade` now support offline Python
     previews from `pyproject.toml`, `setup.cfg`, `setup.py`, root
     `requirements*.txt`, Poetry/Pipfile/uv lockfiles, and pinned root requirements.
   - Optional public fields identify declared/current version evidence source
     and line.
   - Python previews remain PyPI-free; npm registry lookup remains opt-in via
     existing npm-only registry behavior.

5. Framework dataflow precision
   - Qualified member reads are tracked as `memberReferences`.
   - Fastify and Koa request sources are framework-gated by imports, handler
     context, parameter shape, and qualified member evidence.
   - Taint internal node IDs include file/name/line so multiple inline anonymous
     handlers do not overwrite each other.

6. Maintainability cleanup
   - `src/core/startNextActions.ts` extracts next-action assembly out of
     `src/core/start.ts`.
   - Public type tests cover newly exported types and upgrade metadata.

## Focused Security / API Review

Report redaction and scoping:

- Trust boundary: local report shaping only. No network call, telemetry, secret
  read, or filesystem write is introduced by the report controls.
- Scope filtering uses repo-relative path normalization and drops out-of-scope
  issue locations/files from exported evidence.
- Redaction replaces paths with stable per-report labels such as
  `redacted-path-1`; the same source path maps to the same label inside one
  report.
- JSON/SARIF artifacts carry path-safe `reportControls` metadata, and Markdown
  artifacts carry the same active/scope-count/redaction signal as a banner.
- Residual risk: redacted reports preserve issue count, file count, extension,
  size, and same-report correlation. That is intentional evidence utility, but
  it is not anonymity against a reviewer who already knows the repo shape.
- Tests: `tests/core/reportScope.test.ts`, `tests/utils/config.test.ts`,
  `tests/types/public-config-types.test.ts`.

Python lockfile parsing:

- Trust boundary: local manifests/lockfiles only. The Python path does not query
  PyPI and does not add a package install/execution path.
- Supported current-version evidence is intentionally narrow: Poetry/uv package
  blocks, Pipfile exact versions, and pinned root requirements.
- Optional evidence fields are additive: `ecosystem`, `declaredSource`,
  `declaredLine`, `declaredScope`, `installedSource`, `installedLine`.
- Residual risk: lockfile coverage is partial by design; unsupported Python
  lockfile formats should remain deferred until real demand.
- Tests: `tests/core/languages/pythonManifests.test.ts`,
  `tests/core/upgradePreview.test.ts`,
  `tests/mcp/pythonUpgradeFallback.test.ts`, reporter tests, and public type
  tests.

Koa/Fastify dataflow:

- Trust boundary: request sources are not broad name matches. They require
  framework imports and handler call context.
- Koa uses qualified `memberReferences` and gated `memberCallSites`, so
  `ctx.request.body`, `ctx.query`, `ctx.params`, headers, `ctx.get(...)`, and
  `ctx.request.get(...)` can be detected without treating `ctx.body` response
  writes or helper `ctx.get(...)` calls as request input.
- Fastify remains parameter/reference gated and keeps lookalike helpers quiet.
- Cache version is bumped to invalidate stale graph entries that lack
  `memberReferences`.
- Tests: `tests/core/ast.references.test.ts` and `tests/core/dataflow.test.ts`.

Public API and config:

- New public config/type fields are additive.
- Existing command names, exit codes, and output formats are preserved.
- `docs/STABILITY.md`, `README.md`, and `docs/GUIDE.md` document the new flags
  and config keys.
- `DECISIONS.md` records the architecture/public-behavior decisions.

Package/dependency surface:

- Current dirty diff shows no dependency or lockfile changes.
- `package.json` only adds the new docs examples to package contents.
- No install scripts, runtime dependencies, or package-version changes are in
  this train.

Docs claims:

- README and Guide no longer claim Python upgrade preview is Node-only.
- Roadmap/release-train docs now distinguish the completed 4.5.0 train from
  the next validation work.
- Adoption examples are local-first and do not require a daemon or cloud
  service.

Secrets:

- Env-file path scan for this packet returned no `.env*` paths outside
  `node_modules` and `.git`.
- No secret values were read or printed.

## Verification Evidence

Release-grade evidence already gathered for this train:

| Command | Result |
| --- | --- |
| `npm test` | Passed: 297 test files, 2255 tests passed, 1 skipped. Notes: untrusted plugin skipped by design; optional HuggingFace semantic model hit 429 and fell back without failing. |
| `npm run build` | Passed previously and passed fresh for this packet. |
| `npm run check:stability` | Passed. |
| `npm exec projscan -- doctor --format json` | Previously passed with health 100/A and 0 issues. |
| `npm exec projscan -- preflight --mode before_commit --format json` | Previously returned caution for manual release sign-off/scale and remembered-session hotspots, not concrete defects. |
| `npm run release:check` | Earlier run blocked by dirty worktree while release approval was withheld. The release task reruns this after metadata, commit, and tag readiness are in place. |
| `.agentloop/reports/2026-06-16-13-05-verification-report.md` | Latest prior AgentLoop task verification passed. |

Fresh verification for this review-packet task:

| Command | Result |
| --- | --- |
| `npm exec projscan -- doctor --format json` | Passed, health score 100/A, total issues 0. |
| `npm exec projscan -- review --format json` | Exit 0, review verdict `block` only for maximum changed-file risk 216.6. Concrete metrics: `riskyFunctions: []`, `newDataflowRisks: []`, `newTaintFlows: []`, `dependencyChanges: []`. One expected additive contract change: exported `ReportPolicyPreset`. |
| `npm exec projscan -- preflight --mode before_commit --format json` | Exit 0, verdict `caution`; health and supply-chain checks pass, coordination readiness is `clear`, review warning is scale/complexity across 44 changed files. |
| `npm run typecheck` | Passed with `tsc --noEmit`. |
| `npm run lint` | Passed with `eslint src/`. |
| `npm run build` | Passed with TypeScript compile, wasm copy, and 45-tool manifest generation. |

Non-blocking review signal: `projscan review` returns a block verdict from
maximum changed-file risk because the dirty train is broad. It does not report
new risky functions, dataflow risks, taint flows, or dependency changes. The
single contract change is the additive, documented, and tested
`ReportPolicyPreset` export.

## Known Non-Blockers

- Dirty worktree: expected until review approval decides whether to commit as
  one train or split into PR-sized chunks.
- Release check: expected to fail while dirty and while release approval is
  withheld.
- Review scale verdict: a broad dirty train can exceed the changed-file risk
  threshold even when focused bug/security metrics are clean.
- AgentLoop handoff freshness: earlier gate output warned that handoff freshness
  did not cover all dirty files even after regeneration; treat this as a harness
  evidence quirk unless it recurs after the fresh packet handoff.

## Split Options

Preferred review option:

- One current-train PR/review packet with reviewers assigned by slice. This keeps
  cross-slice docs, stability, and public type context together.

Alternative split:

- Roadmap/adoption docs.
- Report policy presets and scoped/redacted evidence.
- Python upgrade intelligence.
- Framework dataflow precision.
- Maintainability cleanup.

Release option:

- The user approved release work after a big bug pass. Proceed with one 4.5.0
  release train if gates pass; stop on concrete release blockers or missing
  channel credentials.

## Reviewer Checklist

- Confirm no dependency, lockfile, version, tag, publish, or release artifact was
  introduced.
- Review `src/core/reportScope.ts` for path filtering/redaction behavior.
- Review Python parsing for local-only lockfile assumptions and line evidence.
- Review framework source matching for false positives, especially Koa
  response-body writes and helper functions.
- Confirm public API changes are additive and documented.
- Inspect fresh AgentLoop verification and handoff artifacts after they are
  generated.
- Decide one of: approve as a single train, request split, or hold for more
  targeted tests.

## Rollback Notes

- Roadmap/adoption docs: revert docs and package `files` entries for examples.
- Report policies: remove `src/core/reportScope.ts`, CLI flags, config type
  fields, docs, and related tests.
- Python upgrade: restore MCP fallback, remove Python preview path and optional
  metadata fields, then restore docs claiming Node-only support.
- Dataflow: remove `memberReferences`, revert cache version, and remove Fastify
  / Koa framework sources and tests.
- Maintainability cleanup: inline `buildStartNextActions` back into
  `src/core/start.ts`.
- Review packet: remove this file; no runtime behavior depends on it.
