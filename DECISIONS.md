# Decisions

This log records reviewer-visible architecture, workflow, and public behavior decisions.

## 2026-06-16: Reuse shared AST child traversal in JavaScript walkers

- Status: accepted
- Context: `walk`, `walkChildren`, and `walkSkippingNestedFunctions` duplicated object-key traversal logic that was already isolated in `childAstNodes` during earlier AST hotspot cleanup.
- Decision: Route the generic JavaScript AST walkers through `childAstNodes` while preserving nested-function skipping behavior where required.
- Consequences: Function and call-site extraction behavior remains unchanged, but future traversal key filtering changes now have one private helper to review.
- Verification: `npm run test -- tests/core/ast.test.ts tests/core/ast.functions.test.ts tests/core/ast.references.test.ts tests/core/dataflow.test.ts`.

## 2026-06-16: Treat Express and Fastify request IP metadata as gated sources

- Status: accepted
- Context: Express and Fastify route handlers detected request body, query, params, headers, cookies, and selected accessors, but common request IP metadata (`req.ip` / `request.ip`) stayed invisible. Treating every `ip` member read as a source would create helper false positives.
- Decision: Add `express.req.ip` and `fastify.request.ip` as framework request sources only when framework imports, handler call context, and request parameters are present.
- Consequences: `projscan dataflow` can report request IP metadata flowing into database sinks, while same-file helper functions reading `.ip` remain quiet unless they are passed as framework handlers.
- Verification: `npm run test -- tests/core/dataflow.test.ts -t "request IP"`.

## 2026-06-16: Split JavaScript function naming into private helpers

- Status: accepted
- Context: `nameForFunctionNode` remained a high-complexity hotspot after the AST traversal and export extraction work. It mixed declaration names, method key decoding, private method handling, function-expression names, and binding fallback.
- Decision: Keep emitted `FunctionInfo.name` values unchanged, but split function declarations, method naming, method key decoding, private names, and function-expression names into private helpers.
- Consequences: Function naming stays schema-compatible while future Babel node-shape adjustments can be reviewed in focused helpers.
- Verification: `npm run test -- tests/core/ast.functions.test.ts tests/core/ast.test.ts tests/core/ast.references.test.ts`.

## 2026-06-16: Split JavaScript named-export collection into private helpers

- Status: accepted
- Context: After function traversal extraction, `src/core/ast.ts` still had `collectNamedExport` as a high-complexity hotspot mixing re-export imports, inline declaration exports, variable declarations, and local specifier aliases.
- Decision: Keep `parseSource` export behavior unchanged, but move re-export import construction, inline declaration handling, variable export emission, local specifier handling, and shared named-export pushing into private helpers.
- Consequences: Named export parsing remains schema-compatible while future changes to TypeScript declaration exports or re-export handling can be reviewed in smaller helpers.
- Verification: `npm run test -- tests/core/ast.test.ts tests/core/ast.functions.test.ts tests/core/ast.references.test.ts`.

## 2026-06-16: Surface report controls in HTML artifacts

- Status: accepted
- Context: Scoped/redacted issue data flowed into `analyze --format html` and `doctor --format html`, but those HTML artifacts did not state that report controls were active. Reviewers could not distinguish intentionally scoped or redacted HTML from ordinary HTML output.
- Decision: Add a path-safe report-controls card to HTML analyze and doctor output when `--report-policy`, `--report-scope`, or `--redact-paths` activates export controls.
- Consequences: HTML artifacts can prove scope/redaction was applied without exposing requested scope paths. JSON/SARIF metadata and Markdown banners remain unchanged.
- Verification: `npm run test -- tests/reporters/htmlReporter.test.ts -t "report controls"` and `npm run test -- tests/cli/formatHandling.test.ts -t "analyze HTML output"`.

## 2026-06-16: Split JavaScript function collection into private traversal helpers

- Status: accepted
- Context: `src/core/ast.ts` is the top hotspot, and `collectFunctions` carried traversal, naming context, callback context, and `FunctionInfo` assembly in one high-complexity function.
- Decision: Keep `parseSource` and `FunctionInfo` behavior unchanged, but move function emission, class/default export handling, assignment/binding traversal, call-argument context, and generic child traversal into private helpers.
- Consequences: AST function discovery stays schema-compatible while future changes to callback context or member evidence can be reviewed in smaller helpers.
- Verification: `npm run test -- tests/core/ast.functions.test.ts tests/core/ast.references.test.ts tests/core/ast.test.ts tests/core/dataflow.test.ts`.

## 2026-06-16: Treat Hono validated request data as a gated source

- Status: accepted
- Context: Hono route handlers already detected `c.req.json()`, `c.req.query()`, `c.req.param()`, and `c.req.header()`, but projects that use validator middleware commonly read user-controlled input through `c.req.valid(...)`. Treating every `valid` call as a source would create helper false positives.
- Decision: Add `hono.req.valid` as a framework request source only when a Hono import, Hono handler call context, and Hono context parameter are present.
- Consequences: `projscan dataflow` can report validated Hono request data flowing into database sinks, while same-file helper functions with `c.req.valid(...)` remain quiet unless they are passed as Hono handlers.
- Verification: `npm run test -- tests/core/dataflow.test.ts -t "Hono validated request data"`.

## 2026-06-16: Use conda-lock files as Python upgrade current-version evidence

- Status: accepted
- Context: `conda-lock.yml` and `conda-lock.yaml` were already recognized as Python lockfile presence signals, but upgrade previews did not parse resolved versions from them. Conda-managed Python projects therefore fell back to pinned requirements when present and otherwise lacked installed/current evidence.
- Decision: Parse the common `conda-lock` YAML `package:` list entries containing `name` and `version` with a narrow local line scanner and feed those versions into Python upgrade preview current-version fields.
- Consequences: `projscan upgrade <python-package>` can report `installed`, `latest`, `drift`, and `installedSource: "conda-lock.yml"` or `"conda-lock.yaml"` for Conda-managed projects without querying PyPI, executing environments, changing npm registry behavior, or adding a YAML dependency.
- Verification: `npm run test -- tests/core/languages/pythonManifests.test.ts tests/core/upgradePreview.test.ts -t "conda-lock|parseCondaLock"`.

## 2026-06-16: Use pdm.lock as Python upgrade current-version evidence

- Status: accepted
- Context: `pdm.lock` was already recognized as a Python lockfile presence signal, but upgrade previews did not parse resolved versions from it. PDM projects therefore fell back to pinned requirements when present and otherwise lacked installed/current evidence.
- Decision: Parse `pdm.lock` `[[package]]` blocks with the same local TOML package-block parser used for Poetry and uv lockfiles and feed those versions into Python upgrade preview current-version fields.
- Consequences: `projscan upgrade <python-package>` can report `installed`, `latest`, `drift`, and `installedSource: "pdm.lock"` for PDM-managed projects without querying PyPI, changing npm registry behavior, or adding a TOML dependency.
- Verification: `npm run test -- tests/core/languages/pythonManifests.test.ts tests/core/upgradePreview.test.ts -t "pdm\\.lock|parsePdmLock"`.

## 2026-06-16: Treat Express header accessors as gated request sources

- Status: accepted
- Context: Express request property sources were detected, but common `req.get(...)` and `req.header(...)` header accessors stayed invisible inside route handlers. Treating every `get` or `header` call as a source would create noisy helper false positives.
- Decision: Add `express.req.get` and `express.req.header` as framework request sources only when an Express import, Express handler call context, and Express request parameter are present.
- Consequences: `projscan dataflow` can report Express header accessor input flowing into database sinks, while same-file helper functions with `req.get(...)` remain quiet unless they are passed as Express handlers.
- Verification: `npm run test -- tests/core/dataflow.test.ts -t "Express header accessor"`.

## 2026-06-16: Extract changed-file enrichment from review orchestration

- Status: accepted
- Context: `src/core/review.ts` is a high-churn, high-complexity hotspot. `computeReview` still mixed repository orchestration with changed-file enrichment for added, removed, and modified files.
- Decision: Move changed-file enrichment into private helper functions that index hotspot risk and append added/removed/modified review file records while preserving existing sorting and output fields.
- Consequences: Review output remains schema-compatible, but future changes to changed-file metadata can be reviewed in focused helpers instead of the main review orchestration path.
- Verification: `npm run test -- tests/core/review.test.ts tests/core/reviewTier.test.ts tests/core/reviewPublicSurface.test.ts`.

## 2026-06-16: Surface report controls in Markdown artifacts

- Status: accepted
- Context: Scoped/redacted issue data flowed into Markdown outputs, but Markdown artifacts did not state that report controls were active. Reviewers could not distinguish an intentionally scoped or redacted Markdown artifact from an ordinary short report.
- Decision: Add a path-safe report-controls banner to `analyze`, `doctor`, and `ci` Markdown output when `--report-policy`, `--report-scope`, or `--redact-paths` activates export controls.
- Consequences: Markdown artifacts can prove scope/redaction was applied without exposing the requested scope paths. JSON/SARIF `reportControls` metadata remains unchanged.
- Verification: `npm run test -- tests/reporters/markdownAnalysisReporter.test.ts tests/reporters/markdownReporter.test.ts -t "report controls"`.

## 2026-06-16: Use uv.lock as Python upgrade current-version evidence

- Status: accepted
- Context: `uv.lock` was already recognized as a Python lockfile presence signal, but upgrade previews did not parse resolved versions from it. uv projects therefore had weaker offline evidence than Poetry and Pipenv projects.
- Decision: Parse `uv.lock` `[[package]]` blocks with the same local TOML package-block parser used for Poetry and feed those versions into Python upgrade preview current-version fields.
- Consequences: `projscan upgrade <python-package>` can report `installed`, `latest`, `drift`, and `installedSource: "uv.lock"` for uv-managed projects without querying PyPI, changing npm registry behavior, or adding a TOML dependency.
- Verification: `npm run test -- tests/core/languages/pythonManifests.test.ts tests/core/upgradePreview.test.ts -t "uv\\.lock|parseUvLock"`.

## 2026-06-16: Treat Koa header accessors as gated request sources

- Status: accepted
- Context: Koa header properties were detected as framework request sources, but the common `ctx.get(...)` / `ctx.request.get(...)` accessors stayed invisible even inside Koa handlers. Broadly treating every `get` call as a source would create noisy helper false positives.
- Decision: Add `koa.ctx.get` and `koa.ctx.request.get` as framework request sources only when a Koa import, Koa handler call context, and Koa context parameter are all present.
- Consequences: `projscan dataflow` can report Koa header accessor input flowing into database sinks, while same-file helper functions with `ctx.get(...)` remain quiet unless they are actually passed as Koa handlers.
- Verification: `npm run test -- tests/core/dataflow.test.ts -t "Koa header accessor"`.

## 2026-06-16: Isolate per-file hotspot assembly behind a tested helper

- Status: accepted
- Context: `src/core/hotspotAnalyzer.ts` remains a high-churn, high-complexity roadmap maintainability target. The dense per-file mapping inside `analyzeHotspots` combined churn, author, issue, coverage, complexity, reason, and score assembly in one block, making reviewer checks harder than necessary.
- Decision: Extract the per-file hotspot object assembly into an internal helper and cover the emitted hotspot fields through deterministic analyzer tests while preserving the existing scoring, reason text, ranking, and report schema.
- Consequences: Hotspot behavior remains unchanged, but future changes to author concentration, coverage penalties, or complexity fallback can be tested without constructing a git-backed repository fixture.
- Verification: `npm run test -- tests/core/hotspotAnalyzer.test.ts`.

## 2026-06-16: Use Pipfile.lock as Python upgrade current-version evidence

- Status: accepted
- Context: Python upgrade previews could detect that `Pipfile.lock` existed, but did not parse exact resolved versions from it. That made previews less useful for Pipenv projects even though the local lockfile already contains offline current-version evidence.
- Decision: Parse exact `==` / `===` versions from `Pipfile.lock` `default` and `develop` sections and feed them into the existing Python upgrade preview current-version fields.
- Consequences: `projscan upgrade <python-package>` can report `installed`, `latest`, `drift`, and `installedSource: "Pipfile.lock"` for Pipenv projects without contacting PyPI or changing npm registry behavior.
- Verification: `npm run test -- tests/core/languages/pythonManifests.test.ts tests/core/upgradePreview.test.ts tests/mcp/pythonUpgradeFallback.test.ts`, `npm run lint`, and `npm run typecheck`.

## 2026-06-16: Carry scoped export controls into empty and SARIF evidence

- Status: accepted
- Context: Scoped/redacted report controls filtered JSON analysis evidence, but `analyze --format sarif` rendered the original issue list instead of the scoped/redacted one. Empty scoped artifacts also lacked an explicit signal that report controls had been applied, and issue message text could still contain raw file paths even when locations were redacted.
- Decision: Add path-safe `reportControls` metadata to JSON and SARIF exports when report controls are active, render analyze SARIF from the scoped/redacted issue list, and redact scoped issue paths inside title, description, and suggested-action text with the same stable labels used for locations.
- Consequences: Partner/security/review artifacts can prove scope and redaction were active without exposing raw file paths, including zero-result SARIF/doctor outputs. Existing report fields stay additive and direct paths are not included in metadata.
- Verification: `npm run test -- tests/core/reportScope.test.ts tests/reporters/sarifReporter.test.ts tests/reporters/jsonReporter.test.ts`, `npm run test -- tests/cli/formatHandling.test.ts -t "scoped and redacted report controls"`, `npm run lint`, `npm run typecheck`, and `npm run build`.

## 2026-06-16: Preserve object-argument route context for Fastify dataflow

- Status: accepted
- Context: Fastify `app.route({ handler })` handlers are common route definitions, but the AST collector only attached `contextualCallSite` to direct callback arguments. Functions nested inside object arguments lost the `app.route` context, so framework source detection stayed quiet even when `request.body` reached a database sink.
- Decision: Propagate an already-known call context through argument-container children, add Fastify route-option dataflow coverage, and bump the graph cache version so stale cached function metadata is rebuilt.
- Consequences: `projscan dataflow` detects Fastify object-option route handlers with the same receiver-gated source rules as shorthand handlers, while arbitrary object functions outside route calls remain unclassified.
- Verification: `npm run test -- tests/core/ast.references.test.ts tests/core/dataflow.test.ts tests/core/indexCache.test.ts tests/core/indexCache.python.test.ts`, `npm run lint`, and `npm run typecheck`.

## 2026-06-16: Add coordination evidence blocks to swarm reports

- Status: accepted
- Context: The roadmap requires swarm coordination evidence to name the active command path, current worktree state, and local-only validation workflow. `projscan collisions` and `projscan coordinate` already reported counts and readiness, but the JSON did not carry the workflow proof agents need in handoffs.
- Decision: Add an additive `evidence` block to collision and coordination summaries with the active command, local-only source signals, current worktree state, validation workflow, and session-memory separation note. Keep existing verdict, count, worktree, and collision fields unchanged.
- Consequences: CLI and MCP callers can cite coordination proof directly from the JSON report without inferring which command produced it or whether it mixed remembered session context with current Git/worktree evidence.
- Verification: `npm run test -- tests/core/collisionDetector.test.ts tests/core/coordination.test.ts tests/mcp/coordinateWatch.test.ts`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm exec projscan -- collisions --format json`, `npm exec projscan -- coordinate --format json`, `npm exec projscan -- agent-brief --format json`, `npm exec projscan -- release-train --format json`, and `npm exec projscan -- bug-hunt --format json`.

## 2026-06-16: Ignore prohibited release actions when routing autonomous work

- Status: accepted
- Context: A no-release autonomous roadmap instruction such as `do not release publish tag push merge deploy or bump version` was routed to `projscan_release_train` because the intent router counted prohibited action words as positive release intent.
- Decision: Detect prohibited release/publish/deploy/tag wording and prohibited version-bump wording before route scoring. Suppress only the affected release-train and upgrade keywords, preserving affirmative release-readiness and package-upgrade prompts.
- Consequences: Mission Control keeps no-release autonomous implementation loops on workplan/preflight paths while release, publish, deploy, push, merge, and version-bump actions remain blocked by the review gate.
- Verification: `npm run test -- tests/core/intentRouter.test.ts -t "prohibited release actions|improve next|product-planning|release readiness|release train|package upgrade"`, `npm run test -- tests/core/start.test.ts -t "no-release autonomous roadmap intents|autonomous continuation|infers bug-hunt and release workflows|build-next|improve next|product-planning|explicit mode overrides"`, `npm run typecheck`, `npm run build`, `npm exec projscan -- start --intent "continue autonomous no-release roadmap validation implementation; do not release publish tag push merge deploy or bump version" --format json`, and `npm exec projscan -- bug-hunt --format json`.

## 2026-06-16: Track qualified member reads for Koa dataflow precision

- Status: accepted
- Context: Koa request fields are read as qualified context members such as `ctx.request.body`, `ctx.query`, and `ctx.headers`, while the existing framework source matcher only had reliable bare-reference or member-call evidence.
- Decision: Add per-function qualified `memberReferences` to the AST graph cache and use them only inside framework-gated Koa handler detection. Koa sources require Koa/router imports, a handler call context, and a context-shaped parameter. Line-qualified taint node identity prevents multiple inline anonymous handlers in one file from replacing each other internally.
- Consequences: `projscan dataflow` can detect Koa body/query/params/header data into default database sinks without treating ordinary ctx-shaped helpers or `ctx.body` response writes as request sources. The index cache version is bumped so stale cache entries do not omit qualified member reads, while public flow names remain unchanged.
- Verification: `npm run test -- tests/core/ast.references.test.ts tests/core/dataflow.test.ts`, `npm run typecheck`, `npm run lint`, and `npm run build`.

## 2026-06-16: Use local Python lockfile evidence in upgrade previews

- Status: accepted
- Context: Python upgrade previews reported declarations and importers, but left `installed`, `latest`, and `drift` empty even when local lockfiles or pinned requirements already recorded a current version.
- Decision: Add offline current-version evidence from Poetry lock package blocks and pinned root `requirements*.txt` entries. Reuse existing `installed`, `latest`, and `drift` fields, and add optional `installedSource` / `installedLine` fields to identify the source line.
- Consequences: Python previews remain local-only and PyPI-free while becoming useful for release owners comparing declared intent against resolved local evidence. Broader lockfile formats stay deferred until there is user demand.
- Verification: `npm run test -- tests/core/upgradePreview.test.ts tests/core/languages/pythonManifests.test.ts tests/reporters/consoleUpgradeReporter.test.ts tests/reporters/markdownUpgradeReporter.test.ts`, `npm run typecheck`, `npm run lint`, and `npm run build`.

## 2026-06-16: Add named report policy presets for shareable evidence

- Status: accepted
- Context: Scoped and redacted report exports are useful for partner, security, and release-review artifacts, but repeated raw `--report-scope` / `--redact-paths` flags are easy for teams and agents to drift.
- Decision: Add additive `.projscanrc` `reportPolicies.<name>` presets with `reportScope` and `redactPaths`, selected by `--report-policy <name>` on `analyze`, `doctor`, and `ci`. Direct `--report-scope` and `--redact-paths` flags override the selected preset for one run.
- Consequences: Teams can reuse a stable evidence-export shape without changing JSON report schemas, reporter plugins, or existing direct flags. Unknown policy names fail with a clear diagnostic before scanning.
- Verification: `npm run test -- tests/core/reportScope.test.ts tests/utils/config.test.ts tests/types/public-config-types.test.ts`, task AgentLoop verification, and a built CLI smoke for `analyze --report-policy` plus unknown-policy failure.

## 2026-06-16: Prepare 4.4.0 release candidate and clear npm audit gate

- Status: accepted
- Context: Release prep found that `projscan@4.3.1` was already published/tagged and `npm run security:release-gate` failed on npm audit advisories in the dev test chain (`vite`/`esbuild`) and the optional semantic-search test dependency chain (`protobufjs` through `@xenova/transformers`).
- Decision: Prepare the next candidate as `4.4.0`, refresh release metadata, keep AgentLoopKit and AgentFlight as local dev harness dependencies, update transitive protobuf packages through the lockfile, and upgrade the direct dev dependency `vite` to `^8.0.16`, which is within the existing `vitest@4.1.8` supported peer range.
- Consequences: The release security gate no longer carries npm audit vulnerabilities, the dev install graph no longer pulls the vulnerable esbuild chain through Vite, and the version candidate cannot be published until the owner approves tag/publish actions.
- Verification: `npm run security:release-gate`, `npm ls vite esbuild rolldown protobufjs @xenova/transformers onnxruntime-web onnx-proto`, and the full release verification matrix before approval.

## 2026-06-16: Extract dogfood and trial public type modules

- Status: accepted
- Context: `src/types.ts` still carried the dogfood, feedback, and trial public contracts inline, keeping a high-churn compatibility barrel large after earlier focused type-module extractions.
- Decision: Move those contracts into `src/types/dogfood.ts` and `src/types/trial.ts`, keep `src/types.ts` as the legacy re-export surface, and keep the package entrypoint covered through its type-only star re-export.
- Consequences: Core and CLI dogfood/feedback/trial code can import focused public contracts directly, while existing TypeScript users can continue importing the same names from `src/types.js` or the package entrypoint.
- Verification: `npm run test -- tests/types/public-dogfood-trial-types.test.ts`, `npm run typecheck:public-types`, focused dogfood/feedback/trial core and CLI tests, `npm run typecheck`, `npm run build`, `npm run lint`, `git diff --check`, `npm exec agentflight -- verify`, and focused `projscan file` scans.

## 2026-06-16: Extract understand public type module

- Status: accepted
- Context: `src/types.ts` still carried the `Understand*` public report contracts inline, mixing repo-understanding API shapes into the remaining compatibility barrel.
- Decision: Move those contracts into `src/types/understand.ts`, keep `src/types.ts` as the legacy re-export surface, and keep package entrypoint compatibility through the type-only star re-export.
- Consequences: Understand core, CLI, MCP, and start-route code can import focused report contracts directly, while existing TypeScript users can continue importing the same names from `src/types.js` or the package entrypoint.
- Verification: `npm run test -- tests/types/public-understand-types.test.ts`, `npm run typecheck:public-types`, focused understand core/CLI/MCP tests, start-route tests, `npm run typecheck`, `npm run build`, `npm run lint`, `git diff --check`, `npm exec agentflight -- verify`, and focused `projscan file` scans.

## 2026-06-16: Extract review public type module

- Status: accepted
- Context: `src/types.ts` still carried the `Review*` public report contracts inline after the previous focused type-module extractions.
- Decision: Move those contracts into `src/types/review.ts`, keep `src/types.ts` as the legacy re-export surface, and keep package entrypoint compatibility through the type-only star re-export.
- Consequences: Review core logic, intent/preflight helpers, MCP review-watch, and reporters can import focused review contracts directly, while existing TypeScript users can continue importing the same names from `src/types.js` or the package entrypoint.
- Verification: `npm run test -- tests/types/public-review-types.test.ts`, `npm run typecheck:public-types`, focused review/intent/MCP/reporter tests, `npm run typecheck`, `npm run build`, `npm run lint`, `git diff --check`, `npm exec agentflight -- verify`, and focused `projscan file` scans.

## 2026-06-15: Use local AgentLoopKit and AgentFlight for agent work

- Status: accepted
- Context: Agent work in this repo needs repeatable task contracts, verification evidence, and local handoff artifacts without requiring global npm installs.
- Decision: Keep AgentLoopKit and AgentFlight as local development dependencies and invoke them through `npm exec agentloop -- ...` and `npm exec agentflight -- ...`.
- Consequences: AgentLoop task contracts, reports, handoffs, and AgentFlight verification evidence become the normal review trail for agent-authored changes. Runtime evidence stays local unless a reviewer or CI explicitly attaches it.
- Verification: `npm exec agentloop -- status`, `npm exec agentloop -- check-gates`, and `npm exec agentflight -- verify`.

## 2026-06-15: Keep persona and research guidance in docs

- Status: accepted
- Context: Agent decisions need explicit team and user personas so prioritization does not rely on hidden assumptions.
- Decision: Keep team/user personas and current research notes in `docs/PERSONAS.md`.
- Consequences: Future agent tasks should reference the documented personas when choosing between speed, reviewability, safety, and adoption tradeoffs.
- Verification: Documentation review plus the task handoff for any persona-driven behavior change.

## 2026-06-15: Treat same-SHA dirty worktrees as reviewable

- Status: accepted
- Context: `projscan review` could return an empty same-SHA review even when the worktree contained unstaged, staged, or untracked changes.
- Decision: Only use the same-SHA fast empty review path when the worktree is clean.
- Consequences: Dirty local work now appears in review and preflight evidence instead of being hidden by matching base/head refs.
- Verification: `npm run test -- tests/core/review.test.ts -t "reviews dirty worktree changes when base and head resolve to the same commit"` and `npm exec projscan -- preflight --mode before_commit --format json`.

## 2026-06-15: Avoid false direct-test confidence for directory-only changed paths

- Status: accepted
- Context: `projscan understand --view verify` could treat directory-like changed paths as having direct tests because an empty basename token matched test files.
- Decision: Direct-test matching now requires a meaningful file token; directory-only paths fall back to a verification gap.
- Consequences: Agent runtime directories and other non-file paths no longer create false test confidence.
- Verification: `npm run test -- tests/core/understand.test.ts -t "does not treat directory-only changed paths as directly tested"`.

## 2026-06-15: Add actionable file context to preflight-derived bug-hunt findings

- Status: accepted
- Context: `projscan bug-hunt --format json` could rank a preflight release signal first while returning `files: []`, even though preflight already carried bounded changed-file evidence.
- Decision: Preflight-derived bug-hunt findings use bounded preflight changed files when the reason itself has no file. Reason-level `file` attribution remains the highest-confidence source.
- Consequences: `fixQueue`, `topSuspects`, and `fixFirst` can route preflight findings to changed files without changing the JSON schema.
- Verification: `npm run test -- tests/core/bugHunt.test.ts` and `npm exec projscan -- bug-hunt --format json`.

## 2026-06-15: Order preflight fallback files for reviewer usefulness

- Status: accepted
- Context: Fallback changed-file evidence can include local runtime directories before source, tests, package, docs, or config files because git status output is sorted.
- Decision: Bug-hunt preflight fallback files move local agent runtime directories after reviewable project files and omit projscan self-generated runtime paths when better context exists.
- Consequences: `fixFirst.files` remains bounded and schema-compatible, but reviewers see project files before local agent runtime directories.
- Verification: `npm run test -- tests/core/bugHunt.test.ts` and `npm exec projscan -- bug-hunt --format json`.

## 2026-06-15: Label release-scale bug-hunt signals as sign-off actions

- Status: accepted
- Context: Release-scale preflight findings are actionable review gates, but they are not always concrete code defects. Calling them generic fix targets can mislead reviewers when preflight already says manual sign-off is the expected resolution.
- Decision: Keep release-scale preflight findings in the bug-hunt action queue, but title them as release sign-off review and summarize release-only queues as manual sign-off actions.
- Consequences: Existing JSON fields and ordering remain compatible while the wording better matches the underlying release gate.
- Verification: `npm run test -- tests/core/bugHunt.test.ts -t "bug hunt orders preflight fallback files by review usefulness"`.

## 2026-06-15: Align release evidence with bug-hunt sign-off wording

- Status: accepted
- Context: Evidence packs reuse bug-hunt output for release approval, but the bug-hunt artifact still described release-scale sign-off entries as generic fix targets.
- Decision: Derive the bug-hunt artifact queue label from the bug-hunt summary so release-only queues appear as manual sign-off actions.
- Consequences: Evidence-pack schema, verdicts, and ordering stay unchanged while reviewer-facing wording remains consistent across bug-hunt and release evidence.
- Verification: `npm run test -- tests/core/releaseEvidence.test.ts -t "evidence pack labels release-scale bug-hunt queues as sign-off actions"`.

## 2026-06-15: Align release-train bug-hunt wording with action queues

- Status: accepted
- Context: The 2.4.x release train still said bug-hunt output should name the first fix target, but bug-hunt queues can now contain release sign-off actions.
- Decision: Describe the 2.4.x success criterion as the first prioritized bug-hunt action and proof commands.
- Consequences: Release-train JSON remains schema-compatible while product planning no longer implies every bug-hunt queue entry is a concrete code fix.
- Verification: `npm run test -- tests/core/releaseTrain.test.ts -t "release train describes bug-hunt proof as prioritized actions"`.

## 2026-06-15: Align public bug-hunt wording with action queues

- Status: accepted
- Context: CLI, MCP, route, README, and adoption copy still described bug-hunt as a fix queue even though release-scale entries can be manual sign-off actions.
- Decision: Describe the public bug-hunt surface as a ranked or prioritized action queue while keeping the `fixQueue` JSON field stable for compatibility.
- Consequences: Public text no longer implies every queue entry is a code defect, and existing machine consumers do not need a migration.
- Verification: `npm run test -- tests/mcp/releaseTrainBugHunt.test.ts tests/core/releaseTrain.test.ts tests/core/intentRouter.test.ts tests/cli/releaseTrainBugHunt.test.ts -t "bug_hunt|bug-hunt|prioritized action|release train describes"`.

## 2026-06-15: Prioritize risk-relevant files in bug-hunt sign-off routing

- Status: accepted
- Context: Release-scale bug-hunt sign-off actions used git-order fallback files, which could place README or local config before package metadata and source changes.
- Decision: Keep the `fixQueue` schema and ranking stable, but sort fallback context files by review usefulness: package metadata, lockfiles, source, tests, docs, remaining config, then agent runtime paths.
- Consequences: Reviewers see the files most likely to explain dependency or source risk first while runtime harness directories still trail project files.
- Verification: `npm run test -- tests/core/bugHunt.test.ts tests/cli/releaseTrainBugHunt.test.ts -t "preflight fallback files"`.

## 2026-06-15: Preserve nested untracked file context for sign-off routing

- Status: accepted
- Context: Git porcelain output collapsed untracked workspace directories such as `packages/`, which prevented bug-hunt sign-off routing from seeing package metadata inside the directory.
- Decision: Request full untracked file paths from git status and use data-driven path ranks for package metadata, source, tests, docs, config, and agent runtime paths.
- Consequences: Monorepo package metadata can be prioritized in release sign-off queues without changing JSON field names or preflight semantics.
- Verification: `npm run test -- tests/utils/changedFiles.test.ts -t "expands untracked nested directories"` and `npm run test -- tests/core/bugHunt.test.ts tests/cli/releaseTrainBugHunt.test.ts -t "preflight fallback files"`.

## 2026-06-15: Surface local AgentLoop harnesses in start guidance

- Status: accepted
- Context: Agent-orchestrating engineers need `projscan start` to point at the repo's existing task-contract harness before they edit code.
- Decision: When `AGENTLOOP.md` or `agentloop.config.json` exists at the repo root, add a read-only coordination hint that tells agents to run `npm exec agentloop -- status`.
- Consequences: `StartReport.coordinationHints` gains one additive entry in AgentLoop-enabled repos, and existing Mission Control guardrail/proof rendering exposes the same local status command. No AgentLoop command is executed and no runtime dependency is imported.
- Verification: `npm run test -- tests/core/start.test.ts -t "AgentLoop"` and `npm run test -- tests/cli/start.test.ts -t "AgentLoop"`.

## 2026-06-15: Surface local AgentFlight verification in start guidance

- Status: accepted
- Context: Platform and release owners need `projscan start` to show the repo's local AgentFlight verification harness when it exists, so proof collection is visible before handoff.
- Decision: When `.agentflight/config.json` exists at the repo root, add a read-only coordination hint that tells agents to run `npm exec agentflight -- verify`.
- Consequences: `StartReport.coordinationHints` gains one additive entry in AgentFlight-enabled repos, and existing Mission Control guardrail/proof rendering exposes the same local verification command. No AgentFlight command is executed and no runtime dependency is imported.
- Verification: `npm run test -- tests/core/start.test.ts -t "AgentFlight"` and `npm run test -- tests/cli/start.test.ts -t "AgentFlight"`.

## 2026-06-15: Keep start harness guidance in a focused helper

- Status: accepted
- Context: `src/core/start.ts` is a hotspot, and AgentLoop plus AgentFlight guidance added repeated root-file detection and proof-priority rules to it.
- Decision: Move repo-local harness detection and harness proof prioritization into `src/core/startHarness.ts`.
- Consequences: `start.ts` keeps Mission Control orchestration while harness-specific rules have focused tests and can evolve without expanding the core start module.
- Verification: `npm run test -- tests/core/startHarness.test.ts` and `npm run test -- tests/core/start.test.ts -t "AgentLoop|AgentFlight"`.

## 2026-06-15: Limit review export contract changes to public entrypoints

- Status: accepted
- Context: `projscan review` treated every added or modified module export as a public contract change, which created false public API noise for internal helper modules such as `src/core/startHarness.ts`.
- Decision: Export-level contract changes are reported only for files reachable from package entrypoints and common source counterparts such as `dist/index.js` to `src/index.ts`; package entrypoint field changes remain reported separately.
- Consequences: Internal helper exports stay visible through changed-file and risk evidence without being labeled public API changes, while entrypoint exports still produce `contractChanges`.
- Verification: `npm run test -- tests/core/review.test.ts`.

## 2026-06-15: Treat entrypoint re-exports as public review surface

- Status: accepted
- Context: A package entrypoint can publish a module by re-exporting it, so limiting `contractChanges` to the entrypoint file alone can miss additive public exports.
- Decision: Expand the review public-file set by following relative, value re-export edges from package entrypoint source files in the base and head graphs.
- Consequences: `projscan review` reports added exports in directly or transitively re-exported local modules, while ordinary internal imports and type-only re-exports do not become public contract changes.
- Verification: `npm run test -- tests/core/review.test.ts`.

## 2026-06-15: Map declaration entrypoints back to TypeScript source

- Status: accepted
- Context: Packages can expose only a declaration entrypoint such as `dist/index.d.ts`, and `projscan review` needs to connect that public contract back to the source file that emits it.
- Decision: Treat `.d.ts` entrypoint candidates as public surface matches for the corresponding `.ts` and `.tsx` source files after the existing `dist/` to `src/` mapping.
- Consequences: Declaration-only packages get additive export contract-change evidence for `src/index.ts`, without adding TypeScript emit analysis or a project resolver.
- Verification: `npm run test -- tests/core/review.test.ts`.

## 2026-06-15: Keep review public-surface logic in a focused helper

- Status: accepted
- Context: `src/core/review.ts` already owns verdicting, dependency changes, taint/dataflow signals, and report assembly. Adding entrypoint, declaration, and re-export surface logic there made the review hotspot harder to test directly.
- Decision: Move public-surface file-set computation to `src/core/reviewPublicSurface.ts` and keep `review.ts` responsible for turning that file set into `contractChanges`.
- Consequences: Public-surface path rules have focused unit tests, and `review.ts` keeps the higher-level review orchestration boundary.
- Verification: `npm run test -- tests/core/reviewPublicSurface.test.ts tests/core/review.test.ts`.

## 2026-06-15: Label review release-scale blocks as manual sign-off

- Status: accepted
- Context: `projscan review` can block on broad release-scale signals such as high changed-file risk while reporting no concrete cycle, risky-function, contract, taint, or dataflow defects. Downstream bug-hunt output already calls this a manual sign-off action, but raw review summaries did not.
- Decision: Add one review summary line for block verdicts caused by release-scale risk signals only, without changing verdict values, thresholds, schemas, or existing risk/dependency bullets.
- Consequences: Release owners can distinguish manual approval gates from concrete defects directly in `projscan review`, while machine consumers keep the same fields and verdicts.
- Verification: `npm run test -- tests/core/review.test.ts -t "labels release-scale review blocks as manual sign-off"` and `npm run test -- tests/core/review.test.ts -t "reports exported symbol contract changes"`.

## 2026-06-15: Prefer task-only AgentLoop verification for focused slices

- Status: accepted
- Context: `agentloop verify --task-commands` runs configured repo commands as well as task commands. In this repo, that can start the broad `npm run test` suite even when the task contract already lists focused proof commands.
- Decision: Keep `agentloop.config.json` broad commands intact, but instruct agents to use `--task-commands --only-task-commands` for focused task contracts and reserve plain `--task-commands` for explicit full-suite or release-grade verification.
- Consequences: AgentLoop reports can stay bounded to the task contract by default while full configured verification remains available when intentionally requested.
- Verification: `npm exec agentloop -- doctor`, `npm exec agentloop -- status`, and `git diff --check`.

## 2026-06-15: Deduplicate bug-hunt release sign-off wording

- Status: accepted
- Context: Bug-hunt release sign-off findings embed review summary text. Once review summaries include `Manual release sign-off required`, the preflight release wrapper could repeat the same instruction in the same `why` text.
- Decision: Preserve release sign-off findings and review summary detail, but omit the extra wrapper sign-off sentence when the embedded review summary already carries manual release sign-off wording.
- Consequences: `fixQueue`, verdicts, ranking, and file ordering remain stable while release-owner handoffs stay less repetitive.
- Verification: `npm run test -- tests/core/bugHunt.test.ts -t "orders preflight fallback files by review usefulness"`.

## 2026-06-15: Strengthen product-planning intent routing

- Status: accepted
- Context: Dogfooding `projscan start --intent "what should we build next"` routed to workplan, but only with medium confidence because the route matched `next` alone.
- Decision: Add guarded product-planning vocabulary to the deterministic workplan route, requiring a planning signal plus a product/build signal before those terms count.
- Consequences: Broad product-direction prompts route to high-confidence workplan evidence, while quick-win and low-risk improvement prompts continue to route to bug-hunt.
- Verification: `npm run test -- tests/core/intentRouter.test.ts -t "product-planning|quick-win"` and `npm run test -- tests/core/start.test.ts -t "product-planning"`.

## 2026-06-15: Infer bug-hunt mode for product-planning workplans

- Status: accepted
- Context: After product-planning prompts routed to high-confidence workplan, Mission Control still defaulted the workflow mode to `before_edit`, so the primary command asked for a generic orientation workplan.
- Decision: When the primary route is a high-confidence workplan with both planning and product/build keywords, infer `bug_hunt` mode and pass that resolved mode into the routed workplan action.
- Consequences: `projscan start --intent "what should we build next"` now returns `projscan workplan --mode bug_hunt --format json`, while impact and feature-placement intents keep their existing mode behavior.
- Verification: `npm run test -- tests/core/start.test.ts -t "build-next|feature-placement|intent routes but workflow mode defaults"`.

## 2026-06-15: Clarify build-next product-planning criteria

- Status: accepted
- Context: Build-next Mission Control selected the right `bug_hunt` workplan, but its success criteria still came from generic workplan fallback text.
- Decision: For high-confidence product-planning workplan routes resolved to `bug_hunt`, add explicit done criteria for selecting a prioritized slice, attaching runnable verification, and deferring other product ideas deliberately.
- Consequences: Product-planning handoffs tell agents what decision the workplan should produce without changing `StartReport` schema, routing, or workplan generation. Explicit mode overrides keep their resolved workplan mode and do not receive bug-hunt-specific wording.
- Verification: `npm run test -- tests/core/start.test.ts -t "build-next|feature-placement|intent routes but workflow mode defaults|explicit mode overrides product planning"`.

## 2026-06-15: Route broad improve-next planning to bug-hunt

- Status: accepted
- Context: Dogfooding `projscan start --intent "what should we improve next"` returned only a medium-confidence `next` workplan match, so Mission Control produced a generic before-edit workplan.
- Decision: Treat `improve` or `improvement` plus `next` as a guarded bug-hunt opportunity context, but suppress that shortcut and generic `next` planning matches when protected release, dependency, or safety tokens are present.
- Consequences: Broad improvement planning now returns an actionable `projscan bug-hunt --format json` queue, while explicit technical variants such as tests, performance, release, dependencies, and safety keep their specialized routes.
- Verification: `npm run test -- tests/core/intentRouter.test.ts -t "improve next|quick-win|product-planning"` and `npm run test -- tests/core/start.test.ts -t "improve next|quick-win|build-next"`.

## 2026-06-15: Honor autonomous continuation intent in Mission Control

- Status: accepted
- Context: Agent-orchestrating engineers sometimes give an explicit standing instruction to continue bounded implementation work until told to stop. Mission Control previously required reviewer approval before every next slice, even for those intents, while also protecting release and git actions.
- Decision: Detect autonomous continuation wording in `start --intent` and remove only `next_slice` from the review gate's blocked actions. Release, publish, deploy, push, merge, and version bump still require explicit reviewer approval.
- Consequences: Autonomous agents can keep moving through bounded, verified implementation slices without changing the `StartReport` schema or relaxing release safety gates. Normal intents keep the conservative next-slice approval gate.
- Verification: `npm run test -- tests/core/start.test.ts -t "allows autonomous continuation intents to keep bounded slice work unblocked"` and `npm run test -- tests/core/start.test.ts -t "start exposes a Mission Control task card for MCP and JSON clients"`.

## 2026-06-15: Extract Mission Control review gate helper

- Status: accepted
- Context: `src/core/start.ts` is the top hotspot and owned review-gate policy, review-decision rendering, worktree evidence, runbook generation, task cards, routing, and proof orchestration in one module.
- Decision: Move review-gate construction, proof shaping, and review-decision formatting into `src/core/startReviewGate.ts`, leaving `start.ts` to orchestrate Mission Control.
- Consequences: Review-gate behavior has a focused module boundary without changing `StartReport` schema, markdown wording, autonomous policy, or release safety gates.
- Verification: `npm run test -- tests/core/start.test.ts -t "allows autonomous continuation intents to keep bounded slice work unblocked"` and `npm run test -- tests/core/start.test.ts -t "start exposes a Mission Control task card for MCP and JSON clients"`.

## 2026-06-15: Extract Mission Control runbook rendering

- Status: accepted
- Context: After review-gate extraction, `src/core/start.ts` still mixed Mission Control orchestration with runbook and task-card Markdown rendering.
- Decision: Move runbook and task-card construction/rendering into `src/core/startRunbook.ts`, leaving execution-plan and resume state-machine logic in `start.ts`.
- Consequences: Start orchestration is smaller while runbook/task-card output stays covered by existing Mission Control characterization tests.
- Verification: `npm run test -- tests/core/start.test.ts -t "start exposes a Mission Control task card for MCP and JSON clients"` and `npm run test -- tests/core/start.test.ts -t "allows autonomous continuation intents to keep bounded slice work unblocked"`.

## 2026-06-15: Extract CLI Mission Control bundle helpers

- Status: accepted
- Context: `src/cli/commands/start.ts` mixed command option dispatch with Mission Control bundle file manifests, artifact writing, proof-log scaffolding, and shell script generation.
- Decision: Move Mission Control bundle construction and script rendering into `src/cli/commands/startMissionBundle.ts`, while keeping CLI option registration, shortcut dispatch, and local command selection helpers in `start.ts`.
- Consequences: The CLI command file is smaller and easier to review, while existing save-mission bundle artifacts, JSON output, script behavior, and shortcut behavior remain covered by characterization tests.
- Verification: `npm run test -- tests/cli/start.test.ts -t "writes a Mission Control bundle"`, `npm run test -- tests/cli/start.test.ts -t "Mission Control bundle as JSON"`, `npm run test -- tests/cli/start.test.ts`, and `npm run typecheck`.

## 2026-06-15: Extract CLI start console rendering

- Status: accepted
- Context: After bundle extraction, `src/cli/commands/start.ts` still mixed command dispatch with human console rendering for Mission Control, execution plans, review gates, resume checklists, adoption loops, and risks.
- Decision: Move human-readable start rendering into `src/cli/commands/startConsole.ts`, with `start.ts` passing the already selected proof commands and reviewer replies into the renderer.
- Consequences: CLI command dispatch stays in `start.ts`, rendering logic has a focused module boundary, and existing console output remains covered by `tests/cli/start.test.ts`.
- Verification: `npm run test -- tests/cli/start.test.ts -t "start console"`, `npm run test -- tests/cli/start.test.ts`, and `npm run typecheck`.

## 2026-06-15: Extract CLI start output dispatch

- Status: accepted
- Context: After console rendering extraction, `src/cli/commands/start.ts` still carried every computed-report output branch for JSON mode, Mission Control shortcuts, bundle writing, and default console output.
- Decision: Move computed-report output dispatch and shortcut/bundle helper selection into `src/cli/commands/startOutput.ts`, leaving `start.ts` to register flags, parse mode, compute the report, and handle top-level command errors.
- Consequences: `start.ts` is a small command registration boundary while start output behavior remains covered by focused shortcut/bundle characterization tests and the full start CLI test file.
- Verification: `npm run test -- tests/cli/start.test.ts -t "next-command|next-tool-call|ready-tool-calls|proof-commands|checklist|resume-json|handoff-json|task-card|review-gate|review-policy|review-replies|runbook|mission-script|shortcuts|Mission Control bundle"`, `npm run test -- tests/cli/start.test.ts`, and `npm run typecheck`.

## 2026-06-15: Extract CLI command registration helper

- Status: accepted
- Context: `src/cli/index.ts` was a high-churn executable entrypoint that owned every command import and registration call directly.
- Decision: Move command registrar imports, ordering, and invocation into `src/cli/registerCommands.ts`, leaving `src/cli/index.ts` to call `registerCliCommands()` and `program.parse()`.
- Consequences: The executable entrypoint is small, the registrar order is explicit and test-covered, and public CLI command behavior remains unchanged.
- Verification: `npm run test -- tests/cli/registerCommands.test.ts`, `npm run typecheck`, `npm run build`, and `npm exec projscan -- file src/cli/index.ts --format json`.

## 2026-06-16: Extract Mission Control intent target parsing

- Status: accepted
- Context: `src/core/start.ts` still mixed Mission Control orchestration with natural-language target parsing for search, impact, file, package, issue, claim, and semantic-graph actions.
- Decision: Move target extraction, search-query normalization, semantic-graph query shaping, placeholder checks, and shell quoting into `src/core/startIntentTargets.ts`.
- Consequences: `start.ts` stays focused on report orchestration and action-plan assembly, while target parsing has direct characterization tests. The parser module remains large and can be split by domain in a later task.
- Verification: `npm run test -- tests/core/startIntentTargets.test.ts`, `npm run test -- tests/core/start.test.ts -t "search|impact|semantic graph|package|issue|auth token loader|rate limits|React Query|migrations|env var"`, `npm run typecheck`, `npm run build`, and `npm exec projscan -- file src/core/start.ts --format json`.

## 2026-06-16: Extract start CLI action handler

- Status: accepted
- Context: After output-dispatch extraction, `src/cli/commands/start.ts` was small but still owned command action execution, mode parsing, numeric option parsing, report computation wiring, and top-level error handling.
- Decision: Move start command action execution and option parsing into `src/cli/commands/startAction.ts`, leaving `start.ts` as a flag-registration boundary.
- Consequences: The high-churn public command file is 34 lines with cyclomatic complexity 1, while action behavior is directly unit-tested and the existing full CLI tests continue to cover public behavior.
- Verification: `npm run test -- tests/cli/startAction.test.ts`, `npm run test -- tests/cli/start.test.ts`, `npm run typecheck`, `npm run build`, and `npm exec projscan -- file src/cli/commands/start.ts --format json`.

## 2026-06-16: Extract Mission Control success criteria

- Status: accepted
- Context: `src/core/start.ts` still owned the high-complexity Mission Control success-criteria policy tree used in CLI, JSON, MCP handoff, review-gate, runbook, and task-card output.
- Decision: Move success-criteria generation and its shared route helpers into `src/core/startSuccessCriteria.ts`, using small resolver functions and rule tables instead of a single branch-heavy function.
- Consequences: `src/core/start.ts` loses the largest remaining policy tree without changing public `StartReport` schema or success-criteria wording. The new module has direct characterization tests for representative route branches.
- Verification: `npm run test -- tests/core/startSuccessCriteria.test.ts`, `npm run test -- tests/core/start.test.ts -t "successCriteria|Done When|build-next|auth token loader|npm scripts|local services|regression"`, `npm run typecheck`, `npm run build`, and `npm exec projscan -- file src/core/start.ts --format json`.

## 2026-06-16: Extract start mode resolution

- Status: accepted
- Context: `src/core/start.ts` still owned explicit/default workflow selection, routed-intent normalization, and intent-based mode inference for Mission Control.
- Decision: Move start mode resolution and route-match normalization into `src/core/startMode.ts`, preserving existing `mode`, `modeSource`, `modeReason`, and `StartRoutedIntent` shapes.
- Consequences: Mode inference has focused characterization tests and no longer adds complexity to the main `start.ts` orchestration file. Action-plan command generation remains in `start.ts` for a later bounded extraction.
- Verification: `npm run test -- tests/core/startMode.test.ts`, `npm run test -- tests/core/start.test.ts -t "infers|modeSource|modeReason|release workflows|safe to commit|what breaks|build-next|dataflow|regression"`, `npm run typecheck`, `npm run build`, and `npm exec projscan -- file src/core/start.ts --format json`.

## 2026-06-16: Extract start route action rendering

- Status: accepted
- Context: After mode extraction, `src/core/start.ts` still owned branch-heavy Mission Control route action args, command rendering, and route-specific follow-up plans.
- Decision: Move routed action rendering into `src/core/startRouteActions.ts`, with resolver tables for tool args and commands plus focused tests for user-facing command strings.
- Consequences: `src/core/start.ts` no longer owns routed command rendering, and its largest remaining complexity is Mission Control resume/cursor orchestration. The new helper preserves primary actions, ready actions, proof commands, shell escaping, and MCP args.
- Verification: `npm run test -- tests/core/startRouteActions.test.ts`, `npm run test -- tests/core/start.test.ts -t "primaryAction|readyActions|proofCommands|auth token loader|rate limits|React Query|migrations|env var|regression|safe to commit|PR comment|claim"`, `npm run typecheck`, `npm run build`, and `npm exec projscan -- file src/core/start.ts --format json`.

## 2026-06-16: Extract start resume state helpers

- Status: accepted
- Context: After route-action extraction, `src/core/start.ts` still owned Mission Control resume, checklist, proof-tool-call, follow-up, reference, and execution-cursor state assembly.
- Decision: Move resume and cursor state helpers into `src/core/startResume.ts`, with rule-table cursor selection and focused characterization tests for resume fields and proof tool-call parsing.
- Consequences: `src/core/start.ts` is smaller and no longer owns resume/cursor branching. Mission Control resume prompts, checklist entries, input bindings, follow-ups, remaining proof commands, and cursor reasons remain stable.
- Verification: `npm run test -- tests/core/startResume.test.ts`, `npm run test -- tests/core/start.test.ts -t "resume|checklist|execution|cursor|primaryAction|readyActions|proofCommands"`, `npm run typecheck`, `npm run build`, and `npm exec projscan -- file src/core/start.ts --format json`.

## 2026-06-16: Extract start execution plan builder

- Status: accepted
- Context: After resume extraction, `src/core/start.ts` still owned Mission Control execution-plan construction, action-to-step conversion, placeholder dependency wiring, proof-step projection, and summary text.
- Decision: Move execution-plan construction and action-readiness helpers into `src/core/startExecutionPlan.ts`, leaving `start.ts` to orchestrate Mission Control assembly.
- Consequences: `src/core/start.ts` no longer owns execution-plan phase construction. Phase order, step IDs, cursor selection, ready/input/follow-up/proof/done_when wiring, tool-call args, and summary text remain covered by focused and integration tests.
- Verification: `npm run test -- tests/core/startExecutionPlan.test.ts`, `npm run test -- tests/core/start.test.ts -t "executionPlan|resume|handoff|runbook|primaryAction|readyActions|proofCommands"`, `npm run typecheck`, `npm run build`, and `npm exec projscan -- file src/core/start.ts --format json`.

## 2026-06-16: Extract start mission policy helpers

- Status: accepted
- Context: After execution-plan extraction, `src/core/start.ts` still owned Mission Control policy helpers for status, why-now text, action-plan fallback, unresolved-input instructions, guardrails, proof commands, workflow selection, risk conversion, and summary text.
- Decision: Move Mission Control policy helpers into `src/core/startMissionPolicy.ts`, preserving the existing user-facing strings and command ordering.
- Consequences: `src/core/start.ts` is under 500 lines with no `projscan` potential issues, while policy behavior has focused characterization tests. Mission Control status, headline, whyNow, input instructions, guardrails, proof command ordering, workflow selection, risk conversion, and summary text remain stable.
- Verification: `npm run test -- tests/core/startMissionPolicy.test.ts`, `npm run test -- tests/core/start.test.ts -t "status|headline|whyNow|primaryAction|readyActions|proofCommands|guardrails|risk|summary"`, `npm run typecheck`, `npm run build`, and `npm exec projscan -- file src/core/start.ts --format json`.

## 2026-06-16: Extract start shortcut index helpers

- Status: accepted
- Context: After the core Mission Control extractions, `src/cli/commands/startOutput.ts` still mixed output dispatch with shortcut index construction, command quoting, ready tool-call compaction, ready proof fallback, and reviewer reply formatting.
- Decision: Move the shortcut/index helpers into `src/cli/commands/startShortcuts.ts`, keeping `startOutput.ts` focused on output-mode dispatch.
- Consequences: `src/cli/commands/startOutput.ts` drops from 429 to 284 lines while preserving `projscan start --shortcuts`, `--shortcuts-json`, ready tool calls, proof commands, mission-script context, and reviewer reply output. The extracted helper has focused characterization tests for command order, labels, shell quoting, dedupe, and fallback behavior.
- Verification: `npm run test -- tests/cli/startShortcuts.test.ts`, `npm run test -- tests/cli/start.test.ts -t "shortcuts|mission script|handoff prompt|ready tool calls"`, `npm run typecheck`, `npm run build`, and `npm exec projscan -- file src/cli/commands/startOutput.ts --format json`.

## 2026-06-16: Extract console review reporter

- Status: accepted
- Context: `src/reporters/consoleReporter.ts` is the top current hotspot and still owned PR review console rendering plus helper output for changed files, cycles, risky functions, dependency changes, verdicts, and unavailable-review messages.
- Decision: Move PR review console rendering into `src/reporters/consoleReviewReporter.ts` and re-export `reportReview` from `src/reporters/consoleReporter.ts`.
- Consequences: The public `reportReview` named export is preserved, while `consoleReporter.ts` drops from 1268 to 1162 lines and CC from 302 to 269. Review output behavior has focused characterization tests for verdicts, summaries, truncation, deltas, dependencies, and unavailable reports.
- Verification: `npm run test -- tests/reporters/consoleReviewReporter.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/reporters/consoleReporter.ts --format json`, and `npm exec projscan -- file src/reporters/consoleReviewReporter.ts --format json`.

## 2026-06-16: Extract console PR diff reporter

- Status: accepted
- Context: After review rendering moved out, `src/reporters/consoleReporter.ts` still owned PR structural diff console rendering and its modified-file delta helpers.
- Decision: Move PR structural diff console rendering into `src/reporters/consolePrDiffReporter.ts` and re-export `reportPrDiff` from `src/reporters/consoleReporter.ts`.
- Consequences: The public `reportPrDiff` named export is preserved, while `consoleReporter.ts` drops from 1162 to 1083 lines and CC from 269 to 249. PR diff output behavior has focused characterization tests for unavailable output, totals, sections, export/import lines, renames, and delta signs.
- Verification: `npm run test -- tests/reporters/consolePrDiffReporter.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/reporters/consoleReporter.ts --format json`, and `npm exec projscan -- file src/reporters/consolePrDiffReporter.ts --format json`.

## 2026-06-16: Extract console fix guidance reporter

- Status: accepted
- Context: After review and PR diff rendering moved out, `src/reporters/consoleReporter.ts` still owned fix-suggest and explain-issue console rendering plus shared line wrapping.
- Decision: Move fix guidance console rendering into `src/reporters/consoleFixGuidanceReporter.ts` and re-export `reportFixSuggest` and `reportExplainIssue` from `src/reporters/consoleReporter.ts`.
- Consequences: The public reporter named exports are preserved, while `consoleReporter.ts` drops from 1083 to 989 lines and CC from 249 to 217. Fix guidance output behavior has focused characterization tests for unmatched suggestions, synthetic suggestions, wrapping, locations, verification, related files, excerpts, related issues, similar fixes, and suggested actions.
- Verification: `npm run test -- tests/reporters/consoleFixGuidanceReporter.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/reporters/consoleReporter.ts --format json`, and `npm exec projscan -- file src/reporters/consoleFixGuidanceReporter.ts --format json`.

## 2026-06-16: Extract console impact reporter

- Status: accepted
- Context: After review, PR diff, and fix guidance rendering moved out, `src/reporters/consoleReporter.ts` still owned impact console rendering.
- Decision: Move impact console rendering into `src/reporters/consoleImpactReporter.ts` and re-export `reportImpact` from `src/reporters/consoleReporter.ts`.
- Consequences: The public `reportImpact` named export is preserved, while `consoleReporter.ts` drops from 989 to 943 lines and CC from 217 to 207. Impact output behavior has focused characterization tests for unavailable output, symbol details, definition files, reachable grouping, truncation, no-reachable output, and re-export compatibility.
- Verification: `npm run test -- tests/reporters/consoleImpactReporter.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/reporters/consoleReporter.ts --format json`, and `npm exec projscan -- file src/reporters/consoleImpactReporter.ts --format json`.

## 2026-06-16: Extract console health reporter

- Status: accepted
- Context: After the previous reporter extractions, `src/reporters/consoleReporter.ts` still owned the high-complexity doctor health renderer.
- Decision: Move `reportHealth` and `ReportHealthOptions` into `src/reporters/consoleHealthReporter.ts` and re-export both from `src/reporters/consoleReporter.ts`.
- Consequences: The public health reporter import remains stable, while `consoleReporter.ts` drops from 943 to 847 lines and CC from 207 to 186. Health output behavior has focused characterization tests for score, issue summary, scan duration, issue details, suggested actions, recommendations, stable-rule tips, next commands, no-issue output, options-object compatibility, numeric scan-time compatibility, and re-export compatibility.
- Verification: `npm run test -- tests/reporters/consoleHealthReporter.test.ts`, `npm run test -- tests/reporters/consoleReporter.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/reporters/consoleReporter.ts --format json`, and `npm exec projscan -- file src/reporters/consoleHealthReporter.ts --format json`.

## 2026-06-16: Extract console dependency reporter

- Status: accepted
- Context: After the health extraction, `src/reporters/consoleReporter.ts` still owned the dependency console renderer for package totals, production dependency rows, license summaries, installed sizes, and risks.
- Decision: Move `reportDependencies` into `src/reporters/consoleDependencyReporter.ts` and re-export it from `src/reporters/consoleReporter.ts`.
- Consequences: The public dependency reporter import remains stable, while `consoleReporter.ts` drops from 847 to 795 lines and CC from 186 to 174. Dependency output behavior has focused characterization tests for totals, sorted production dependency rows, truncation, license summaries, installed sizes, risk rows, optional-section omission, and re-export compatibility.
- Verification: `npm run test -- tests/reporters/consoleDependencyReporter.test.ts`, `npm run test -- tests/reporters/consoleReporter.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/reporters/consoleReporter.ts --format json`, and `npm exec projscan -- file src/reporters/consoleDependencyReporter.ts --format json`.

## 2026-06-16: Extract console hotspot reporter

- Status: accepted
- Context: After dependency rendering moved out, `src/reporters/consoleReporter.ts` still owned the hotspot console renderer for unavailable output, empty output, ranked rows, accepted tags, accepted legend, and drill-down tips.
- Decision: Move `reportHotspots` into `src/reporters/consoleHotspotReporter.ts` and re-export it from `src/reporters/consoleReporter.ts`.
- Consequences: The public hotspot reporter import remains stable, while `consoleReporter.ts` drops from 795 to 742 lines and CC from 174 to 162. Hotspot output behavior has focused characterization tests for unavailable output, empty-state commit wording, ranked rows, reason fallback, accepted tags/legend, drill-down tip, and re-export compatibility.
- Verification: `npm run test -- tests/reporters/consoleHotspotReporter.test.ts`, `npm run test -- tests/reporters/consoleReporter.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/reporters/consoleReporter.ts --format json`, and `npm exec projscan -- file src/reporters/consoleHotspotReporter.ts --format json`.

## 2026-06-16: Extract console upgrade reporter

- Status: accepted
- Context: After hotspot rendering moved out, `src/reporters/consoleReporter.ts` still owned release-facing upgrade preview rendering for unavailable package checks, declared/installed/drift metadata, breaking markers, direct importers, and changelog excerpts.
- Decision: Move `reportUpgrade` into `src/reporters/consoleUpgradeReporter.ts` and re-export it from `src/reporters/consoleReporter.ts`.
- Consequences: The public upgrade reporter import remains stable, while `consoleReporter.ts` drops from 742 to 694 lines and CC from 162 to 150. Upgrade output behavior has focused characterization tests for unavailable output, drift metadata, breaking markers, clean no-breaking output, importer truncation, no-importer output, changelog truncation, no-changelog output, and re-export compatibility.
- Verification: `npm run test -- tests/reporters/consoleUpgradeReporter.test.ts`, `npm run test -- tests/reporters/consoleReporter.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/reporters/consoleReporter.ts --format json`, and `npm exec projscan -- file src/reporters/consoleUpgradeReporter.ts --format json`.

## 2026-06-16: Extract console outdated reporter

- Status: accepted
- Context: After upgrade rendering moved out, `src/reporters/consoleReporter.ts` still owned dependency drift rendering for unavailable package checks, declared/drifted/not-installed summaries, semver drift groups, dev dependency tags, and missing package truncation.
- Decision: Move `reportOutdated` into `src/reporters/consoleOutdatedReporter.ts` and re-export it from `src/reporters/consoleReporter.ts`.
- Consequences: The public outdated reporter import remains stable, while `consoleReporter.ts` drops from 694 to 640 lines and CC from 150 to 138. Outdated output behavior has focused characterization tests for unavailable output, clean all-matched output, major/minor/patch groups, dev dependency tags, missing package output, missing package truncation, and re-export compatibility.
- Verification: `npm run test -- tests/reporters/consoleOutdatedReporter.test.ts`, `npm run test -- tests/reporters/consoleReporter.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/reporters/consoleReporter.ts --format json`, and `npm exec projscan -- file src/reporters/consoleOutdatedReporter.ts --format json`.

## 2026-06-16: Extract console coupling reporter

- Status: accepted
- Context: After outdated rendering moved out, `src/reporters/consoleReporter.ts` still owned the highest-complexity remaining console reporter function for coupling totals, import cycles, cross-package edges, and file fan-in/fan-out tables.
- Decision: Move `reportCoupling` into `src/reporters/consoleCouplingReporter.ts` and re-export it from `src/reporters/consoleReporter.ts`.
- Consequences: The public coupling reporter import remains stable, while `consoleReporter.ts` drops from 640 to 589 lines and CC from 138 to 126. Coupling output behavior has focused characterization tests for no-file warnings, singular/plural totals, cycle rows, cross-package edge truncation, file table rows, and re-export compatibility.
- Verification: `npm run test -- tests/reporters/consoleCouplingReporter.test.ts`, `npm run test -- tests/reporters/consoleReporter.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/reporters/consoleReporter.ts --format json`, and `npm exec projscan -- file src/reporters/consoleCouplingReporter.ts --format json`.

## 2026-06-16: Extract console analysis reporter

- Status: accepted
- Context: After coupling rendering moved out, `src/reporters/consoleReporter.ts` still owned the project analysis summary renderer for project metadata, language bars, top-level structure, issue rows, and fixable suggestions.
- Decision: Move `reportAnalysis` into `src/reporters/consoleAnalysisReporter.ts` and re-export it from `src/reporters/consoleReporter.ts`.
- Consequences: The public analysis reporter import remains stable, while `consoleReporter.ts` drops from 589 to 511 lines and CC from 126 to 115. Analysis output behavior has focused characterization tests for project metadata, optional line omission, language sorting and truncation, structure truncation, issue rows, fixable suggestions, and re-export compatibility.
- Verification: `npm run test -- tests/reporters/consoleAnalysisReporter.test.ts`, `npm run test -- tests/reporters/consoleReporter.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/reporters/consoleReporter.ts --format json`, and `npm exec projscan -- file src/reporters/consoleAnalysisReporter.ts --format json`.

## 2026-06-16: Extract console diff reporter

- Status: accepted
- Context: After analysis rendering moved out, `src/reporters/consoleReporter.ts` still owned health diff rendering, including score deltas, resolved/new issue lists, hotspot change sections, and baseline metadata.
- Decision: Move `reportDiff` into `src/reporters/consoleDiffReporter.ts` and re-export it from `src/reporters/consoleReporter.ts`.
- Consequences: The public diff reporter import remains stable, while `consoleReporter.ts` drops from 511 to 427 lines and CC from 115 to 95. Diff output behavior has focused characterization tests for score and grade transitions, no-change issue wording, hotspot rose/appeared/fell/resolved truncation, baseline timestamp, and re-export compatibility.
- Verification: `npm run test -- tests/reporters/consoleDiffReporter.test.ts`, `npm run test -- tests/reporters/consoleReporter.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/reporters/consoleReporter.ts --format json`, and `npm exec projscan -- file src/reporters/consoleDiffReporter.ts --format json`.

## 2026-06-16: Extract Markdown diff reporter

- Status: accepted
- Context: After console reporter cleanup, `src/reporters/markdownReporter.ts` became the next reporter hotspot and still owned the highest-complexity Markdown renderer for health diff score deltas, issue deltas, and hotspot movement sections.
- Decision: Move `reportDiffMarkdown` into `src/reporters/markdownDiffReporter.ts` and re-export it from `src/reporters/markdownReporter.ts`.
- Consequences: The public Markdown diff reporter import remains stable, while `markdownReporter.ts` drops from 858 to 800 lines and CC from 205 to 191. Diff Markdown behavior has focused characterization tests for the metric table, score delta arrows, resolved/new issue sections, hotspot rose/appeared/fell sections, and re-export compatibility.
- Verification: `npm run test -- tests/reporters/markdownDiffReporter.test.ts`, `npm run test -- tests/reporters/markdownReporter.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/reporters/markdownReporter.ts --format json`, and `npm exec projscan -- file src/reporters/markdownDiffReporter.ts --format json`.

## 2026-06-16: Extract console CI reporter

- Status: accepted
- Context: After console diff rendering moved out, `src/reporters/consoleReporter.ts` still owned the public CI console renderer for score/grade text, pass/fail status, issue count pluralization, threshold display, and failing issue rows.
- Decision: Move `reportCi` into `src/reporters/consoleCiReporter.ts` and re-export it from `src/reporters/consoleReporter.ts`.
- Consequences: The public CI reporter import remains stable, while `consoleReporter.ts` drops from 427 to 408 lines and CC from 95 to 87. CI console behavior has focused characterization tests for PASS output, pass-with-issues row suppression, FAIL output with issue rows, score/grade text, count pluralization, threshold display, and re-export compatibility.
- Verification: `npm run test -- tests/reporters/consoleCiReporter.test.ts`, `npm run test -- tests/reporters/consoleReporter.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/reporters/consoleReporter.ts --format json`, and `npm exec projscan -- file src/reporters/consoleCiReporter.ts --format json`.

## 2026-06-16: Extract start mission control builder

- Status: accepted
- Context: The quality scorecard ranked `src/core/start.ts` as the highest current hotspot, and the file still owned mission-control orchestration wiring in addition to start report input gathering and assembly.
- Decision: Move `buildMissionControl` and its private handoff prompt helpers into `src/core/startMissionControl.ts`, then import the builder from `src/core/start.ts`.
- Consequences: The public `computeStartReport` export and `StartReport.missionControl` shape remain stable, while `start.ts` drops from 442 to 249 lines and CC from 36 to 18. The new module has focused coverage for routed impact intent, handoff/review-gate wiring, handoff prompt propagation, and builder export availability.
- Verification: `npm run test -- tests/core/startMissionControl.test.ts`, `npm run test -- tests/core/start.test.ts`, `npm run test -- tests/mcp/start.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/core/start.ts --format json`, and `npm exec projscan -- file src/core/startMissionControl.ts --format json`.

## 2026-06-16: Extract start evidence helpers

- Status: accepted
- Context: After mission-control extraction, `src/core/start.ts` still mixed StartReport assembly with current-worktree/session risk-source IO and coordination hint construction.
- Decision: Move `buildStartRiskSources` and `buildStartCoordinationHints` into `src/core/startEvidence.ts`, then import both helpers from `src/core/start.ts`.
- Consequences: The public `computeStartReport` export, `StartReport.evidence.riskSources` shape, and coordination hint wording/order remain stable, while `start.ts` drops from 249 to 182 lines and CC from 18 to 12. The new module has focused coverage for remembered session risk evidence, sorting/tie-break/truncation, current-worktree fallback shape, current-worktree hint construction, exact hint wording, harness hint pass-through, preflight mode command selection, and remembered-session hint presence/omission.
- Verification: `npm run test -- tests/core/startEvidence.test.ts`, `npm run test -- tests/core/start.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/core/start.ts --format json`, and `npm exec projscan -- file src/core/startEvidence.ts --format json`.

## 2026-06-16: Extract start adoption loop

- Status: accepted
- Context: After evidence-helper extraction, `src/core/start.ts` still embedded repeat-use adoption-loop product guidance inside the StartReport assembler.
- Decision: Move `buildAdoptionLoop` into `src/core/startAdoptionLoop.ts`, then import it from `src/core/start.ts`.
- Consequences: The public `computeStartReport` export and `StartReport.adoptionLoop` shape/content remain stable, while `start.ts` drops from 182 to 141 lines. The new module has focused coverage for cadence, why text, metric ids/labels/targets/commands, next command ordering, dogfood commands, and builder export availability.
- Verification: `npm run test -- tests/core/startAdoptionLoop.test.ts`, `npm run test -- tests/core/start.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/core/start.ts --format json`, and `npm exec projscan -- file src/core/startAdoptionLoop.ts --format json`.

## 2026-06-16: Extract public type leaf modules

- Status: accepted
- Context: `src/types.ts` is a high-fan-in public type barrel with more than 2500 lines. The maintainability scorecard ranked it as the top hotspot after the start module extractions, but changing public type names would be high risk.
- Decision: Move dependency-light type clusters into `src/types/common.ts`, `src/types/hotspots.ts`, `src/types/inspection.ts`, and `src/types/mcp.ts`, while keeping `src/types.ts` as the compatibility barrel through type-only re-exports.
- Consequences: Existing `src/types.ts` imports keep working, leaf modules do not import from the barrel, and `src/types.ts` drops from 2535 to 2384 lines. A compile-only type probe covers both direct leaf imports and compatibility imports from `src/types.ts`.
- Verification: `npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --types node tests/types/public-type-modules.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/types.ts --format json`, `npm exec projscan -- file src/types/common.ts --format json`, `npm exec projscan -- file src/types/hotspots.ts --format json`, `npm exec projscan -- file src/types/inspection.ts --format json`, and `npm exec projscan -- file src/types/mcp.ts --format json`.

## 2026-06-16: Extract public scan analysis type modules

- Status: accepted
- Context: After the first public type extraction, `src/types.ts` remained the top maintainability hotspot. The scan, language, framework, dependency, file explanation, analysis report, architecture layer, and health score contracts are dependency-light enough to move without changing behavior.
- Decision: Move those contracts into `src/types/scanning.ts` and `src/types/analysis.ts`, while keeping `src/types.ts` as the compatibility barrel through type-only re-exports and direct leaf imports for remaining internal references.
- Consequences: Existing `src/types.ts` imports keep working, leaf modules do not import from the barrel, and `src/types.ts` drops from 2384 to 2243 lines. A compile-only type probe covers direct leaf imports and compatibility imports for every moved type.
- Verification: `npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --types node tests/types/public-scan-analysis-types.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/types.ts --format json`, `npm exec projscan -- file src/types/scanning.ts --format json`, and `npm exec projscan -- file src/types/analysis.ts --format json`.

## 2026-06-16: Extract public fix type module

- Status: accepted
- Context: After scan/analysis type extraction, `src/types.ts` remained the top maintainability hotspot. The fix suggestion, issue explanation, fix, and fix result contracts form a small public cluster consumed by fix commands, reporters, and fix registry types.
- Decision: Move `FixSuggestion`, `IssueExplanation`, `Fix`, and `FixResult` into `src/types/fixes.ts`, while keeping `src/types.ts` as the compatibility barrel through type-only re-exports.
- Consequences: Existing `src/types.ts` imports keep working, the new leaf module imports only common issue primitives, and `src/types.ts` drops from 2243 to 2182 lines. A compile-only type probe covers direct leaf imports and compatibility imports for every moved fix type.
- Verification: `npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --types node tests/types/public-fix-types.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/types.ts --format json`, and `npm exec projscan -- file src/types/fixes.ts --format json`.

## 2026-06-16: Extract public graph dataflow type module

- Status: accepted
- Context: After fix type extraction, `src/types.ts` remained the top maintainability hotspot. Graph evidence, semantic graph, and dataflow report contracts are public, dependency-light, and consumed by review, agent brief, plugins, issue engine, and CLI code.
- Decision: Move `GraphEvidenceSummary`, semantic graph types, and dataflow report/risk types into `src/types/graph.ts`, while keeping `src/types.ts` as the compatibility barrel through type-only re-exports.
- Consequences: Existing `src/types.ts` imports keep working, the new leaf module has no imports, and `src/types.ts` drops from 2182 to 2116 lines. A compile-only type probe covers direct leaf imports and compatibility imports for every moved graph/dataflow type.
- Verification: `npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --types node tests/types/public-graph-types.test.ts`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/types.ts --format json`, and `npm exec projscan -- file src/types/graph.ts --format json`.

## 2026-06-16: Extract public PR diff type module

- Status: accepted
- Context: After coupling type extraction, `src/types.ts` still carried the PR-native AST diff contracts inline. These types are dependency-light, public, and consumed by PR diff, review, and reporter surfaces.
- Decision: Move `ExportRename`, `FileAstDiff`, and `PrDiffReport` into `src/types/prDiff.ts`, while keeping `src/types.ts` as the compatibility barrel through type-only re-exports and a local type import for `ReviewReport.prDiff`.
- Consequences: Existing `src/types.ts` imports keep working, PR diff implementation imports these types from the focused module, and `src/types.ts` drops from 1346 to 1308 lines. Public type coverage checks both direct module imports and legacy barrel imports.
- Verification: `npm run test -- tests/types/public-pr-diff-types.test.ts`, `npm run typecheck:public-types`, `npm run test -- tests/core/prDiff.test.ts`, `npm run typecheck`, `npm run build`, `npm run lint`, `git diff --check`, `npm exec agentflight -- verify`, `npm exec projscan -- file src/types.ts --format json`, and `npm exec projscan -- file src/types/prDiff.ts --format json`.

## 2026-06-16: Extract public hotspot report type

- Status: accepted
- Context: `AuthorShare` and `FileHotspot` already lived in `src/types/hotspots.ts`, but the related `HotspotReport` contract remained inline in `src/types.ts`.
- Decision: Move `HotspotReport` into the existing `src/types/hotspots.ts` module, while keeping `src/types.ts` as the compatibility barrel through type-only re-exports.
- Consequences: Existing `src/types.ts` imports keep working, the hotspot type cluster is no longer split, and `src/types.ts` drops from 1308 to 1297 lines. Public type coverage checks direct module imports and legacy barrel imports for `AuthorShare`, `FileHotspot`, and `HotspotReport`.
- Verification: `npm run typecheck:public-types`, `npm run test -- tests/types/public-hotspot-types.test.ts`, `npm run test -- tests/reporters/consoleHotspotReporter.test.ts`, `npm run typecheck`, `npm run build`, `npm run lint`, `git diff --check`, `npm exec agentflight -- verify`, `npm exec projscan -- file src/types.ts --format json`, and `npm exec projscan -- file src/types/hotspots.ts --format json`.

## 2026-06-16: Extract public impact type module

- Status: accepted
- Context: `src/types.ts` still carried the impact reachability contracts inline even though they form a compact public report cluster consumed by impact computation and reporters.
- Decision: Move `ImpactNode`, `ImpactBoundarySummary`, and `ImpactReport` into `src/types/impact.ts`, while keeping `src/types.ts` as the compatibility barrel through type-only re-exports and importing impact implementation types from the focused module.
- Consequences: Existing `src/types.ts` imports keep working, impact runtime behavior remains unchanged, and `src/types.ts` drops from 1297 to 1234 lines. Public type coverage checks direct module imports and legacy barrel imports for all moved impact types.
- Verification: `npm run test -- tests/types/public-impact-types.test.ts`, `npm run typecheck:public-types`, `npm run test -- tests/core/impact.test.ts`, `npm run typecheck`, `npm run build`, `npm run lint`, `git diff --check`, `npm exec agentflight -- verify`, `npm exec projscan -- file src/types.ts --format json`, and `npm exec projscan -- file src/types/impact.ts --format json`.

## 2026-06-16: Extract public start and quality type modules

- Status: accepted
- Context: `src/types.ts` still carried the Start/Mission Control/Mission Proof and QualityScorecard public contracts inline, even though these contracts form agent-orchestration and quality evidence clusters used by focused implementation modules.
- Decision: Move the Start/Mission Control/Mission Proof contracts into `src/types/start.ts` and QualityScorecard contracts into `src/types/qualityScorecard.ts`, while keeping `src/types.ts` and `src/index.ts` compatibility through type-only re-exports and updating implementation imports to the focused modules.
- Consequences: Existing imports from `src/types.ts` and the package entrypoint keep working, runtime behavior remains unchanged, and `src/types.ts` drops from 1234 to 762 lines. `src/types/start.ts` is 486 lines and `src/types/qualityScorecard.ts` is 39 lines. Public type coverage checks direct module imports, legacy barrel imports, and package entrypoint imports.
- Verification: `npm run test -- tests/types/public-start-quality-types.test.ts`, `npm run typecheck:public-types`, `npm run test -- tests/core/start.test.ts tests/core/startMissionControl.test.ts tests/core/startMissionPolicy.test.ts tests/core/missionProof.test.ts tests/core/qualityScorecard.test.ts`, `npm run test -- tests/cli/start.test.ts tests/cli/missionProof.test.ts tests/cli/qualityScorecard.test.ts`, `npm run test -- tests/mcp/start.test.ts tests/mcp/agentBriefQualityScorecard.test.ts`, `npm run typecheck`, `npm run build`, `npm run lint`, `git diff --check`, `npm exec agentflight -- verify`, `npm exec projscan -- file src/types.ts --format json`, `npm exec projscan -- file src/types/start.ts --format json`, and `npm exec projscan -- file src/types/qualityScorecard.ts --format json`.

## 2026-06-16: Collapse package entrypoint type re-export list

- Status: accepted
- Context: `src/index.ts` manually listed every public type exported from `src/types.ts`. After the public type-module extractions, that list became high-churn public API maintenance work that could drift whenever a new public type is added.
- Decision: Replace the explicit `export type { ... } from './types.js'` list with `export type * from './types.js'`, while leaving runtime exports and non-`src/types.ts` type exports unchanged. Update the code graph to expand local star re-exports so review contract-change analysis treats preserved type exports as still exported.
- Consequences: Package entrypoint type imports keep compiling, the entrypoint no longer needs a manual type list for `src/types.ts`, and `src/index.ts` drops from 273 to 137 lines. The public type fixture checks representative package-entrypoint imports and locks in the type-only star export shape. `projscan review` no longer misclassifies the entrypoint type-star refactor as removed `src/index.ts` exports after rebuild.
- Verification: `npm run test -- tests/types/public-entrypoint-type-star.test.ts`, `npm run test -- tests/core/codeGraph.test.ts -t "expands local type-only star re-exports into exported symbols"`, `npm run typecheck:public-types`, `npm run typecheck`, `npm run build`, `npm run lint`, `git diff --check`, `npm exec agentflight -- verify`, `npm exec projscan -- file src/index.ts --format json`, and `npm exec projscan -- review --format json` with `src/index.ts` export-removed count confirmed as 0.

## 2026-06-16: Refresh incremental star re-export expansion

- Status: accepted
- Context: `projscan review` flagged `expandLocalStarReexports` as a newly added high-complexity function, and watch-mode incremental updates rebuilt symbol indexes without refreshing star re-exported symbols after a target file changed.
- Decision: Move local star re-export expansion into `src/core/codeGraphReexports.ts`, keep helper complexity low, and have `incrementallyUpdateGraph` reparse local star-reexport barrel files before re-expanding and rebuilding indexes.
- Consequences: Full graph builds keep the existing `export *` behavior, incremental graph updates now add and remove re-exported symbols correctly, `src/core/codeGraph.ts` drops below the large-file threshold, and branch review no longer reports the star-reexport helper as a risky function or an import cycle.
- Verification: `npm run test -- tests/core/codeGraph.test.ts`, `npm run test -- tests/core/codeGraph.incremental.test.ts`, `npm run test -- tests/core/review.test.ts -t "reports exports added in files re-exported by package entrypoints"`, `npm exec projscan -- file src/core/codeGraph.ts --format json`, `npm exec projscan -- file src/core/codeGraphReexports.ts --format json`, `npm exec projscan -- review --format json`, `npm run typecheck`, `npm run lint`, and `git diff --check`.

## 2026-06-16: Extract markdown fix guidance reporter

- Status: accepted
- Context: `src/reporters/markdownReporter.ts` remained the top maintainability hotspot after earlier reporter extractions, and its inline fix-suggest renderer was the highest-CC markdown reporter function.
- Decision: Move `reportFixSuggestMarkdown` and `reportExplainIssueMarkdown` into `src/reporters/markdownFixGuidanceReporter.ts`, split the new module into low-complexity append helpers, and keep compatibility re-exports from `src/reporters/markdownReporter.ts`.
- Consequences: Existing CLI and reporter imports keep working, markdown fix guidance has focused tests matching the existing console fix guidance coverage, `markdownReporter.ts` drops from 584 to 526 lines, and `projscan review` reports no new risky functions or cycles for the slice.
- Verification: `npm run test -- tests/reporters/markdownFixGuidanceReporter.test.ts`, `npm run test -- tests/reporters/markdownReporter.test.ts`, `npm exec projscan -- file src/reporters/markdownReporter.ts --format json`, `npm exec projscan -- file src/reporters/markdownFixGuidanceReporter.ts --format json`, `npm exec projscan -- review --format json`, `npm run typecheck`, `npm run lint`, and `git diff --check`.

## 2026-06-16: Extract markdown impact reporter

- Status: accepted
- Context: `src/reporters/markdownReporter.ts` remained the top maintainability hotspot, and `reportImpactMarkdown` was tied for the highest remaining inline markdown reporter complexity while the console impact renderer already had a focused module.
- Decision: Move `reportImpactMarkdown` into `src/reporters/markdownImpactReporter.ts`, split the new module into low-complexity append helpers, and keep a compatibility re-export from `src/reporters/markdownReporter.ts`.
- Consequences: Existing CLI and reporter imports keep working, markdown impact output has focused coverage for unavailable, symbol, reachable, overflow, and isolated-file cases, and `markdownReporter.ts` drops from 526 to 489 lines and CC 109 to 100.
- Verification: `npm run test -- tests/reporters/markdownImpactReporter.test.ts`, `npm run test -- tests/reporters/markdownReporter.test.ts`, `npm exec projscan -- file src/reporters/markdownReporter.ts --format json`, `npm exec projscan -- file src/reporters/markdownImpactReporter.ts --format json`, `npm exec projscan -- review --format json`, `npm run typecheck`, `npm run lint`, and `git diff --check`.

## 2026-06-16: Extract markdown upgrade reporter

- Status: accepted
- Context: `src/reporters/markdownReporter.ts` remained the top maintainability hotspot, and `reportUpgradeMarkdown` was the highest remaining inline markdown reporter function while the console upgrade renderer already had a focused module.
- Decision: Move `reportUpgradeMarkdown` into `src/reporters/markdownUpgradeReporter.ts`, split the new module into low-complexity append helpers, and keep a compatibility re-export from `src/reporters/markdownReporter.ts`.
- Consequences: Existing CLI and reporter imports keep working, markdown upgrade output has focused coverage for unavailable previews, drift metadata, breaking markers, importers, changelog excerpts, optional-section omission, and compatibility re-export behavior. `markdownReporter.ts` drops from 489 to 451 lines and CC 100 to 91.
- Verification: `npm run test -- tests/reporters/markdownUpgradeReporter.test.ts`, `npm run test -- tests/reporters/markdownReporter.test.ts`, `npm exec projscan -- file src/reporters/markdownReporter.ts --format json`, `npm exec projscan -- file src/reporters/markdownUpgradeReporter.ts --format json`, `npm exec projscan -- review --format json`, `npm run typecheck`, `npm run lint`, and `git diff --check`.

## 2026-06-16: Extract console coverage reporter

- Status: accepted
- Context: `src/reporters/consoleReporter.ts` became the top source hotspot after markdown reporter extractions, and `reportCoverage` was tied for the highest remaining inline console reporter complexity.
- Decision: Move `reportCoverage` and coverage percentage formatting into `src/reporters/consoleCoverageReporter.ts`, split the new module into low-complexity print helpers, and keep a compatibility re-export from `src/reporters/consoleReporter.ts`.
- Consequences: Existing CLI and reporter imports keep working, console coverage output has focused coverage for unavailable reports, empty intersections, ranked entries, null coverage, reasons, overflow rows, and compatibility re-export behavior. `consoleReporter.ts` drops from 281 to 237 lines and CC 55 to 44; the new module's top helper is CC 4.
- Verification: `npm run test -- tests/reporters/consoleCoverageReporter.test.ts`, `npm run test -- tests/reporters/consoleReporter.test.ts`, `npm exec projscan -- file src/reporters/consoleReporter.ts --format json`, `npm exec projscan -- file src/reporters/consoleCoverageReporter.ts --format json`, `npm exec projscan -- review --format json`, `npm run typecheck`, `npm run lint`, and `git diff --check`.

## 2026-06-16: Extract console workspace reporter

- Status: accepted
- Context: `src/reporters/consoleReporter.ts` remained a high-churn/high-complexity hotspot after the coverage extraction, and its inline workspace renderer was a small user-visible function with a clear `WorkspaceInfo` boundary.
- Decision: Move `reportWorkspaces` into `src/reporters/consoleWorkspaceReporter.ts` and keep a compatibility re-export from `src/reporters/consoleReporter.ts`.
- Consequences: Existing CLI and reporter imports keep working, console workspace output has focused coverage for single-package repos, monorepo package rows, missing source fallback, and compatibility re-export behavior. `consoleReporter.ts` drops from 237 to 214 lines and CC 44 to 36; Ponytail review kept the extracted module as one straightforward 29-line function instead of adding single-use helper scaffolding for metric polish.
- Verification: `npm run test -- tests/reporters/consoleWorkspaceReporter.test.ts`, `npm run test -- tests/reporters/consoleReporter.test.ts`, `npm exec projscan -- file src/reporters/consoleReporter.ts --format json`, `npm exec projscan -- file src/reporters/consoleWorkspaceReporter.ts --format json`, `npm exec projscan -- review --format json`, `npm run typecheck`, `npm run lint`, and `git diff --check`.

## 2026-06-16: Extract console architecture reporter

- Status: accepted
- Context: `src/reporters/consoleReporter.ts` remained a high-churn hotspot after workspace extraction, and its inline project architecture and directory tree renderers shared a clear project-shape reporting boundary.
- Decision: Move `reportDiagram`, `reportStructure`, and the recursive tree printer into `src/reporters/consoleArchitectureReporter.ts`, while keeping compatibility re-exports from `src/reporters/consoleReporter.ts`.
- Consequences: Existing CLI and reporter imports keep working, console architecture output has focused coverage for layered diagrams, unknown technologies, nested directory trees, custom project titles, and compatibility re-export behavior. `consoleReporter.ts` drops from 214 to 159 lines and CC 36 to 23.
- Verification: `npm run test -- tests/reporters/consoleArchitectureReporter.test.ts`, `npm run test -- tests/reporters/consoleReporter.test.ts`, `npm exec projscan -- file src/reporters/consoleReporter.ts --format json`, `npm exec projscan -- file src/reporters/consoleArchitectureReporter.ts --format json`, `npm exec projscan -- review --format json`, `npm run typecheck`, `npm run lint`, and `git diff --check`.

## 2026-06-16: Extract console explanation reporter

- Status: accepted
- Context: `src/reporters/consoleReporter.ts` still carried file explanation rendering inline after project-shape reporter extraction, while the logic has a clear `FileExplanation` data boundary.
- Decision: Move `reportExplanation` into `src/reporters/consoleExplanationReporter.ts` and keep a compatibility re-export from `src/reporters/consoleReporter.ts`.
- Consequences: Existing CLI and reporter imports keep working, console explanation output has focused coverage for file metadata, package/local dependency labels, key exports, potential issues, and compatibility re-export behavior. `consoleReporter.ts` drops from 159 to 124 lines and CC 23 to 16.
- Verification: `npm run test -- tests/reporters/consoleExplanationReporter.test.ts`, `npm run test -- tests/reporters/consoleReporter.test.ts`, `npm exec projscan -- file src/reporters/consoleReporter.ts --format json`, `npm exec projscan -- file src/reporters/consoleExplanationReporter.ts --format json`, `npm exec projscan -- review --format json`, `npm run typecheck`, `npm run lint`, and `git diff --check`.

## 2026-06-16: Extract console audit reporter

- Status: accepted
- Context: `src/reporters/consoleReporter.ts` still carried vulnerability audit rendering inline after prior console reporter extractions, while audit output has a clear `AuditReport` boundary and is security-adjacent user-facing console output.
- Decision: Move `reportAudit` into `src/reporters/consoleAuditReporter.ts` and keep a compatibility re-export from `src/reporters/consoleReporter.ts`.
- Consequences: Existing CLI and reporter imports keep working, console audit output has focused coverage for unavailable audits, clean audits, severity summary rows, finding range/url/fix markers, overflow rows, and compatibility re-export behavior. `consoleReporter.ts` drops from 124 to 74 lines and CC 16 to 9; the new audit module is 56 lines and CC 8.
- Verification: `npm run test -- tests/reporters/consoleAuditReporter.test.ts`, `npm run test -- tests/reporters/consoleReporter.test.ts`, `npm exec projscan -- file src/reporters/consoleReporter.ts --format json`, `npm exec projscan -- file src/reporters/consoleAuditReporter.ts --format json`, `npm exec projscan -- review --format json`, `npm run typecheck`, `npm run lint`, and `git diff --check`.

## 2026-06-16: Extract markdown audit reporter

- Status: accepted
- Context: `src/reporters/markdownReporter.ts` still carried vulnerability audit markdown rendering inline after prior markdown reporter extractions, while audit output has a clear `AuditReport` boundary and is security-adjacent user-facing markdown output.
- Decision: Move `reportAuditMarkdown` into `src/reporters/markdownAuditReporter.ts` and keep a compatibility re-export from `src/reporters/markdownReporter.ts`.
- Consequences: Existing CLI and reporter imports keep working, markdown audit output has focused coverage for unavailable audits, clean audits, severity summary text, linked and plain finding titles, fix markers, and compatibility re-export behavior. `markdownReporter.ts` drops from 451 to 420 lines and CC 91 to 85; the new audit module is 33 lines and CC 7.
- Verification: `npm run test -- tests/reporters/markdownAuditReporter.test.ts`, `npm run test -- tests/reporters/markdownReporter.test.ts`, `npm exec projscan -- file src/reporters/markdownReporter.ts --format json`, `npm exec projscan -- file src/reporters/markdownAuditReporter.ts --format json`, `npm exec projscan -- review --format json`, `npm run typecheck`, `npm run lint`, and `git diff --check`.

## 2026-06-16: Extract markdown analysis reporter

- Status: accepted
- Context: `src/reporters/markdownReporter.ts` still carried project analysis markdown rendering inline, and `reportAnalysisMarkdown` was the highest-complexity remaining inline markdown reporter function.
- Decision: Move `reportAnalysisMarkdown` into `src/reporters/markdownAnalysisReporter.ts` and keep a compatibility re-export from `src/reporters/markdownReporter.ts`.
- Consequences: Existing CLI and reporter imports keep working, markdown analysis output has focused coverage for project table fields, optional framework/dependency rows, sorted language rows, issue severity icons, omitted empty sections, and compatibility re-export behavior. `markdownReporter.ts` drops from 420 to 373 lines and CC 85 to 77; the new analysis module is 47 lines and CC 9.
- Verification: `npm run test -- tests/reporters/markdownAnalysisReporter.test.ts`, `npm run test -- tests/reporters/markdownReporter.test.ts`, `npm exec projscan -- file src/reporters/markdownReporter.ts --format json`, `npm exec projscan -- file src/reporters/markdownAnalysisReporter.ts --format json`, `npm exec projscan -- review --format json`, `npm run typecheck`, `npm run lint`, and `git diff --check`.

## 2026-06-16: Surface agent brief coordination hints in console

- Status: accepted
- Context: `agent-brief --format json` exposed `context.coordinationHints`, but the human console view only showed focus items and guardrails. Next-agent handoffs could miss session-memory and worktree coordination prompts unless users requested JSON.
- Decision: Render a dedicated `Coordination` section in the console output when coordination hints are present, preserving the existing JSON schema.
- Consequences: Console agent briefs now show hint labels, commands, and messages for remembered session context, current worktree checks, and swarm coordination without adding noise when no hints exist.
- Verification: `npm run test -- tests/cli/agentBriefQualityScorecard.test.ts -t "coordination hints"`, `npm run test -- tests/core/agentBrief.test.ts tests/cli/agentBriefQualityScorecard.test.ts`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## 2026-06-16: Detect Koa cookie accessors as request dataflow sources

- Status: accepted
- Context: The framework dataflow track already handled Koa body, query, params, headers, and header accessor calls, but missed `ctx.cookies.get(...)`, a common request-data path for sessions and tenancy.
- Decision: Add `koa.ctx.cookies.get` as a Koa request-source pattern behind the existing Koa import and route-handler gating.
- Consequences: Dataflow now reports Koa cookie values flowing into database sinks while ordinary helpers with `cookies.get(...)` stay quiet.
- Verification: `npm run test -- tests/core/dataflow.test.ts -t "Koa cookie accessor"`, `npm run test -- tests/core/dataflow.test.ts`, `npm exec projscan -- dataflow --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## 2026-06-16: Reduce AST decision-point hotspot complexity

- Status: accepted
- Context: `src/core/ast.ts` remained the highest hotspot after earlier AST helper extractions, with `isDecisionPoint` still carrying branch-heavy switch logic and member-alias extraction lacking coverage for defaulted destructuring.
- Decision: Replace the decision-point switch with table-driven node/operator sets and split member-alias extraction into context and property helpers.
- Consequences: `src/core/ast.ts` aggregate cyclomatic complexity drops from 212 to 205, `isDecisionPoint` leaves the top-risk function list, and destructured member-alias behavior is pinned for default values and computed-property skips.
- Verification: `npm run test -- tests/core/ast.functions.test.ts -t "switch cases logical operators"`, `npm run test -- tests/core/ast.references.test.ts -t "defaulted destructured member aliases"`, `npm run test -- tests/core/ast.test.ts tests/core/ast.functions.test.ts tests/core/ast.references.test.ts`, `npm run test -- tests/core/dataflow.test.ts`, `npm exec projscan -- file src/core/ast.ts --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## 2026-06-16: Redact absolute path prefixes in report evidence text

- Status: accepted
- Context: Scoped/redacted report exports replaced exact repo-relative paths embedded in issue text, but absolute text references such as `/Users/alice/repo/src/private/a.ts` could leave the machine path prefix visible after suffix redaction.
- Decision: Redact the full path-like token ending in a scoped file path, supporting both POSIX and Windows separators, while keeping stable `redacted-path-N` labels.
- Consequences: Issue titles, descriptions, and suggested actions no longer leak local checkout prefixes when they contain absolute paths to scoped files.
- Verification: `npm run test -- tests/core/reportScope.test.ts -t "absolute path prefixes"`, `npm run test -- tests/core/reportScope.test.ts`, `npm run test -- tests/cli/formatHandling.test.ts`, `npm exec projscan -- doctor --report-scope src --redact-paths --format json`, `npm exec projscan -- analyze --report-scope src --redact-paths --format sarif`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## 2026-06-16: Surface coordinate evidence in console output

- Status: accepted
- Context: `projscan coordinate --format json` exposed local-only coordination evidence, active signal sources, and validation commands, but the default console output only showed readiness and summary lines.
- Decision: Print a compact `Evidence` section in the coordinate console renderer for both available and unavailable reports.
- Consequences: Human users see the same local-only proof path, worktree count, current worktree, signal sources, and validation workflow without switching to JSON, while the JSON schema stays unchanged.
- Verification: `npm run test -- tests/cli/coordinate.test.ts`, `npm run test -- tests/core/coordination.test.ts tests/core/collisionDetector.test.ts`, `npm exec projscan -- coordinate --quiet`, `npm exec projscan -- coordinate --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## 2026-06-16: Use pinned Python constraints as upgrade evidence

- Status: accepted
- Context: Python upgrade previews already used local lockfiles and pinned root `requirements*.txt`, but pip-tools style repos often keep current-version pins in root `constraints*.txt` while declarations live in `pyproject.toml` or requirements inputs.
- Decision: Parse root `constraints*.txt` as lock/current-version evidence only, using the existing exact-pin conversion and not adding constraints entries to declared direct dependencies.
- Consequences: Offline Python previews and dependency-risk checks can use pinned constraints as reproducibility evidence without treating constraint-only packages as declared dependencies.
- Verification: `npm run test -- tests/core/languages/pythonManifests.test.ts -t "constraints.txt pins"`, `npm run test -- tests/core/upgradePreview.test.ts -t "pinned constraints"`, `npm run test -- tests/core/languages/pythonManifests.test.ts`, `npm run test -- tests/core/upgradePreview.test.ts tests/mcp/pythonUpgradeFallback.test.ts`, `npm run test -- tests/analyzers/pythonDependencyRiskCheck.test.ts`, `npm run typecheck:public-types`, `npm exec projscan -- hotspots --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## 2026-06-16: Table-drive hotspot path-boundary detection

- Status: accepted
- Context: `src/core/hotspotAnalyzer.ts` remained a top hotspot, and `isPathBoundary` carried a long boolean chain that inflated per-function and file-level cyclomatic complexity without encoding real control-flow.
- Decision: Replace the branch chain with a named set of accepted boundary character codes and keep the legacy issue-linking fallback behavior pinned with punctuation and path-neighbor tests.
- Consequences: `isPathBoundary` drops from CC 22 to CC 2, `src/core/hotspotAnalyzer.ts` drops from CC 132 to CC 112, and legacy issue text still links file paths only when surrounded by safe boundaries.
- Verification: `npm run test -- tests/core/hotspotIssueLinking.test.ts -t "legacy path-boundary"` failed before the change with CC 22, then `npm run test -- tests/core/hotspotIssueLinking.test.ts`, `npm run test -- tests/core/hotspotAnalyzer.test.ts tests/core/hotspotIssueLinking.test.ts`, and `npm exec projscan -- file src/core/hotspotAnalyzer.ts --format json` passed after the change.

## 2026-06-16: Extract review risky-function matcher

- Status: accepted
- Context: `src/core/review.ts` remained a high-risk review hotspot, and risky-function matching mixed added-file detection, modified-file matching, duplicate-name guards, and row construction into the review orchestrator.
- Decision: Move risky-function detection into `src/core/reviewRiskyFunctions.ts` and keep `computeReview` as the orchestration boundary.
- Consequences: `review.ts` drops from 1400 lines / CC 208 to 1285 lines / CC 183, the focused matcher module is 131 lines / CC 27, and added high-CC plus duplicate anonymous-function regression behavior remains covered.
- Verification: `npm run test -- tests/core/review.test.ts -t "risky-function matching isolated"` failed before the extraction, then `npm run test -- tests/core/review.test.ts -t "risky-function matching isolated"`, `npm run test -- tests/core/review.test.ts -t "flags new high-CC function"`, `npm run test -- tests/core/review.test.ts -t "multiple anonymous arrows"`, `npm run test -- tests/core/review.test.ts`, `npm exec projscan -- file src/core/review.ts --format json`, and `npm exec projscan -- file src/core/reviewRiskyFunctions.ts --format json` passed after the extraction.

## 2026-06-16: Detect Fastify raw request URL and headers

- Status: accepted
- Context: Fastify request body/query/params/headers/cookies/IP sources were framework-gated, but handlers that read the underlying Node request through `request.raw.url` or `request.raw.headers` either collapsed into a generic header source or were missed.
- Decision: Add receiver-sensitive Fastify member-reference sources for `request.raw.url` and `request.raw.headers`, checked before the existing bare-reference fallback.
- Consequences: Dataflow reports Fastify raw URL/header evidence with explicit source labels while helper functions with the same `request.raw` shape remain quiet.
- Verification: `npm run test -- tests/core/dataflow.test.ts -t "Fastify raw request"` failed before the change, then `npm run test -- tests/core/dataflow.test.ts -t "Fastify raw request"`, `npm run test -- tests/core/dataflow.test.ts -t "qualified Fastify"`, `npm run test -- tests/core/dataflow.test.ts -t "Fastify request IP"`, and `npm run test -- tests/core/dataflow.test.ts` passed after the change.

## 2026-06-16: Suppress child-process env passthrough taint false positives

- Status: accepted
- Context: The Fastify dataflow verification rebuilt the CLI and surfaced an `env` to `spawn` risk in `src/core/explainIssue.ts`, where `process.env` is passed as the child-process environment option for a fixed `git` command rather than used as the command or arguments.
- Decision: Suppress default `env` source matches only when the same function pairs an exact `process.env` member reference with a default child-process sink and no specific `process.env.X` reads or custom source/sink overrides are present.
- Consequences: `spawn('git', args, { env: process.env })` no longer reports as an env-command flow, while direct and multi-hop `process.env.X` command flows remain covered.
- Verification: `npm run test -- tests/core/taint.test.ts -t "env passthrough"` and `npm run test -- tests/core/dataflow.test.ts -t "env passthrough"` failed before the change, then those tests plus `npm run test -- tests/core/taint.test.ts -t "same-function flow"`, `npm run test -- tests/core/taint.test.ts -t "multi-hop flow"`, `npm run test -- tests/core/dataflow.test.ts -t "RegExp.exec"`, and `npm run test -- tests/core/taint.test.ts tests/core/dataflow.test.ts` passed after the change.

## 2026-06-16: Extract AST parser orchestration helpers

- Status: accepted
- Context: `src/core/ast.ts` remained the top hotspot, and `parseSource` still mixed parser option setup, parse-error handling, call/import extraction, and decision-point traversal in one high-review-risk function.
- Decision: Move Babel parser setup, parse-error handling, and file-level call/import signal collection into named helpers while keeping the exported `parseSource` shape unchanged.
- Consequences: `parseSource` drops from CC 12 to CC 5, `src/core/ast.ts` drops from CC 205 to CC 197, and dynamic import, CommonJS require, call-site, member-reference, and cyclomatic behavior stay covered.
- Verification: `npm run test -- tests/core/ast.functions.test.ts -t "parseSource orchestration"` failed before the extraction, then `npm run test -- tests/core/ast.functions.test.ts -t "parseSource orchestration"`, `npm run test -- tests/core/ast.test.ts`, `npm run test -- tests/core/ast.functions.test.ts -t "switch cases logical operators"`, `npm run test -- tests/core/ast.test.ts tests/core/ast.functions.test.ts tests/core/ast.references.test.ts tests/core/ast.cyclomatic.test.ts`, and `npm exec projscan -- file src/core/ast.ts --format json` passed after the extraction.

## 2026-06-16: Name AST body traversal signal collection

- Status: accepted
- Context: After extracting parser orchestration, `src/core/ast.ts` still reported a CC 17 `<anonymous>` callback in the per-function body walker, hiding the riskiest AST reference/call-site collection logic from review output.
- Decision: Replace the inline `walkSkippingNestedFunctions` callback with named body-signal collectors for decision points, calls, member aliases, and member references.
- Consequences: `analyzeBabelBody` becomes orchestration-only, the highest remaining anonymous AST callback is below the review threshold, and `src/core/ast.ts` drops from CC 197 to CC 196.
- Verification: `npm run test -- tests/core/ast.functions.test.ts -t "anonymous callbacks"` failed before the change, then `npm run test -- tests/core/ast.functions.test.ts -t "anonymous callbacks"`, `npm run test -- tests/core/ast.references.test.ts`, `npm run test -- tests/core/ast.functions.test.ts -t "parseSource orchestration|nested functions"`, `npm run test -- tests/core/ast.test.ts tests/core/ast.functions.test.ts tests/core/ast.references.test.ts tests/core/ast.cyclomatic.test.ts`, and `npm exec projscan -- file src/core/ast.ts --format json` passed after the change.

## 2026-06-16: Preserve sibling path labels during report redaction

- Status: accepted
- Context: Scoped evidence redaction could partially replace a longer path token when another scoped location was its prefix, such as turning `src/private/a.tsx` into `redacted-path-1x` after replacing `src/private/a.ts`.
- Decision: Apply path replacements from longest to shortest and require a path-token boundary after each matched reference.
- Consequences: Sibling files with shared prefixes receive distinct stable labels in issue text, while absolute path-prefix redaction and existing scoped JSON/SARIF metadata behavior remain intact.
- Verification: `npm run test -- tests/core/reportScope.test.ts -t "sibling path"` failed before the change, then `npm run test -- tests/core/reportScope.test.ts -t "sibling path"`, `npm run test -- tests/core/reportScope.test.ts -t "absolute path prefixes"`, `npm run test -- tests/core/reportScope.test.ts -t "file paths embedded"`, `npm run test -- tests/core/reportScope.test.ts tests/cli/formatHandling.test.ts tests/reporters/sarifReporter.test.ts tests/reporters/jsonReporter.test.ts`, `npm exec projscan -- doctor --report-scope src --redact-paths --format json`, and `npm exec projscan -- analyze --report-scope src --redact-paths --format sarif` passed after the change.

## 2026-06-16: Detect Koa request IP dataflow sources

- Status: accepted
- Context: Express and Fastify request IP reads were framework-gated dataflow sources, but Koa handlers reading `ctx.ip` or `ctx.request.ip` were missed even though Koa exposes those values as request metadata.
- Decision: Add receiver-sensitive Koa member-reference sources for `ctx.ip` and `ctx.request.ip`, using the existing Koa import and handler-context gates.
- Consequences: Dataflow reports `koa.ctx.ip` and `koa.ctx.request.ip` into database sinks while helper functions with the same `ctx` shape remain quiet.
- Verification: `npm run test -- tests/core/dataflow.test.ts -t "Koa request IP"` failed before the change, then `npm run test -- tests/core/dataflow.test.ts -t "Koa request IP"` and `npm run test -- tests/core/dataflow.test.ts -t "Koa request fields|Koa query params|Koa header accessor|Koa cookie accessor|Koa response-body|Fastify request IP"` passed after the change.

## 2026-06-16: Extract review verdict assembly

- Status: accepted
- Context: `src/core/review.ts` remained a bug-hunt hotspot, and `decideVerdict` combined risk thresholds, cycles, risky functions, taint/dataflow summaries, dependency summaries, and manual release sign-off wording in one CC 17 function.
- Decision: Move verdict scoring and summary assembly into `src/core/reviewVerdict.ts`, keeping `computeReview` as the orchestration boundary and preserving the existing `ReviewReport` schema.
- Consequences: `src/core/review.ts` drops from 1285 lines / CC 183 to 1147 lines / CC 161, while the new `decideVerdict` boundary is CC 1 and the highest helper in the new module is CC 5.
- Verification: `npm run test -- tests/core/review.test.ts -t "verdict assembly"` failed before the extraction, then `npm run test -- tests/core/review.test.ts -t "verdict assembly"`, `npm run test -- tests/core/review.test.ts -t "labels release-scale|NEW taint flow|NEW bridge dataflow|Dependency changes|ok verdict"`, `npm run test -- tests/core/review.test.ts`, `npm exec projscan -- file src/core/review.ts --format json`, and `npm exec projscan -- file src/core/reviewVerdict.ts --format json` passed after the change.

## 2026-06-16: Extract AST member-expression helpers

- Status: accepted
- Context: `src/core/ast.ts` remained the top bug-hunt hotspot, and member-expression reference/alias helpers were branch-heavy inside the parser module after earlier parser and body-walk extractions.
- Decision: Move member-expression name, read-reference, and destructured-alias helpers into `src/core/astMembers.ts`, while keeping `parseSource` and `FunctionInfo` output unchanged.
- Consequences: `src/core/ast.ts` drops from 970 lines / CC 196 to 886 lines / CC 146, and `collectMemberReadIdents` plus `babelQualifiedMemberName` are no longer part of the AST orchestrator hotspot.
- Verification: `npm run test -- tests/core/ast.functions.test.ts -t "member-expression helpers"` failed before the extraction, then `npm run test -- tests/core/ast.functions.test.ts -t "member-expression helpers"`, `npm run test -- tests/core/ast.references.test.ts`, `npm run test -- tests/core/ast.test.ts tests/core/ast.functions.test.ts tests/core/ast.references.test.ts tests/core/ast.cyclomatic.test.ts`, `npm exec projscan -- file src/core/ast.ts --format json`, and `npm exec projscan -- file src/core/astMembers.ts --format json` passed after the change.

## 2026-06-16: Extract hotspot git churn collection

- Status: accepted
- Context: `src/core/hotspotAnalyzer.ts` remained a hotspot after the AST and review extractions, and the git-log collection/parsing path was branch-heavy infrastructure embedded in the risk-scoring module.
- Decision: Move git repository probing, git-log churn collection, commit counting, and git process handling into `src/core/hotspotGit.ts`, keeping hotspot scoring, issue linking, and public `analyzeHotspots` output unchanged.
- Consequences: `src/core/hotspotAnalyzer.ts` drops from 657 lines / CC 112 to 504 lines / CC 82, while `collectGitChurn` becomes a CC 2 boundary in a non-hotspot helper module.
- Verification: `npm run test -- tests/core/hotspotIssueLinking.test.ts -t "git churn"` failed before the extraction, then `npm run test -- tests/core/hotspotIssueLinking.test.ts -t "git churn"`, `npm run test -- tests/core/hotspotAnalyzer.test.ts`, `npm run test -- tests/core/hotspotIssueLinking.test.ts tests/core/hotspotAnalyzer.test.ts tests/core/hotspotCoverage.test.ts`, `npm exec projscan -- file src/core/hotspotAnalyzer.ts --format json`, and `npm exec projscan -- file src/core/hotspotGit.ts --format json` passed after the change.

## 2026-06-16: Extract Python lockfile parsers

- Status: accepted
- Context: `src/core/languages/pythonManifests.ts` was both a Python upgrade hotspot and the owner of Poetry, uv, PDM, Conda, and Pipfile lock parsing, which made manifest detection and lockfile parsing harder to review independently.
- Decision: Move lockfile discovery and parsing into `src/core/languages/pythonLockfiles.ts`, move shared Python project interfaces into `src/core/languages/pythonProjectTypes.ts`, and keep the existing parser names re-exported from `pythonManifests.ts`.
- Consequences: `src/core/languages/pythonManifests.ts` drops from 634 lines / CC 125 to 390 lines / CC 78, `parsePythonLockfile` is a CC 2 table dispatch, and the type leaf avoids a manifest/lockfile import cycle.
- Verification: `npm run test -- tests/core/languages/pythonManifests.test.ts -t "lockfile parsers"` failed before the extraction, then `npm run test -- tests/core/languages/pythonManifests.test.ts`, `npm run test -- tests/core/languages/pythonManifests.test.ts tests/core/upgradePreview.test.ts tests/mcp/pythonUpgradeFallback.test.ts tests/analyzers/pythonDependencyRiskCheck.test.ts tests/analyzers/pythonUnusedDependencyCheck.test.ts`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm exec projscan -- file src/core/languages/pythonManifests.ts --format json`, `npm exec projscan -- file src/core/languages/pythonLockfiles.ts --format json`, and `npm exec projscan -- file src/core/languages/pythonProjectTypes.ts --format json` passed after the change.

## 2026-06-16: Extract hotspot issue-linking helpers

- Status: accepted
- Context: `src/core/hotspotAnalyzer.ts` remained a hotspot after git churn extraction, and issue-to-file indexing plus legacy path-boundary matching was cohesive mapping behavior embedded in the scoring module.
- Decision: Move issue location indexing and legacy path substring boundary checks into `src/core/hotspotIssues.ts`, keeping `analyzeHotspots` output unchanged.
- Consequences: `src/core/hotspotAnalyzer.ts` drops from 504 lines / CC 82 to 425 lines / CC 63, while `indexIssuesByFile` is a CC 4 boundary in a non-hotspot helper module.
- Verification: `npm run test -- tests/core/hotspotIssueLinking.test.ts -t "issue path matching"` failed before the extraction, then `npm run test -- tests/core/hotspotIssueLinking.test.ts -t "issue path matching"`, `npm run test -- tests/core/hotspotIssueLinking.test.ts tests/core/hotspotAnalyzer.test.ts tests/core/hotspotCoverage.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- file src/core/hotspotAnalyzer.ts --format json`, `npm exec projscan -- file src/core/hotspotIssues.ts --format json`, and `git diff --check` passed after the change.

## 2026-06-16: Extract MCP JSON-RPC dispatch routing

- Status: accepted
- Context: `src/mcp/server.ts` was a current hotspot and still mixed transport-level JSON-RPC method routing with tool, prompt, resource, watcher, and session behavior.
- Decision: Move JSON-RPC request/response types, error codes, response helpers, notification handling, and method dispatch into `src/mcp/serverDispatch.ts`, keeping the actual MCP operation handlers inside `createMcpServer`.
- Consequences: `src/mcp/server.ts` drops from 522 lines / CC 84 to 456 lines / CC 67 and loses the large-file warning; `dispatchMcpRequest` is a CC 2 helper in a non-hotspot module.
- Verification: `npm run test -- tests/mcp/server.test.ts -t "JSON-RPC dispatch"` failed before the extraction, then `npm run test -- tests/mcp/server.test.ts -t "JSON-RPC dispatch"`, `npm run test -- tests/mcp/server.test.ts tests/mcp/serverBudget.test.ts tests/mcp/progress.test.ts tests/mcp/fileChangedNotifications.test.ts tests/mcp/sessionIntegration.test.ts tests/mcp/crossCutting.test.ts tests/mcp/costSidecarIntegration.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- file src/mcp/server.ts --format json`, `npm exec projscan -- file src/mcp/serverDispatch.ts --format json`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, and `npm exec projscan -- bug-hunt --format json` passed after the change; stale remembered-session conflicts were cleared with `npm exec projscan -- session reset --format json`, leaving only the expected manual release sign-off action.

## 2026-06-16: Extract Markdown PR-diff reporter

- Status: accepted
- Context: `src/reporters/markdownReporter.ts` remained a hotspot, and PR structural-diff Markdown rendering was an independent reporter surface embedded in the broad Markdown reporter barrel.
- Decision: Move `reportPrDiffMarkdown` and its private rendering helpers into `src/reporters/markdownPrDiffReporter.ts`, while preserving the existing `markdownReporter` public re-export.
- Consequences: `src/reporters/markdownReporter.ts` drops from 404 lines / CC 80 to 333 lines / CC 61, and direct PR-diff Markdown output coverage now lives beside the split module.
- Verification: `npm run test -- tests/reporters/markdownReporter.test.ts -t "PR diff rendering"` failed before the extraction, then `npm run test -- tests/reporters/markdownReporter.test.ts -t "PR diff rendering"`, `npm run test -- tests/reporters/markdownPrDiffReporter.test.ts tests/reporters/markdownReporter.test.ts tests/reporters/markdownDiffReporter.test.ts tests/reporters/markdownReviewReporter.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- file src/reporters/markdownReporter.ts --format json`, `npm exec projscan -- file src/reporters/markdownPrDiffReporter.ts --format json`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed after the change.

## 2026-06-16: Extract Markdown coverage reporter

- Status: accepted
- Context: After the PR-diff split, `src/reporters/markdownReporter.ts` was still a hotspot and coverage-by-hotspot Markdown rendering remained another independent CLI/reporting surface inside the barrel.
- Decision: Move `reportCoverageMarkdown` into `src/reporters/markdownCoverageReporter.ts`, keep the existing `markdownReporter` public re-export, and add direct Markdown coverage output tests.
- Consequences: `src/reporters/markdownReporter.ts` drops from 333 lines / CC 61 to 299 lines / CC 54, while `reportCoverageMarkdown` is a CC 2 boundary in a non-hotspot module.
- Verification: `npm run test -- tests/reporters/markdownReporter.test.ts -t "coverage rendering"` failed before the extraction, then `npm run test -- tests/reporters/markdownCoverageReporter.test.ts tests/reporters/markdownReporter.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- file src/reporters/markdownReporter.ts --format json`, `npm exec projscan -- file src/reporters/markdownCoverageReporter.ts --format json`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed after the change.

## 2026-06-16: Extract Markdown coupling reporter

- Status: accepted
- Context: `src/reporters/markdownReporter.ts` still carried coupling and cycle Markdown rendering even though the console coupling renderer already lived in its own module. The release-owner/persona risk is reviewer fatigue from one large Markdown barrel accumulating unrelated report surfaces.
- Decision: Move `reportCouplingMarkdown` into `src/reporters/markdownCouplingReporter.ts`, keep the existing `markdownReporter` public re-export, and add direct Markdown coupling output tests.
- Consequences: `src/reporters/markdownReporter.ts` drops from 299 lines / CC 54 to 257 lines / CC 47, while `reportCouplingMarkdown` is a CC 1 boundary in a non-hotspot module.
- Verification: `npm run test -- tests/reporters/markdownReporter.test.ts -t "coupling rendering"` failed before the extraction, then `npm run test -- tests/reporters/markdownCouplingReporter.test.ts tests/reporters/markdownReporter.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- file src/reporters/markdownReporter.ts --format json`, `npm exec projscan -- file src/reporters/markdownCouplingReporter.ts --format json`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed after the change.

## 2026-06-16: Extract Markdown outdated reporter

- Status: accepted
- Context: `src/reporters/markdownReporter.ts` still owned outdated-package Markdown rendering after adjacent report surfaces had been split. For OSS maintainers, that kept dependency-drift output coupled to unrelated health, structure, and hotspot rendering.
- Decision: Move `reportOutdatedMarkdown` into `src/reporters/markdownOutdatedReporter.ts`, keep the existing `markdownReporter` public re-export, and add direct Markdown outdated-package output tests.
- Consequences: `src/reporters/markdownReporter.ts` drops from 257 lines / CC 47 to 226 lines / CC 40, while `reportOutdatedMarkdown` is a CC 3 boundary in a non-hotspot module.
- Verification: `npm run test -- tests/reporters/markdownReporter.test.ts -t "outdated package rendering"` failed before the extraction, then `npm run test -- tests/reporters/markdownOutdatedReporter.test.ts tests/reporters/markdownReporter.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- file src/reporters/markdownReporter.ts --format json`, `npm exec projscan -- file src/reporters/markdownOutdatedReporter.ts --format json`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed after the change.

## 2026-06-16: Extract Markdown hotspot reporter

- Status: accepted
- Context: Hotspot Markdown rendering remained inside `src/reporters/markdownReporter.ts` even though hotspot evidence is one of the main roadmap validation surfaces. Keeping it in the barrel made maintainability evidence harder for reviewers to isolate.
- Decision: Move `reportHotspotsMarkdown` into `src/reporters/markdownHotspotReporter.ts`, keep the existing `markdownReporter` public re-export, and add direct Markdown hotspot output tests.
- Consequences: `src/reporters/markdownReporter.ts` drops from 226 lines / CC 40 to 191 lines / CC 34, while `reportHotspotsMarkdown` is a CC 2 boundary in a non-hotspot module.
- Verification: `npm run test -- tests/reporters/markdownReporter.test.ts -t "hotspot rendering"` failed before the extraction, then `npm run test -- tests/reporters/markdownHotspotReporter.test.ts tests/reporters/markdownReporter.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- file src/reporters/markdownReporter.ts --format json`, `npm exec projscan -- file src/reporters/markdownHotspotReporter.ts --format json`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed after the change.

## 2026-06-16: Extract Markdown workspace reporter

- Status: accepted
- Context: Workspace discovery Markdown rendering remained in `src/reporters/markdownReporter.ts` despite the console workspace renderer already being split. Team personas that review monorepo evidence benefit from a small module tied to workspace output only.
- Decision: Move `reportWorkspacesMarkdown` into `src/reporters/markdownWorkspaceReporter.ts`, keep the existing `markdownReporter` public re-export, and add direct Markdown workspace output tests.
- Consequences: `src/reporters/markdownReporter.ts` drops from 191 lines / CC 34 to 170 lines / CC 28, while `reportWorkspacesMarkdown` is a CC 3 boundary in a non-hotspot module.
- Verification: `npm run test -- tests/reporters/markdownReporter.test.ts -t "workspace rendering"` failed before the extraction, then `npm run test -- tests/reporters/markdownWorkspaceReporter.test.ts tests/reporters/markdownReporter.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- file src/reporters/markdownReporter.ts --format json`, `npm exec projscan -- file src/reporters/markdownWorkspaceReporter.ts --format json`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed after the change.

## 2026-06-16: Extract Markdown explanation reporter

- Status: accepted
- Context: File explanation Markdown remained in `src/reporters/markdownReporter.ts` as the highest-complexity local function after the workspace split. Separating it keeps file-understanding output independent from CI and health output.
- Decision: Move `reportExplanationMarkdown` into `src/reporters/markdownExplanationReporter.ts`, keep the existing `markdownReporter` public re-export, and add direct Markdown explanation output tests.
- Consequences: `src/reporters/markdownReporter.ts` drops from 170 lines / CC 28 to 137 lines / CC 21, while `reportExplanationMarkdown` is a CC 1 boundary in a non-hotspot module.
- Verification: `npm run test -- tests/reporters/markdownReporter.test.ts -t "file explanation rendering"` failed before the extraction, then `npm run test -- tests/reporters/markdownExplanationReporter.test.ts tests/reporters/markdownReporter.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- file src/reporters/markdownReporter.ts --format json`, `npm exec projscan -- file src/reporters/markdownExplanationReporter.ts --format json`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed after the change.

## 2026-06-16: Extract Markdown health reporter

- Status: accepted
- Context: Health and CI Markdown rendering shared score and report-control logic inside `src/reporters/markdownReporter.ts`. Keeping those paths in the barrel mixed release-gate output with architecture diagram and structure output.
- Decision: Move `reportHealthMarkdown`, `reportCiMarkdown`, and the Markdown report-controls helper into `src/reporters/markdownHealthReporter.ts`, keep existing `markdownReporter` public re-exports, and add direct health/CI Markdown output tests.
- Consequences: `src/reporters/markdownReporter.ts` drops from 137 lines / CC 21 to 60 lines / CC 7, while both exported health renderers are CC 1 boundaries in a non-hotspot module.
- Verification: `npm run test -- tests/reporters/markdownReporter.test.ts -t "health and CI rendering"` failed before the extraction, then `npm run test -- tests/reporters/markdownHealthReporter.test.ts tests/reporters/markdownReporter.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- file src/reporters/markdownReporter.ts --format json`, `npm exec projscan -- file src/reporters/markdownHealthReporter.ts --format json`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed after the change.

## 2026-06-16: Extract Markdown architecture reporter

- Status: accepted
- Context: After health/CI extraction, `src/reporters/markdownReporter.ts` still owned the last local diagram and structure renderers. Keeping them there prevented the module from becoming a pure reporter barrel.
- Decision: Move `reportDiagramMarkdown`, `reportStructureMarkdown`, and the tree-line helper into `src/reporters/markdownArchitectureReporter.ts`, keep existing `markdownReporter` public re-exports, and add direct architecture Markdown output tests.
- Consequences: `src/reporters/markdownReporter.ts` drops from 60 lines / CC 7 to a 25-line / CC 1 re-export barrel with no local issues. `src/reporters/markdownArchitectureReporter.ts` is a non-hotspot module.
- Verification: `npm run test -- tests/reporters/markdownReporter.test.ts -t "architecture rendering"` failed before the extraction, then `npm run test -- tests/reporters/markdownArchitectureReporter.test.ts tests/reporters/markdownReporter.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- file src/reporters/markdownReporter.ts --format json`, `npm exec projscan -- file src/reporters/markdownArchitectureReporter.ts --format json`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed after the change.

## 2026-06-16: Extract AST module signal visitor

- Status: accepted
- Context: `src/core/ast.ts` remained the highest-risk hotspot, and its import/export visitor was a cohesive cluster already covered by AST import/export tests. The first extraction attempt created an `ast.ts` <-> `astModuleSignals.ts` cycle through shared types.
- Decision: Move top-level import/export collection into `src/core/astModuleSignals.ts`, move `SymbolKind`, `AstImport`, and `AstExport` into leaf module `src/core/astTypes.ts`, and re-export those types from `ast.ts` for compatibility.
- Consequences: `src/core/ast.ts` drops from 886 lines / CC 146 to 691 lines / CC 113; `src/core/astModuleSignals.ts` and `src/core/astTypes.ts` scan with no issues, and the extraction avoids circular imports.
- Verification: `npm run test -- tests/core/ast.functions.test.ts -t "module import/export collection"` failed before the extraction, then `npm run test -- tests/core/ast.test.ts tests/core/ast.functions.test.ts tests/core/ast.references.test.ts tests/core/ast.cyclomatic.test.ts`, `npm run typecheck`, `npm run typecheck:public-types`, `npm run lint`, `npm run build`, `npm exec projscan -- file src/core/ast.ts --format json`, `npm exec projscan -- file src/core/astModuleSignals.ts --format json`, `npm exec projscan -- file src/core/astTypes.ts --format json`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed after the change.

## 2026-06-16: Extract AST program signal traversal

- Status: accepted
- Context: `src/core/ast.ts` still mixed parse orchestration with whole-program call-site, dynamic import, require, traversal, and decision-point collection. That cluster is separate from function discovery and import/export collection.
- Decision: Move program signal collection and shared traversal/decision helpers into `src/core/astProgramSignals.ts`; keep `ast.ts` importing the helpers it still needs for function body analysis.
- Consequences: `src/core/ast.ts` drops from 691 lines / CC 113 to 575 lines / CC 91, while `src/core/astProgramSignals.ts` scans as a non-hotspot module with no issues.
- Verification: `npm run test -- tests/core/ast.functions.test.ts -t "program signal traversal"` failed before the extraction, then `npm run test -- tests/core/ast.test.ts tests/core/ast.functions.test.ts tests/core/ast.references.test.ts tests/core/ast.cyclomatic.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- file src/core/ast.ts --format json`, `npm exec projscan -- file src/core/astProgramSignals.ts --format json`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed after the change.

## 2026-06-16: Extract AST function naming helpers

- Status: accepted
- Context: `src/core/ast.ts` still carried function name recovery for declarations, assignments, methods, private names, and anonymous fallbacks. This logic is independent from traversal and function body analysis.
- Decision: Move function-name recovery into `src/core/astFunctionNames.ts` and keep `ast.ts` depending on the single `nameForFunctionNode` boundary.
- Consequences: `src/core/ast.ts` drops from 575 lines / CC 91 to 520 lines / CC 71, while `src/core/astFunctionNames.ts` scans as a non-hotspot module with no issues.
- Verification: `npm run test -- tests/core/ast.functions.test.ts -t "function naming helpers"` failed before the extraction, then `npm run test -- tests/core/ast.test.ts tests/core/ast.functions.test.ts tests/core/ast.references.test.ts tests/core/ast.cyclomatic.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- file src/core/ast.ts --format json`, `npm exec projscan -- file src/core/astFunctionNames.ts --format json`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed after the change.

## 2026-06-16: Extract AST body signal analysis

- Status: accepted
- Context: `src/core/ast.ts` still owned per-function body analysis for call sites, member calls, aliases, references, parameters, and nested-function skipping. This logic is cohesive but separate from function discovery.
- Decision: Move body signal analysis into `src/core/astBodySignals.ts`, move shared function-node detection into `src/core/astFunctionNodes.ts`, and keep `ast.ts` depending on exported analyzer/helper boundaries.
- Consequences: `src/core/ast.ts` drops from 520 lines / CC 71 to 379 lines / CC 49; both new modules scan as non-hotspots with no issues.
- Verification: `npm run test -- tests/core/ast.functions.test.ts -t "Babel body signal analysis"` failed before the extraction, then `npm run test -- tests/core/ast.test.ts tests/core/ast.functions.test.ts tests/core/ast.references.test.ts tests/core/ast.cyclomatic.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- file src/core/ast.ts --format json`, `npm exec projscan -- file src/core/astBodySignals.ts --format json`, `npm exec projscan -- file src/core/astFunctionNodes.ts --format json`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed after the change.

## 2026-06-16: Extract AST function collector

- Status: accepted
- Context: After body signal extraction, `src/core/ast.ts` still owned the recursive FunctionInfo collector and the public `FunctionInfo` type definition. This kept parse orchestration coupled to collection internals.
- Decision: Move recursive function collection into `src/core/astFunctionCollector.ts`, move `FunctionInfo` into leaf type module `src/core/astTypes.ts`, and re-export it from `ast.ts` for compatibility.
- Consequences: `src/core/ast.ts` drops from 379 lines / CC 49 to 117 lines / CC 9; review risk for `ast.ts` drops below the top-risk source modules, and the new collector/type modules scan as non-hotspots with no issues.
- Verification: `npm run test -- tests/core/ast.functions.test.ts -t "function collection"` failed before the extraction, then `npm run test -- tests/core/ast.test.ts tests/core/ast.functions.test.ts tests/core/ast.references.test.ts tests/core/ast.cyclomatic.test.ts`, `npm run typecheck`, `npm run typecheck:public-types`, `npm run lint`, `npm run build`, `npm exec projscan -- file src/core/ast.ts --format json`, `npm exec projscan -- file src/core/astFunctionCollector.ts --format json`, `npm exec projscan -- file src/core/astTypes.ts --format json`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed after the change.

## 2026-06-16: Extract review manifest diffing

- Status: accepted
- Context: After the AST extraction train, `src/core/review.ts` became the highest changed-file risk. Package manifest reading and dependency diffing were a cohesive release-owner concern embedded inside the review orchestrator, including high-complexity private helpers.
- Decision: Move manifest reading, dependency diffing, and package-scoped dependency filtering into `src/core/reviewManifests.ts`; keep `computeReview` importing the same boundaries and preserve the review report schema.
- Consequences: `src/core/review.ts` drops from CC 161 to CC 125 in the review pass. The first extraction added `diffOneManifest` at CC 17, so the bug pass blocked it as a risky function; splitting dependency diff buckets keeps the helper under the review threshold.
- Verification: `npm run test -- tests/core/review.test.ts -t "package manifest diffing"` failed before extraction, then failed again on the risky `diffOneManifest` helper before the bucket split. After the fix, `npm run test -- tests/core/review.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed with only the expected manual release sign-off gate remaining.

## 2026-06-16: Extract review contract changes

- Status: accepted
- Context: `src/core/review.ts` still owned public contract-change detection for exported symbols and package entrypoints. That logic is a release-review concern and was keeping the review orchestrator responsible for detailed public-surface comparisons.
- Decision: Move contract-change detection into `src/core/reviewContractChanges.ts`, keep `computeReview` calling a single `buildContractChanges` boundary, and split export/entrypoint helpers so moved functions stay below risky-function thresholds.
- Consequences: `src/core/review.ts` drops from CC 125 to CC 97 in the review pass and no longer appears as the top changed-file risk. The review schema, package scoping, export-change wording, and entrypoint-change wording stay unchanged.
- Verification: `npm run test -- tests/core/review.test.ts -t "public contract change detection"` failed before extraction, then `npm run test -- tests/core/review.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed with only the expected manual release sign-off gate remaining.

## 2026-06-16: Extract hotspot scoring

- Status: accepted
- Context: `src/core/hotspotAnalyzer.ts` was the highest changed-file risk after the review extractions and still mixed git/file orchestration with risk-score math and reason-string formatting.
- Decision: Move hotspot scoring, reason construction, author ranking, and author formatting into `src/core/hotspotScoring.ts`; keep `computeRiskScore` re-exported from `hotspotAnalyzer.ts` for compatibility.
- Consequences: `src/core/hotspotAnalyzer.ts` drops to CC 29 in the review pass. The first extraction left `computeRiskScore` at CC 11 in the new module, so the maintainability test forced a split of recency and coverage penalty helpers before the slice passed.
- Verification: `npm run test -- tests/core/hotspotAnalyzer.test.ts -t "scoring and reasons"` failed before extraction and then on scorer complexity, then `npm run test -- tests/core/hotspotAnalyzer.test.ts tests/core/hotspotCoverage.test.ts tests/core/hotspotIssueLinking.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed with only the expected manual release sign-off gate remaining.

## 2026-06-16: Extract review changed-file assembly

- Status: accepted
- Context: `src/core/review.ts` still assembled added, removed, and modified changed-file rows directly. That row-building logic is separate from the review worktree orchestration and verdict assembly.
- Decision: Move changed-file row assembly and hotspot-risk indexing into `src/core/reviewChangedFiles.ts`; keep `computeReview` passing the diff, base graph, head graph, and hotspot index into one boundary.
- Consequences: `src/core/review.ts` drops from CC 97 to CC 83 in the review pass. The review changed-file schema, sorting by hotspot risk, and per-status import/export/complexity fields stay unchanged.
- Verification: `npm run test -- tests/core/review.test.ts -t "changed-file assembly"` failed before extraction, then `npm run test -- tests/core/review.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed with only the expected manual release sign-off gate remaining.

## 2026-06-16: Extract review graph evidence

- Status: accepted
- Context: `src/core/review.ts` still built graph-evidence summaries and scoped graph copies directly. That evidence formatting is separate from review orchestration, diffing, and verdict decisions.
- Decision: Move graph-evidence assembly, scoped graph filtering, importer-map filtering, and top-package ranking into `src/core/reviewGraphEvidence.ts`; keep `computeReview` calling one `buildReviewGraphEvidence` boundary.
- Consequences: `src/core/review.ts` drops from CC 83 to CC 75 in the review pass. The graph evidence schema and scoping behavior stay unchanged.
- Verification: `npm run test -- tests/core/review.test.ts -t "graph evidence assembly"` failed before extraction, then `npm run test -- tests/core/review.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed with only the expected manual release sign-off gate remaining.

## 2026-06-16: Extract review flow diffs

- Status: accepted
- Context: `src/core/review.ts` still owned review-time taint and dataflow diffing, including config loading, base/head comparison, touched-file filtering, review-blocking filters, projection, and sorting.
- Decision: Move taint/dataflow diffing into `src/core/reviewFlowDiffs.ts`; keep `computeReview` calling `computeNewTaintFlows` and `computeNewDataflowRisks` while the new module owns config, keys, filters, mappers, and sorters.
- Consequences: `src/core/review.ts` drops from CC 75 to CC 52 in the review pass, and the top changed-file risk moves to `src/mcp/server.ts`. Review taint/dataflow schemas and generated/test/broad-file-IO filtering stay unchanged.
- Verification: `npm run test -- tests/core/review.test.ts -t "taint and dataflow diffing"` failed before extraction, then `npm run test -- tests/core/review.test.ts tests/core/dataflow.test.ts tests/core/taint.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed with only the expected manual release sign-off gate remaining.

## 2026-06-16: Extract MCP server context helpers

- Status: accepted
- Context: After review-flow extraction, `src/mcp/server.ts` became the top changed-file risk and still owned per-call tool context construction plus progress notification construction inside `createMcpServer`.
- Decision: Move tool context creation, watch unregister handling, tool notification wrapping, and progress emitter construction into `src/mcp/serverContext.ts`; keep `createMcpServer` wiring unchanged and pass the notify transport and watch registry into the helper boundary.
- Consequences: `src/mcp/server.ts` drops from CC 67 to CC 59 in the review pass. Tool notification payloads, progress notification payloads, watch IDs, and best-effort watch cleanup behavior stay unchanged. The bug pass also exposed that `tests/mcp/server.test.ts` was polluting real repo session memory by calling session-recording tools against `process.cwd()`, so those cases now use disposable fixture roots.
- Verification: `npm run test -- tests/mcp/server.test.ts -t "tool context and progress"` failed before extraction, then `npm run test -- tests/mcp/server.test.ts -t "session-recording tool tests|tools/call returns content|projscan_file"` caught and verified the fixture-root regression. After resetting stale ignored session memory with `npm exec projscan -- session reset --format json`, `npm run test -- tests/mcp/server.test.ts tests/mcp/progress.test.ts tests/mcp/coordinateWatch.test.ts tests/mcp/fileChangedNotifications.test.ts tests/mcp/crossCutting.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed; only the expected manual release sign-off gate remained.

## 2026-06-16: Add Express param dataflow source

- Status: accepted
- Context: The post-4.5 roadmap calls for framework dataflow additions only when each has a narrow request source, sink, and false-positive fixture. Express route handlers already covered request references, headers, and IP metadata, but not the common `req.param(...)` accessor.
- Decision: Add gated `req.param(...)` detection as `express.req.param` only inside Express handler call context, keep helper lookalikes quiet, and document the additive source in the dataflow guide surfaces.
- Consequences: `projscan_dataflow` and review dataflow can now flag Express route params flowing into default SQL sinks without broadening ordinary helper detection. The public JSON shape is unchanged; this only adds a new effective source string when the pattern is present.
- Verification: `npm run test -- tests/core/dataflow.test.ts -t "Express param accessor"` failed before the source was added, then passed. `npm run test -- tests/core/dataflow.test.ts tests/core/taint.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed; only the expected manual release sign-off gate remained.

## 2026-06-16: Redact unlocated report path text

- Status: accepted
- Context: Scoped/redacted evidence exports should not leak unnecessary repo structure. Existing path redaction replaced issue locations and path text backed by those locations, but an analyzer can emit an unlocated issue whose title, description, or action summary still contains a repo path.
- Decision: Add a conservative file-like path token redaction pass for issue text when `redactPaths` is enabled, after the existing location-based stable-label replacements.
- Consequences: Unlocated issue text such as `src/private/secret.ts` now becomes a stable `redacted-path-N` label. Location-backed redaction semantics, report metadata, scope filtering, and public output shapes remain unchanged.
- Verification: `npm run test -- tests/core/reportScope.test.ts -t "unlocated issues"` failed before the text-token redaction pass, then passed. `npm run test -- tests/core/reportScope.test.ts tests/reporters/jsonReporter.test.ts tests/reporters/sarifReporter.test.ts tests/reporters/markdownAnalysisReporter.test.ts tests/reporters/markdownHealthReporter.test.ts tests/reporters/htmlReporter.test.ts tests/cli/formatHandling.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed; only the expected manual release sign-off gate remained.
