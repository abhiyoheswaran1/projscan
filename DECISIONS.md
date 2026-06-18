# Decisions

This log records reviewer-visible architecture, workflow, and public behavior decisions.

## 2026-06-18: Keep global installs free of native parser scripts

- Status: accepted
- Context: `npm install -g projscan@latest` warned about seven tree-sitter language packages with native `node-gyp-build` install scripts. A packed local install also warned about projscan's own `prepare` script. Both warnings made the first install feel unsafe even though projscan ships generated WASM grammars in `dist/grammars`.
- Decision: Keep `web-tree-sitter` as the runtime dependency, move tree-sitter language packages to devDependencies as build-time WASM sources, and replace the published `prepare` lifecycle with `prepack`.
- Consequences: Global installs no longer need npm script approval for grammar packages or projscan itself. `npm pack` still builds and includes all grammar WASM files, and runtime parsing continues to load packaged assets.
- Verification: Pack smoke tests now guard runtime dependencies and all shipped grammar WASM files; a local packed global install completed without `allow-scripts` warnings and parsed a Python file from the installed CLI.

## 2026-06-18: Route handoff readiness to preflight

- Status: accepted
- Context: `projscan route/start` treated `is this branch ready to hand off?` as a generic review request because only the `branch` keyword matched. That undercut the daily before-handoff workflow after the UI already recommended the right `before_handoff` recipe.
- Decision: Treat handoff-readiness wording (`handoff`, `handover`, or `hand off`) as preflight-ready context and infer `before_commit` for those preflight intents.
- Consequences: Handoff readiness now starts with `projscan preflight --mode before_commit --format json`, while explicit next-agent handoff requests still route to `projscan agent-brief`.
- Verification: Focused router/start-mode/start regressions failed on the old review/default-mode behavior and passed after the guard and mode inference update.

## 2026-06-18: Split before-commit start workflow from pre-merge

- Status: accepted
- Context: `projscan start` inferred `before_commit` for handoff and commit-safety intents, but its recommended workflow still rendered as `Pre-Merge`. That made the daily before-handoff workflow look like an alias for release/merge review instead of a trusted PR handoff path.
- Decision: Add a dedicated `before_handoff` workflow recipe and map `before_commit` starts to it. Keep `before_merge` mapped to the existing `Pre-Merge` recipe.
- Consequences: Handoff and commit-safety starts now recommend `projscan bug-hunt`, `projscan preflight --mode before_commit`, and `projscan evidence-pack --pr-comment`, while merge/release-gate starts keep the before-merge preflight recipe.
- Verification: Focused start/MCP/CLI regressions failed on the old `pre_merge` mapping and passed after the workflow split.

## 2026-06-18: Ground package metadata in daily workflows

- Status: accepted
- Context: The npm package description was a 2,000+ character feature inventory with internal tool names and broad platform language, even though the strongest demonstrated product value is a small set of daily workflows.
- Decision: Replace the package description with concise workflow-first positioning: repo orientation before edits, proof before handoff or commit, release-candidate review, local execution, and MCP/CLI access.
- Consequences: npm metadata no longer sells breadth as the product. Command details remain in README and guide references, while package metadata now matches the trust-oriented docs and start workflow.
- Verification: Docs regression coverage now enforces a concise package description, requires the three daily workflows, and rejects the old feature-inventory markers.

## 2026-06-18: Collapse duplicate preflight manual sign-off reasons

- Status: accepted
- Context: `projscan preflight --mode before_merge` could report a large release-scale manual sign-off as separate `changed-files`, `release`, and `review` warning reasons. The verdict was correct, but the repeated caution made daily gate output noisier than the decision engineers needed to make.
- Decision: When release-scale evidence is detected without concrete blockers, keep one actionable `release` warning reason and preserve changed-file and review details in `evidence`, required checks, and suggested review actions.
- Consequences: Human preflight output is less repetitive, while JSON consumers can still inspect changed-file counts, review verdicts, review summaries, and release-scale evidence. If a large release also has a separate review block, that review reason remains visible and the release explanation tells users to inspect it.
- Verification: Regression tests failed on the duplicate reason array and misleading separate-block wording, then passed after the reason filtering and release-scale explanation update.

## 2026-06-18: Keep info diagnostics out of start adoption gaps

- Status: accepted
- Context: A clean `projscan start` report could still summarize optional `info` diagnostics such as missing local plugin manifests as adoption gaps, which made ready daily workflows look incomplete.
- Decision: Shape `StartReport.adoptionGaps` from warning and failure diagnostics only. Keep `info` diagnostics in setup diagnostics where they remain visible as optional context.
- Consequences: Start summaries and console adoption gaps stop counting optional plugin setup as missing adoption work, while warning/failure setup gaps and mission status behavior remain unchanged.
- Verification: Focused adoption-gap and start report tests failed when `plugins` info was counted and passed after filtering to `warn`/`fail`.

## 2026-06-18: Promote daily workflows in start console

- Status: accepted
- Context: `projscan start` included trusted daily workflows, but the normal console printed them after Mission Control, execution plans, proof queues, review gates, risks, and onboarding, so feature breadth still dominated the first screen.
- Decision: Move the existing `Daily Workflows` console section immediately after the workflow header and before Mission Control. Keep the section content and `StartReport` JSON unchanged.
- Consequences: Human console users see the three repeatable workflows before the broader mission/proof surface, while JSON clients and daily workflow definitions remain stable.
- Verification: CLI ordering coverage failed before the move and passed after rebuilding the CLI output.

## 2026-06-18: Ground roadmap positioning in daily workflows

- Status: accepted
- Context: The roadmap still led with broad market, substrate, and competitive-claim language after the product docs and start output had narrowed around three demonstrated daily workflows.
- Decision: Rewrite the roadmap vision, strategic context, competitive framing, and strategy labels to lead with repeatable local proof for before-edit, before-handoff/commit, and release-candidate-review workflows.
- Consequences: Historical release details stay intact, but future roadmap edits now have a docs regression that rejects selected overclaim phrases and requires the daily-workflow proof framing.
- Verification: `tests/docs/startRoutingDocs.test.ts` failed before the roadmap carried the daily-workflow proof language and passed after the positioning update.

## 2026-06-18: Calibrate healthy start summary watch wording

- Status: accepted
- Context: `projscan start` could report a healthy or excellent quality scorecard while its top-level summary still described scorecard hotspot evidence as `quality risk(s)`. That made normal watch items sound like a concrete defect queue.
- Decision: Pass the quality scorecard verdict into start summary assembly and use `quality watch item(s)` for `excellent` or `healthy` verdicts. Keep `quality risk(s)` for `needs_attention` and `blocked` verdicts.
- Consequences: Start JSON shape, `topRisks`, scoring, Mission Control routing, and workflow selection remain unchanged. Humans get less alarm wording when the scorecard is healthy, while degraded verdicts still keep risk language.
- Verification: Focused Mission Control policy tests failed on the old summary wording and passed after the verdict-aware summary label was added.

## 2026-06-18: Calibrate bug-hunt manual sign-off wording

- Status: accepted
- Context: `projscan bug-hunt` kept release-scale manual sign-off gates visible, but manual sign-off-only queues still printed `fix:` in the summary and `Bug Hunt: fix` in console output. That made a review gate look like concrete defect work.
- Decision: Keep `BugHuntReport.verdict` and `fixQueue` unchanged for public compatibility, but change manual sign-off-only summaries to `review:` and make the default console headline print `Bug Hunt: review` for that summary.
- Consequences: JSON consumers that branch on `verdict: "fix"` continue to work, regression-plan and evidence-pack sign-off detection still uses the manual sign-off summary text, and humans see review/sign-off wording instead of a defect-fix headline.
- Verification: Focused core and CLI regressions failed on the old wording, then passed after the summary and console calibration.

## 2026-06-18: Expose start daily workflows

- Status: accepted
- Context: README and guide now lead with three daily workflows, but `projscan start` still emphasized a broader onboarding ladder before those repeatable work paths.
- Decision: Add an optional `dailyWorkflows` public field to `StartReport`, populate it for computed start reports, and print a `Daily Workflows` console section before `First 10 Minutes`.
- Consequences: Existing `StartReport` consumers remain source-compatible because the field is optional, while JSON and console users get the three demonstrated workflows for before-edit, before-handoff/commit, and release-candidate review.
- Verification: Core and CLI regressions failed before the field and console section existed, then passed after the additive start output change.

## 2026-06-18: Extract start claim route criteria helper

- Status: accepted
- Context: `src/core/startSuccessCriteria.ts` still owned claim-route success criteria after other route-specific helper extractions, even though claim add/list criteria only depend on the routed tool and action-plan shape.
- Decision: Move claim add/list success-criteria assembly into `src/core/startClaimRouteCriteria.ts`, while keeping resolver ordering and dispatch in `src/core/startSuccessCriteria.ts`.
- Consequences: Claim-add routes still require active-claim review before adding a claim, claim-list routes still use active-claim review criteria, and Mission Control wording remains unchanged.
- Verification: Architecture coverage failed before the helper existed and passed after extraction; focused coordination-routing tests cover claim add and list success criteria.

## 2026-06-18: Extract start product-planning route criteria helper

- Status: accepted
- Context: `src/core/startSuccessCriteria.ts` still owned product-planning workplan route detection and bug-hunt criteria after other route-specific helper extractions, while `startMode` depended on the route detector through the main facade.
- Decision: Move `isProductPlanningWorkplanRoute` and product-planning success-criteria assembly into `src/core/startProductPlanningRouteCriteria.ts`, while re-exporting the detector from `src/core/startSuccessCriteria.ts`.
- Consequences: High-confidence product workplan routes still infer bug-hunt mode and get the same accept/defer/split criteria only in bug-hunt mode. Existing internal imports stay stable.
- Verification: Architecture coverage failed before the helper existed and passed after extraction; focused start planning and success-criteria tests preserve generic build-next and product-roadmap routing behavior.

## 2026-06-18: Extract start impact route criteria helper

- Status: accepted
- Context: `src/core/startSuccessCriteria.ts` stayed on the current hotspot list after preflight extraction, and impact-route guidance was a self-contained rule set for fuzzy search-to-impact workflows.
- Decision: Move impact success-criteria assembly into `src/core/startImpactRouteCriteria.ts`, while keeping resolver ordering and `impactSuccessCriteria` dispatch in `src/core/startSuccessCriteria.ts`.
- Consequences: Fuzzy impact routes still require exact symbol or file selection before impact analysis, and default impact criteria wording and ordering stay unchanged.
- Verification: Architecture coverage failed before the helper existed and passed after extraction; focused success-criteria tests preserve fuzzy impact search gating.

## 2026-06-18: Extract start preflight route criteria helper

- Status: accepted
- Context: `src/core/startSuccessCriteria.ts` remained a current hotspot after route-specific helper extractions, and preflight route criteria owned the highest-complexity remaining function plus exported helper behavior used by Mission Control internals.
- Decision: Move `isPreflightAction`, `preflightModeForMission`, and preflight success-criteria assembly into `src/core/startPreflightRouteCriteria.ts`, while re-exporting the helper names from `src/core/startSuccessCriteria.ts` for existing imports.
- Consequences: Preflight criteria wording, routed-mode behavior, mode mapping, resolver order, and Mission Control output stay unchanged while the main resolver module owns less route-specific logic.
- Verification: Architecture coverage failed before the helper existed and passed after extraction; focused success-criteria tests preserve routed preflight mode behavior.

## 2026-06-18: Extract post-4.4 roadmap catalog entries

- Status: accepted
- Context: `src/core/roadmapCatalog.ts` mixed shipped 3.x catalog entries with the actively changing post-4.4 product train, and focused file review flagged it as a large catalog file.
- Decision: Move the 4.5.x through 4.9.x catalog entries into `src/core/roadmapCatalogPost44.ts` with a shared `RoadmapCatalogEntry` type, and compose the combined catalog in `src/core/roadmapCatalog.ts`.
- Consequences: Release-train output, default lines, task IDs, task ordering, and verification commands remain unchanged while current roadmap edits can land in the post-4.4 helper.
- Verification: Release-train architecture coverage failed before the helper existed and passed after extraction; focused file scans showed no remaining large-file warning for the main catalog or helper.

## 2026-06-18: Align release-train swarm proof with preflight coordination evidence

- Status: accepted
- Context: The post-4.4 release-train swarm coordination task already required preflight coordination evidence to stay separated from remembered session context, but its verification command list only named collisions, coordinate, and agent-brief.
- Decision: Add `projscan preflight --mode before_edit --format json` to the 4.6 swarm coordination validation task between the one-call coordination verdict and the agent handoff packet.
- Consequences: Release-train planning stays read-only and keeps existing commands while making the pre-edit safety gate part of the swarm proof path agents follow from roadmap guidance.
- Verification: Release-train coverage failed before the preflight command was present in the 4.6 task and passed after the catalog update.

## 2026-06-18: Add preflight coordination proof path

- Status: accepted
- Context: `projscan preflight` exposed compact coordination readiness counts, but not the command path, local-only source marker, current worktree summary, validation workflow, or session-boundary reminder already emitted by `projscan coordinate` and agent-brief coordination hints.
- Decision: Preserve the existing `evidence.coordination` fields and add optional proof fields copied from `CoordinationSummary.evidence` when coordination evidence is available.
- Consequences: Preflight JSON remains schema-compatible and additive while giving agent handoffs the same local-only coordination proof path before edits, commits, and merges.
- Verification: Focused preflight coordination coverage failed before `commandPath` was present and passed after the additive fields were copied into preflight evidence.

## 2026-06-18: Extract start coupling route criteria helper

- Status: accepted
- Context: `src/core/startSuccessCriteria.ts` still owned coupling-route success criteria after earlier route-specific extractions, even though the criteria only branch on coupling direction.
- Decision: Move coupling direction handling and coupling success-criteria assembly into `src/core/startCouplingRouteCriteria.ts`, while keeping resolver ordering and `couplingRouteSuccessCriteria` dispatch in `src/core/startSuccessCriteria.ts`.
- Consequences: Coupling criteria wording and order stay unchanged for cycles-only and default/all directions. Architecture-routing tests and direct success-criteria tests cover the same user-facing strings.
- Verification: Architecture guard failed before extraction and passed after it. Focused success-criteria tests cover cycles-only and default/all coupling criteria.

## 2026-06-18: Extract start dependency route criteria helper

- Status: accepted
- Context: `src/core/startSuccessCriteria.ts` still owned dependency-route license and bundle-size keyword criteria beside Mission Control resolver orchestration.
- Decision: Move dependency license and bundle keyword groups plus dependency success-criteria assembly into `src/core/startDependencyRouteCriteria.ts`, while keeping resolver ordering and `dependenciesRouteSuccessCriteria` dispatch in `src/core/startSuccessCriteria.ts`.
- Consequences: Dependency criteria wording and order stay unchanged for license, bundle-size, combined, and default dependency inventory cases. The resolver module keeps route dispatch without owning dependency-specific keyword lists.
- Verification: Architecture guard failed before extraction and passed after it. Focused success-criteria tests now cover license, bundle, combined, and default dependency criteria.

## 2026-06-18: Extract start regression route criteria helper

- Status: accepted
- Context: `src/core/startSuccessCriteria.ts` still carried route-specific complexity after fixed, file, and understand criteria extractions, and regression-plan level selection plus incident/setup keyword handling formed a self-contained rule set.
- Decision: Move regression-plan level selection, keyword-specific criteria, and regression success-criteria assembly into `src/core/startRegressionRouteCriteria.ts`, while keeping resolver ordering and `regressionRouteSuccessCriteria` dispatch in `src/core/startSuccessCriteria.ts`.
- Consequences: Regression criteria wording and order stay unchanged for smoke, focused, full, production/incident, local setup, and default focused cases. The resolver module keeps route dispatch without owning regression-level fallback or keyword groups.
- Verification: Architecture guard failed before extraction and passed after it. Focused success-criteria tests now cover smoke, incident, setup, invalid-level fallback, and existing full-level criteria.

## 2026-06-18: Extract start understand route criteria helper

- Status: accepted
- Context: `src/core/startSuccessCriteria.ts` still had high complexity after fixed-route and file-route extractions, and understand-route view and contract criteria were a self-contained user-facing rule set.
- Decision: Move understand-route view criteria, contract criteria, and contract keyword predicates into `src/core/startUnderstandRouteCriteria.ts`, while keeping resolver ordering, `understandRouteSuccessCriteria`, `buildMissionSuccessCriteria`, and public helper exports in `src/core/startSuccessCriteria.ts`.
- Consequences: Understand success-criteria wording and order stay unchanged for map, flow, verify, change, contracts, local service, script discovery, database setup, environment setup, and default public API contract cases. The resolver module keeps route dispatch without owning understand-specific keyword predicates.
- Verification: Architecture guard failed before extraction and passed after it. Focused success-criteria tests now cover understand view criteria and contract signal ordering across local service, scripts, database, env, and default API matches.

## 2026-06-18: Extract start file route criteria helper

- Status: accepted
- Context: `src/core/startSuccessCriteria.ts` remained a large Mission Control helper after the fixed-route extraction, and file-route criteria rules were a self-contained rule table with local helper predicates.
- Decision: Move file-route criteria rules and helper predicates into `src/core/startFileRouteCriteria.ts`, while keeping resolver ordering, `fileRouteSuccessCriteria`, `buildMissionSuccessCriteria`, and public helper exports in `src/core/startSuccessCriteria.ts`.
- Consequences: File-route success-criteria wording and order stay unchanged for risk, coverage, reviewer, read, history, and test-authoring matches. The resolver module keeps dynamic route dispatch without owning the file-specific rule table.
- Verification: Architecture guard failed before extraction and passed after it. Focused success-criteria tests now cover history, read, and test-authoring order in addition to the existing file-route criteria order.

## 2026-06-18: Extract start fixed route criteria helper

- Status: accepted
- Context: `src/core/startSuccessCriteria.ts` remained a large Mission Control helper and still owned the static per-tool success-criteria table beside dynamic criteria resolvers.
- Decision: Move fixed route criteria into `src/core/startFixedRouteCriteria.ts`, while keeping resolver ordering, dynamic route-specific criteria, `buildMissionSuccessCriteria`, and public helper exports in `src/core/startSuccessCriteria.ts`.
- Consequences: Success-criteria wording and order for fixed routes stay unchanged. Dynamic criteria for preflight, impact, product planning, understand, claim, dependencies, regression, file, and coupling stayed in the resolver module at the time of the extraction.
- Verification: Architecture guard failed before extraction and passed after it. Focused success-criteria, start planning, and Mission Policy tests passed, and focused `projscan file` checks showed no issues in the helper or resolver.

## 2026-06-18: Route generic build-next start intents to workplan

- Status: accepted
- Context: `projscan start --intent "what should we build next?"` still chose release approval as the primary workflow because `build + next` satisfied release-planning signals. In no-release implementation loops this pushes users toward release gates instead of the actionable before-edit workplan they asked for.
- Decision: Narrow release-planning intent matches to explicit roadmap/workstream wording or `plan + product/feature` wording, and treat generic `build + next` prompts as `projscan_workplan --mode before_edit`.
- Consequences: Generic build-next prompts now start with an implementation workplan and do not expose release `roadmapPreview` as primary evidence. Explicit product-roadmap and release-readiness prompts still route to `projscan_release_train`, and explicit bug-hunt prompts remain unchanged.
- Verification: Focused intent-router, start, success-criteria, docs, and CLI-routing tests failed before the guard change and passed after it. Rebuilt CLI smoke checks verify generic build-next and explicit roadmap/release prompts separately.

## 2026-06-18: Extract framework source resolver helpers

- Status: accepted
- Context: `src/core/frameworkSources.ts` remained a high-churn framework dataflow hotspot and still owned per-framework resolver wrapper functions plus resolver ordering inside the public framework request-source facade.
- Decision: Move the framework request-source context type into `src/core/frameworkSourceContext.ts` and move resolver ordering/wrappers into `src/core/frameworkSourceResolvers.ts`, while keeping `FRAMEWORK_REQUEST_SOURCES` and `frameworkRequestSourceForFunction(context)` exported from `src/core/frameworkSources.ts`.
- Consequences: Public imports, request-source constants, resolver order, matcher inputs, taint/dataflow request-source detection, and framework-specific matcher behavior stay unchanged. The shared framework facade no longer imports matcher functions directly.
- Verification: Architecture guard failed before helper extraction and passed after extraction. Focused framework source, dataflow, and taint tests passed, and focused `projscan file` checks showed no issues in `src/core/frameworkSources.ts` or `src/core/frameworkSourceResolvers.ts`.

## 2026-06-18: Extract preflight report assembly helper

- Status: accepted
- Context: `src/core/preflight.ts` remained a high-churn safety-gate hotspot and still owned release-scale evidence, reason assembly, verdict/evidence/report shaping, truncation, required checks, suggested actions, tool calls, and summary assembly inside `computePreflight`.
- Decision: Move preflight report assembly into `src/core/preflightReport.ts`, while keeping mode/default option handling, input loading, `computePreflight(rootPath, options)`, `ComputePreflightOptions`, and preflight verdict re-exports in `src/core/preflight.ts`.
- Consequences: Input collection, mode defaults, max changed-file defaults, release-scale manual sign-off handling, required checks, suggested actions, tool calls, truncation, summary text, and report schema stay unchanged. The public preflight facade no longer imports report-shaping dependencies directly.
- Verification: Architecture guard failed before helper extraction and passed after extraction. Focused preflight behavior and release-scale tests passed, and focused `projscan file` checks showed no issues in `src/core/preflight.ts` or `src/core/preflightReport.ts`.

## 2026-06-18: Extract review computation helper

- Status: accepted
- Context: `src/core/review.ts` remained a high-churn merge-readiness hotspot and still owned review state dispatch, no-change intent annotation, and changed-report delegation inside the public `computeReview` facade.
- Decision: Move review computation dispatch into `src/core/reviewComputation.ts`, while keeping the public `computeReview(rootPath, options)`, `ReviewOptions`, and review tier exports in `src/core/review.ts`.
- Consequences: Unavailable reports, no-change reports, dirty same-SHA review behavior, no-change intent annotation, changed-review report assembly, verdict logic, and public imports stay unchanged. The review facade no longer imports state, intent, or changed-report helpers directly.
- Verification: Architecture guard failed before helper extraction and passed after extraction. Focused review behavior and intent integration tests passed, and focused `projscan file` checks showed no issues in `src/core/review.ts` or `src/core/reviewComputation.ts`.

## 2026-06-18: Extract intent router resolution helper

- Status: accepted
- Context: `src/core/intentRouter.ts` remained the top high-churn hotspot and still owned empty-intent catalog fallback, tokenization, route scoring, and result shaping inside the public `routeIntent` facade.
- Decision: Move route resolution orchestration into `src/core/intentRouterResolution.ts`, while keeping `ROUTE_CATALOG`, route types, and public `routeIntent(intent)` exports in `src/core/intentRouter.ts`.
- Consequences: Empty-intent catalog output, keyword tokenization, scoring order, tie behavior, confidence/result shaping, and public imports stay unchanged. The public router facade no longer imports tokenization, scoring, or result-builder helpers directly.
- Verification: Architecture guard failed before helper extraction and passed after extraction. Focused intent-router behavior tests passed, and focused `projscan file` checks showed no issues in `src/core/intentRouter.ts` or `src/core/intentRouterResolution.ts`.

## 2026-06-18: Extract MCP server message handler helper

- Status: accepted
- Context: `src/mcp/server.ts` remained a high-churn MCP server hotspot and still owned JSON-RPC line handling, parser/dispatch branching, and response serialization inside `createMcpServer`.
- Decision: Move JSON-RPC line handling into `src/mcp/serverMessageHandling.ts`, while keeping server lifecycle/session/dispatch wiring and public `createMcpServer`/`runMcpServer` exports in `src/mcp/server.ts`.
- Consequences: Parse errors, invalid-request errors, notification null responses, dispatch behavior, response serialization, server handle shape, and close behavior stay unchanged. `server.ts` no longer imports parser/dispatch helpers directly.
- Verification: Architecture guard failed before helper extraction and passed after extraction. Focused MCP server tests passed, and focused `projscan file` checks showed no issues in `src/mcp/server.ts` or `src/mcp/serverMessageHandling.ts`.

## 2026-06-18: Extract AST parse result helper

- Status: accepted
- Context: `src/core/ast.ts` remained a high-churn core hotspot and still owned parsed AST result assembly after parser setup, module traversal, program-signal collection, and function collection were already split into helpers.
- Decision: Move unparsed result shaping and parsed AST success-result assembly into `src/core/astResult.ts`, while keeping `parseSource`, `isParseable`, and public AST type re-exports available from `src/core/ast.ts`.
- Consequences: Non-source results, parser failure results, import/export extraction, call-site deduplication, line count, file-level cyclomatic complexity, and function collection stay unchanged. `parseSource` now only decides whether to parse and delegates result construction.
- Verification: Architecture guard failed before helper extraction and passed after extraction. Focused AST behavior tests passed, and focused `projscan file` checks showed no issues in `src/core/ast.ts` or `src/core/astResult.ts`.

## 2026-06-18: Extract MCP tool definition shaping helper

- Status: accepted
- Context: `src/mcp/tools.ts` is a high-churn MCP adoption hotspot and still owned deprecation-aware tool definition projection alongside public registry lookup helpers.
- Decision: Move MCP tool definition projection into `src/mcp/toolDefinitions.ts`, while keeping `getToolDefinitions`, `getToolHandler`, and public MCP type re-exports in `src/mcp/tools.ts`.
- Consequences: Public MCP tool names, handlers, input schemas, deprecation metadata, and description prefix behavior stay unchanged. The registry facade no longer imports deprecation rendering or owns per-tool definition shaping.
- Verification: Architecture guard failed before helper extraction and passed after extraction. Focused MCP server/deprecation tests passed, and focused `projscan file` checks showed no issues in `src/mcp/tools.ts` or `src/mcp/toolDefinitions.ts`.

## 2026-06-18: Extract analyzer plugin execution helper

- Status: accepted
- Context: `src/core/plugins.ts` remained a high-churn plugin hotspot and still owned analyzer plugin execution, malformed issue filtering, exception reporting, and plugin issue id/category stamping inside the public plugin facade.
- Decision: Move analyzer plugin execution into `src/core/pluginAnalyzerRunning.ts`, while re-exporting `runAnalyzerPlugins` from `src/core/plugins.ts`.
- Consequences: Public plugin imports stay unchanged. Analyzer execution still isolates thrown plugin checks, drops malformed issue output, prefixes issue ids with `plugin:<name>:`, and falls back to the manifest category when a plugin emits an empty category. `src/core/plugins.ts` drops to a smaller facade.
- Verification: Architecture guard failed before helper extraction and passed after extraction. Focused plugin behavior checks passed, and focused `projscan file` checks showed no issues in `src/core/plugins.ts` or `src/core/pluginAnalyzerRunning.ts`.

## 2026-06-18: Extract code graph incremental update helper

- Status: accepted
- Context: `src/core/codeGraph.ts` remained a high-churn production hotspot and still mixed public graph build/query exports with watch-mode incremental update internals, local star re-export refresh, fake `FileEntry` shaping, and in-place index rebuilding.
- Decision: Move adapter context preparation into `src/core/codeGraphAdapterContexts.ts` and move incremental graph update internals into `src/core/codeGraphIncremental.ts`, while re-exporting `incrementallyUpdateGraph` from `src/core/codeGraph.ts`.
- Consequences: Public graph imports stay unchanged, build graph behavior keeps the same parse/index/fan metric flow, and incremental watch updates still reparse changed paths before refreshing adapter contexts so manifest/root changes are visible. `src/core/codeGraph.ts` drops to a smaller public facade and graph builder.
- Verification: Architecture guard failed before extraction and passed after extraction. Focused code graph, incremental update, fan-in, and fan-out tests passed, and focused `projscan file` checks showed no issues in the facade or new helpers.

## 2026-06-18: Extract preflight reason assembly helper

- Status: accepted
- Context: `src/core/preflight.ts` remained a high-churn preflight hotspot and still owned supply-chain issue counting plus reason assembly inside the main `computePreflight` orchestrator.
- Decision: Move reason assembly and supply-chain issue counting into `src/core/preflightReasons.ts`, while keeping `computePreflight`, `decidePreflightVerdict`, and `summarizePreflight` exported from `src/core/preflight.ts`.
- Consequences: Reason ordering, release-scale manual sign-off caution behavior, review/context/changed-file reason formatting, required-check inputs, summary/verdict behavior, and public preflight imports stay unchanged. `src/core/preflight.ts` drops to a smaller orchestration module with only `computePreflight` as an owned function.
- Verification: Architecture guard failed before helper extraction and passed after extraction. Focused preflight behavior and release-scale tests passed, and focused `projscan file` checks showed no issues in `src/core/preflight.ts` or `src/core/preflightReasons.ts`.

## 2026-06-18: Extract Python pyproject evidence helper

- Status: accepted
- Context: `src/core/languages/pythonManifests.ts` remained a Python evidence hotspot and still owned `pyproject.toml` filesystem reads plus pyproject evidence assembly while parsing and package-root extraction already lived in focused helpers.
- Decision: Move `pyproject.toml` read/evidence assembly into `src/core/languages/pythonPyprojectEvidence.ts`, while keeping `detectPythonProject` behavior and parser re-exports available from `src/core/languages/pythonManifests.ts`.
- Consequences: Pyproject manifest reporting, declared dependency extraction, pyproject package-root inference, requirements, constraints, setuptools, lockfile handling, and public imports stay unchanged. The manifest facade no longer imports `fs`/`path` for pyproject IO and drops to lower complexity.
- Verification: Architecture guard failed before helper extraction and passed after extraction. AgentLoop task verification passed for the Python manifest architecture test, Python project detection tests, upgrade-preview pyproject/constraints/requirements tests, typecheck, lint, build, and focused `projscan file` checks. Post-slice bug pass found no concrete new defects; only the known release-scale manual sign-off remained.

## 2026-06-18: Extract analyzer plugin loading helper

- Status: accepted
- Context: `src/core/plugins.ts` remained the top hotspot and still owned analyzer plugin entry filtering, module readability checks, trust-status decisions, dynamic import validation, missing-export warning text, and load failure handling inside `loadPlugins`.
- Decision: Move analyzer plugin entry loading into `src/core/pluginAnalyzerLoading.ts` and move shared analyzer runtime types into leaf module `src/core/pluginRuntimeTypes.ts`; keep `loadPlugins(rootPath)` as the public facade in `src/core/plugins.ts`.
- Consequences: Analyzer plugins still require the preview flag plus trust-on-first-use approval before import, untrusted/changed/missing/syntax-error/missing-check-export behavior stays unchanged, public plugin type imports stay re-exported from `src/core/plugins.ts`, and `src/core/plugins.ts` drops from 345 lines / CC 33 to 278 lines / CC 25 without creating an import cycle.
- Verification: `npm run test -- tests/core/pluginArchitecture.test.ts`, `npm run test -- tests/core/plugins.test.ts`, and `npm run test -- tests/core/pluginTrustGate.test.ts`.

## 2026-06-18: Extract plugin manifest discovery helpers

- Status: accepted
- Context: `src/core/plugins.ts` remained the top hotspot after module-loading extraction and still owned manifest file reads, JSON parse diagnostics, and plugin directory discovery alongside analyzer/reporter runtime orchestration.
- Decision: Move plugin manifest constants, manifest file reading, JSON parse diagnostics, and directory discovery into `src/core/pluginManifestDiscovery.ts`, while re-exporting the existing public plugin constants and discovery functions from `src/core/plugins.ts`.
- Consequences: Public imports from `src/core/plugins.ts` stay unchanged, invalid JSON/read/validation diagnostics and sorted discovery behavior stay unchanged, CLI/MCP/plugin-DX callers keep the same facade, and `src/core/plugins.ts` drops from 426 lines / CC 42 to 345 lines / CC 33.
- Verification: `npm run test -- tests/core/pluginArchitecture.test.ts`, `npm run test -- tests/core/plugins.test.ts -t "discoverPluginManifests|readPluginManifestFile"`, and `npm run test -- tests/mcp/plugin.test.ts`.

## 2026-06-18: Extract plugin module loading helpers

- Status: accepted
- Context: `src/core/plugins.ts` remained the top hotspot and still owned module readability checks, dynamic import fallback, and module load error shaping alongside discovery, trust gating, analyzer loading, and reporter loading.
- Decision: Move plugin module readability checks, dynamic import fallback, and module load error descriptions into `src/core/pluginModuleLoading.ts`.
- Consequences: Analyzer and reporter plugin execution still requires the preview flag plus trust-on-first-use approval, missing/syntax/read-error diagnostics stay unchanged, public plugin exports stay unchanged, and `src/core/plugins.ts` drops from 530 lines / CC 54 to 426 lines / CC 42.
- Verification: `npm run test -- tests/core/pluginArchitecture.test.ts`, `npm run test -- tests/core/pluginTrustGate.test.ts`, and `npm run test -- tests/core/plugins.test.ts -t "loads a plugin and runs it through runAnalyzerPlugins"`.

## 2026-06-18: Read nested Python requirements manifests

- Status: accepted
- Context: Python upgrade previews could read root requirements files and nested requirements included by root files, but missed repos that keep primary requirements in common direct nested files such as `requirements/base.txt`, `requirements/prod.txt`, or `requirements/dev.in`.
- Decision: Treat a conservative set of direct `requirements/` manifests as Python project evidence, read them through the existing scanned-file-only requirements reader, classify dev/test/lint/docs/local nested files as dev scope, and use pinned nested `.txt` files as current-version evidence.
- Consequences: Offline Python upgrade previews now work for common pip-tools-style nested layouts without root includes, still ignore unscanned paths, and preserve safe include traversal behavior.
- Verification: `npm run test -- tests/core/languages/pythonProjectDetection.test.ts tests/core/upgradePreview.test.ts`.

## 2026-06-18: Extract telemetry event shaping helpers

- Status: accepted
- Context: `src/core/telemetry.ts` remained the top hotspot after config extraction and still owned event shape types, feedback bucketing, command categorization, event construction, version/duration/count bucketing, and setup detection.
- Decision: Move telemetry event types, feedback event bucketing, command event construction, command/category sanitization, duration/count bucketing, and setup detection into `src/core/telemetryEvents.ts`, while re-exporting the existing public types and `buildFeedbackTelemetry` from `src/core/telemetry.ts`.
- Consequences: Sanitized command telemetry, feedback redaction, setup booleans, repeat-use buckets, default-off behavior, offline/no-network behavior, and public telemetry imports stay unchanged, while `src/core/telemetry.ts` drops from 482 lines to 294 lines.
- Verification: `npm run test -- tests/core/telemetryArchitecture.test.ts tests/core/telemetry.test.ts`.

## 2026-06-18: Filter default telemetry opt-in storage taint flows

- Status: accepted
- Context: Extracting telemetry config storage moved controlled queue/config writes into `src/core/telemetryConfig.ts`, causing review to classify the existing explicit `init team` telemetry opt-in prompt as a new `stdin` to `writeFile` / `rm` taint flow.
- Decision: Suppress review blocking for only the default telemetry opt-in storage path across `src/cli/commands/init.ts`, `src/core/telemetry.ts`, and `src/core/telemetryConfig.ts`, while preserving blocking behavior for custom taint sources/sinks and unrelated stdin-to-filesystem flows.
- Consequences: `projscan review` no longer blocks the telemetry helper extraction for a controlled config/queue write path, but still blocks unrelated stdin-to-filesystem flows and custom-taint overrides.
- Verification: `npm run test -- tests/core/reviewDataflow.test.ts tests/core/telemetryArchitecture.test.ts tests/core/telemetry.test.ts`.

## 2026-06-18: Extract telemetry config storage helpers

- Status: accepted
- Context: `src/core/telemetry.ts` was the top current hotspot and still owned config path resolution, config normalization, status shaping, queue IO, usage updates, and sender logic in one trust-sensitive module.
- Decision: Move telemetry config/status shaping, queue storage, usage updates, schema constants, endpoint/env constants, and collected/never-collected lists into `src/core/telemetryConfig.ts`, while keeping the public telemetry API re-exported from `src/core/telemetry.ts`.
- Consequences: Default-off behavior, offline and no-network guards, queue clearing, anonymous id handling, sanitized command/feedback event behavior, public constants, and `TelemetryStatus` imports stay unchanged, while `src/core/telemetry.ts` drops from 677 lines to 482 lines.
- Verification: `npm run test -- tests/core/reviewDataflow.test.ts tests/core/telemetryArchitecture.test.ts tests/core/telemetry.test.ts` plus `npm run typecheck`.

## 2026-06-17: Extract file inspection graph shaping

- Status: accepted
- Context: `src/core/fileInspector.ts` remained a production hotspot and still owned graph cache loading plus graph-backed import/export shaping after purpose, issue, access, export-type, and graph-metric helpers were isolated.
- Decision: Move inspection graph loading, graph cache save/load, graph import shaping, and graph export shaping into `src/core/fileInspectionGraph.ts`.
- Consequences: Graph-backed JavaScript/Python import/export output, cached graph reuse, hotspot analysis inputs, file-purpose inference, path-safety behavior, public `inspectFile` / `explainFile` exports, and removed regex extractor behavior stay unchanged, while `src/core/fileInspector.ts` drops from 150 lines / CC 13 to 131 lines / CC 10.
- Verification: `npm run test -- tests/core/fileInspector.test.ts -t "graph loading and import/export shaping"` plus the full file inspector test file.

## 2026-06-17: Extract code graph fan metrics

- Status: accepted
- Context: `src/core/codeGraph.ts` remained a high-complexity production hotspot and still owned per-function fan-in/fan-out metric calculation in addition to parsing, import resolution, index rebuilding, and incremental updates.
- Decision: Move per-function fan-in, fan-out, and qualified-name bare-name matching into `src/core/codeGraphFanMetrics.ts`.
- Consequences: Build and incremental graph updates still mutate `functions[*].fanIn` and `functions[*].fanOut` in place, self-call/self-recursion suppression, distinct internal callee counting, class-method bare-name matching, public `CodeGraph` / `GraphFile` exports, and query APIs stay unchanged, while `src/core/codeGraph.ts` drops from 477 lines / CC 62 to 397 lines / CC 39.
- Verification: `npm run test -- tests/core/codeGraph.fanIn.test.ts -t "fan metric computation"` plus the code graph fan-in, fan-out, incremental, and query behavior test files.

## 2026-06-17: Extract taint source and sink matching

- Status: accepted
- Context: `src/core/taint.ts` remained a high-complexity production hotspot and still owned source/sink hit selection plus default false-positive filters for child-process and database sink matching.
- Decision: Move taint source matching, sink matching, JavaScript child-process sink filtering, database sink filtering, and env passthrough filtering into `src/core/taintMatching.ts`.
- Consequences: Default and custom source/sink semantics, framework request-source delegation, same-function flows, BFS traversal, truncation reporting, child-process import checks, database helper/alias detection, public `computeTaint` output, and exported taint constants stay unchanged, while `src/core/taint.ts` drops from 560 lines / CC 77 to 393 lines / CC 38.
- Verification: `npm run test -- tests/core/taint.test.ts -t "source and sink matching"` plus the full taint behavior test file.

## 2026-06-17: Extract AST parser setup

- Status: accepted
- Context: `src/core/ast.ts` became the top production hotspot and still owned Babel parser imports, parser plugin selection, and parse-error shaping after traversal, module-signal, body-signal, function-naming, and function-collection helpers were isolated.
- Decision: Move parseability checks, Babel parser plugin selection, and parser error shaping into `src/core/astParser.ts`.
- Consequences: Parseable extension detection, parser options, parse-error reason truncation, import/export/call-site/function extraction, cyclomatic complexity, and public `parseSource` / `isParseable` exports stay unchanged, while `src/core/ast.ts` drops from 117 lines / CC 9 to 79 lines / CC 5.
- Verification: `npm run test -- tests/core/ast.functions.test.ts -t "Babel parser setup"` plus the AST behavior test files.

## 2026-06-17: Extract preflight local evidence collection

- Status: accepted
- Context: `src/core/preflight.ts` remained the top production hotspot and still owned session-memory, hotspot, and coordination evidence collection after changed-file and review evidence were isolated.
- Decision: Move safe session, hotspot, and coordination evidence collection into `src/core/preflightLocalEvidence.ts`.
- Consequences: Remembered-session ordering, hotspot fallback behavior, coordination availability filtering, preflight evidence, reason generation, and public preflight schema stay unchanged, while `src/core/preflight.ts` drops from 234 lines / CC 17 to 192 lines / CC 12.
- Verification: `npm run test -- tests/core/preflight.test.ts -t "local evidence collection"` plus the full preflight test file.

## 2026-06-17: Extract Python setuptools evidence

- Status: accepted
- Context: `src/core/languages/pythonManifests.ts` remained a Python-upgrade hotspot and still owned `setup.py` / `setup.cfg` reads and dependency parsing after lockfiles, root requirements, project evidence, roots, and pyproject parsing were isolated.
- Decision: Move setuptools manifest reading and dependency parsing into `src/core/languages/pythonSetuptools.ts`.
- Consequences: `setup.py` and `setup.cfg` dependency detection, source names, line numbers, scopes, Python project detection, upgrade-preview inputs, and public Python project types stay unchanged, while `src/core/languages/pythonManifests.ts` drops from 130 lines / CC 16 to 91 lines / CC 8.
- Verification: `npm run test -- tests/core/languages/pythonManifests.test.ts -t "setuptools manifest parsing"` plus the full Python manifest, upgrade-preview, and MCP Python upgrade fallback test files.

## 2026-06-17: Extract hotspot file assembly

- Status: accepted
- Context: `src/core/hotspotAnalyzer.ts` remained a production hotspot and still owned per-file hotspot assembly after scoring, line counting, memory tagging, candidate selection, issue linking, and git churn collection were isolated.
- Decision: Move per-file hotspot assembly, author summary shaping, date recency calculation, and numeric normalization into `src/core/hotspotBuilder.ts`.
- Consequences: Hotspot score inputs, reasons, author concentration fields, coverage, issue IDs, recency, public hotspot schema, and downstream report behavior stay unchanged, while `src/core/hotspotAnalyzer.ts` drops from 189 lines / CC 16 to 92 lines / CC 9.
- Verification: `npm run test -- tests/core/hotspotAnalyzer.test.ts -t "per-file hotspot assembly"` plus the full hotspot analyzer and issue-linking test files.

## 2026-06-17: Extract preflight changed-file evidence

- Status: accepted
- Context: `src/core/preflight.ts` still owned changed-file detection and unavailable-fallback shaping after review evidence was isolated.
- Decision: Move changed-file evidence collection into `src/core/preflightChangedFiles.ts`.
- Consequences: Before-edit changed-file skip behavior, git changed-file result shaping, error fallback reasons, downstream reason/evidence behavior, and public preflight schema stay unchanged, while `src/core/preflight.ts` drops from 273 lines / CC 21 to 234 lines / CC 17.
- Verification: `npm run test -- tests/core/preflight.test.ts -t "changed-file evidence collection"` plus the full preflight test file.

## 2026-06-17: Extract preflight review evidence

- Status: accepted
- Context: `src/core/preflight.ts` still owned review execution and review-result shaping after reason, evidence, required-check, action, contextual reason, and release-scale helpers were isolated.
- Decision: Move review evidence collection into `src/core/preflightReviewEvidence.ts`.
- Consequences: Before-edit review skip behavior, review unavailable reasons, taint/dataflow counts, release-scale behavior, preflight evidence, and public report schema stay unchanged, while `src/core/preflight.ts` drops from 309 lines / CC 29 to 273 lines / CC 21.
- Verification: `npm run test -- tests/core/preflight.test.ts -t "review evidence collection"` plus the full preflight test file.

## 2026-06-17: Extract review state resolution

- Status: accepted
- Context: `computeReview` still owned git repository readiness, base/head ref resolution, no-change detection, and unavailable-report shaping after review finding assembly was isolated.
- Decision: Move review state resolution and unavailable-report construction into `src/core/reviewState.ts`.
- Consequences: Non-git, unresolved-base, no-change, base-snapshot-failure, intent annotation, and review report behavior stay unchanged, while `src/core/review.ts` drops from 161 lines / CC 12 to 110 lines / CC 5.
- Verification: `npm run test -- tests/core/review.test.ts -t "review state resolution"` plus the full review test file.

## 2026-06-17: Extract MCP tool catalog

- Status: accepted
- Context: `src/mcp/tools.ts` is a bug-hunt hotspot watch item and mixed static MCP tool catalog data with registry lookup and definition shaping.
- Decision: Move the static MCP tool list into `src/mcp/toolCatalog.ts` and keep `src/mcp/tools.ts` focused on `getToolDefinitions`, `getToolHandler`, and type re-exports.
- Consequences: MCP tool order, names, handlers, deprecation descriptions, public exports, and server behavior stay unchanged, while `src/mcp/tools.ts` drops from 128 lines to 35 lines.
- Verification: `npm run test -- tests/mcp/server.test.ts -t "tool catalog"` plus the full MCP server test file.

## 2026-06-17: Extract start report assembly

- Status: accepted
- Context: `src/core/start.ts` is a current hotspot and still owned the final `StartReport` literal, including evidence shaping, optional handoff, and truncation flags.
- Decision: Move final start report assembly into `src/core/startReportBuilder.ts`.
- Consequences: `projscan start` report fields, summary text, evidence fields, optional handoff behavior, truncation behavior, and public schema stay unchanged, while `src/core/start.ts` drops from 103 lines / CC 7 to 83 lines / CC 3.
- Verification: `npm run test -- tests/core/start.test.ts -t "final report assembly"` plus the full start core test file.

## 2026-06-17: Extract review finding assembly

- Status: accepted
- Context: `computeReview` still owned package-scoped finding assembly, changed-file enrichment, cycle/risky/dependency/contract/dataflow evidence, graph evidence, and verdict summary after prior review helpers were isolated.
- Decision: Move derived review finding assembly into `src/core/reviewFindings.ts`.
- Consequences: Review output fields, package scoping, verdict inputs, intent annotation behavior, and public schema stay unchanged, while `src/core/review.ts` drops from 240 lines to 161 lines.
- Verification: `npm run test -- tests/core/review.test.ts -t "review finding assembly"` plus the full review test file.

## 2026-06-17: Extract preflight contextual reasons

- Status: accepted
- Context: `buildPreflightReasons` in `src/core/preflight.ts` still owned remembered-session hotspot, changed-file-scope health fallback, and coordination risk reason formatting after suggested actions were isolated.
- Decision: Move contextual preflight reason construction into `src/core/preflightContextReasons.ts`.
- Consequences: Session hotspot warnings, health fallback warnings, coordination advisory wording, reason order, verdict behavior, and report schema stay unchanged, while `src/core/preflight.ts` drops from 358 lines / CC 40 to 309 lines / CC 29.
- Verification: `npm run test -- tests/core/preflight.test.ts -t "contextual reason formatting"` plus the full preflight test file.

## 2026-06-17: Extract preflight suggested actions

- Status: accepted
- Context: `src/core/preflight.ts` still owned suggested next-action and tool-call shaping after reason, evidence, required-check, and release-scale extraction.
- Decision: Move suggested-action and tool-call projection into `src/core/preflightSuggestedActions.ts`.
- Consequences: Suggested action labels, commands, tools, deduping, tool-call projection, and preflight report schema stay unchanged, while `src/core/preflight.ts` drops from 423 lines / CC 56 to 358 lines / CC 40.
- Verification: `npm run test -- tests/core/preflight.test.ts -t "suggested action shaping"` plus the full preflight test file.

## 2026-06-17: Extract preflight evidence shaping

- Status: accepted
- Context: `src/core/preflight.ts` still owned health, changed-file, review, session, risk-source, hotspot, plugin, supply-chain, release-scale, and coordination evidence shaping after reason and required-check extraction.
- Decision: Move preflight evidence shaping into `src/core/preflightEvidence.ts` and export the shared evidence truncation limit.
- Consequences: Preflight evidence fields, remembered-session wording, truncation behavior, risk-source split, and report schema stay unchanged, while `src/core/preflight.ts` drops from 522 lines / CC 66 to 423 lines / CC 56.
- Verification: `npm run test -- tests/core/preflight.test.ts -t "evidence shaping isolated"` plus the full preflight test file.

## 2026-06-17: Extract preflight review reasons

- Status: accepted
- Context: `buildPreflightReasons` in `src/core/preflight.ts` still owned taint, review-verdict, release-scale review downgrade, and review-unavailable reason formatting.
- Decision: Move review-related preflight reason construction into `src/core/preflightReviewReasons.ts`.
- Consequences: Review, taint, and unavailable-review reason order, severity, messages, tools, and release-scale downgrade behavior stay unchanged, while `buildPreflightReasons` drops from CC 20 to CC 12 and `src/core/preflight.ts` drops to 522 lines / CC 66.
- Verification: `npm run test -- tests/core/preflight.test.ts -t "review reason formatting"` plus the full preflight test file.

## 2026-06-17: Extract preflight release-scale evidence

- Status: accepted
- Context: `src/core/preflight.ts` still owned release-scale detection, scale-only review interpretation, concrete blocker detection, and manual sign-off explanation text.
- Decision: Move release-scale evidence construction and blocker detection into `src/core/preflightReleaseScale.ts`.
- Consequences: Release-scale detection, explanation text, concrete blocker suppression, review required-check downgrade behavior, and report schema stay unchanged, while `src/core/preflight.ts` drops from 637 lines / CC 100 to 562 lines / CC 76.
- Verification: `npm run test -- tests/core/preflight.test.ts -t "release-scale evidence isolated"` plus the full preflight test file.

## 2026-06-17: Extract preflight required checks

- Status: accepted
- Context: `src/core/preflight.ts` still owned required-check status and reason formatting for health, supply-chain, changed files, and review after preflight reason formatting had been partly isolated.
- Decision: Move required-check assembly into `src/core/preflightRequiredChecks.ts`.
- Consequences: Preflight required-check names, statuses, reasons, release-scale downgrade behavior, and report schema stay unchanged, while `src/core/preflight.ts` drops from 703 lines / CC 124 to 637 lines / CC 100.
- Verification: `npm run test -- tests/core/preflight.test.ts -t "required check formatting"` plus the full preflight test file.

## 2026-06-17: Extract preflight changed-file reasons

- Status: accepted
- Context: `buildPreflightReasons` in `src/core/preflight.ts` still owned changed-file health, availability, and threshold reason formatting after policy issue reasons were isolated.
- Decision: Move changed-file reason construction into `src/core/preflightChangedFileReasons.ts`.
- Consequences: Preflight reason order, message text, tools, verdict behavior, required checks, and release-scale behavior stay unchanged, while `buildPreflightReasons` drops from CC 29 to CC 20 and changed-file wording is isolated for review.
- Verification: `npm run test -- tests/core/preflight.test.ts -t "changed-file reason formatting"` plus the full preflight test file.

## 2026-06-17: Extract preflight policy issue reasons

- Status: accepted
- Context: `buildPreflightReasons` in `src/core/preflight.ts` owned supply-chain and plugin policy issue reason formatting alongside changed-file, review, release-scale, session, health, and coordination reason assembly.
- Decision: Move supply-chain and plugin policy reason formatting into `src/core/preflightIssueReasons.ts`.
- Consequences: Preflight reason order, messages, tools, and verdict behavior stay unchanged, while `buildPreflightReasons` drops from CC 35 to CC 29 and policy issue wording is isolated for review.
- Verification: `npm run test -- tests/core/preflight.test.ts -t "policy issue reason"` plus the full preflight test file.

## 2026-06-17: Add Express originalUrl dataflow source

- Status: accepted
- Context: framework dataflow already covered narrow Express body/query/params/header/cookie/IP and accessor patterns, but Express route URL evidence via `req.originalUrl` was not surfaced as a request source.
- Decision: Add `express.req.originalUrl` through request-parameter member-reference matching in `src/core/frameworkExpressSources.ts`.
- Consequences: `projscan dataflow` can report Express original URL values flowing into sinks, while route-local variables named `originalUrl` and non-route helper lookalikes stay quiet.
- Verification: `npm run test -- tests/core/dataflow.test.ts -t "Express originalUrl"` plus focused framework/dataflow tests.

## 2026-06-17: Extract hotspot candidate selection

- Status: accepted
- Context: `src/core/hotspotAnalyzer.ts` still owned code-extension filtering, large-file guardrails, churn/size ordering, and line-count read target selection after scoring, line helpers, issue indexing, git churn, and memory tagging had been isolated.
- Decision: Move hotspot candidate selection and measured line-count collection into `src/core/hotspotCandidates.ts`.
- Consequences: Hotspot ranking, limits, max-read safeguards, line estimates, issue joins, and memory tagging stay unchanged, while the analyzer drops to 189 lines and CC 16.
- Verification: `npm run test -- tests/core/hotspotAnalyzer.test.ts -t "candidate selection"` plus the full hotspot analyzer test file.

## 2026-06-17: Extract MCP request handler construction

- Status: accepted
- Context: `src/mcp/server.ts` still owned initialize, tools/call, prompts/get, and resources/read request handlers after parser, dispatch, context, session, and lifecycle extraction.
- Decision: Move MCP request handler construction into `src/mcp/serverHandlers.ts`; keep `src/mcp/server.ts` focused on version lookup, lifecycle setup, JSON-RPC parsing/dispatch, and stdio transport.
- Consequences: MCP method names, response shapes, progress emission, tool session recording, prompt/resource behavior, and watcher startup behavior stay unchanged, while `src/mcp/server.ts` drops to 131 lines and CC 10.
- Verification: `npm run test -- tests/mcp/server.test.ts -t "MCP request handlers"` plus the full MCP server test file.

## 2026-06-17: Extract review git/ref state checks

- Status: accepted
- Context: `src/core/review.ts` still owned git repository detection, worktree clean checks, SHA resolution, and default-base selection even after base snapshot and package-scope extraction.
- Decision: Move review git/ref state checks into `src/core/reviewRefs.ts`.
- Consequences: Review behavior and git timeout behavior stay unchanged, while `src/core/review.ts` drops to 240 lines and git/ref state logic is easier to audit independently.
- Verification: `npm run test -- tests/core/review.test.ts -t "git ref and worktree state"` plus focused review tests.

## 2026-06-17: Extract release-train fallback catalog

- Status: accepted
- Context: `src/core/releaseTrain.ts` still owned legacy/default product-line fallback tracks and tasks, making the current release-train planner hard to scan.
- Decision: Move fallback tracks and fallback tasks into `src/core/releaseTrainFallbacks.ts`; keep the planner focused on current package version, roadmap catalog lookup, preflight readiness, ranking, and suggested actions.
- Consequences: Release-train output stays unchanged, while `src/core/releaseTrain.ts` drops from 496 to 166 lines and the branch-heavy fallback catalog is isolated.
- Verification: `npm run test -- tests/core/releaseTrain.test.ts -t "fallback tracks and tasks"` plus focused release-train tests.

## 2026-06-17: Extract review package scoping

- Status: accepted
- Context: `src/core/review.ts` still owned package-scoped changed-file filtering and package graph-scope selection after several review hotspot extractions.
- Decision: Move package-scope filtering into `src/core/reviewPackageScope.ts`.
- Consequences: Review package behavior and schema stay unchanged, while `src/core/review.ts` drops to 302 lines and package filtering can be tested and audited independently.
- Verification: `npm run test -- tests/core/review.test.ts -t "package scope filtering"` plus focused review tests.

## 2026-06-17: Extract review base snapshot assembly

- Status: accepted
- Context: `computeReview` still owned base-side detached worktree checkout, base repository scan, base graph build, base manifest reading, worktree cleanup, and git failure summarization.
- Decision: Move base snapshot assembly into `src/core/reviewBaseSnapshot.ts` and move the review-local git runner into `src/core/reviewGit.ts`.
- Consequences: Review output and git timeout behavior stay unchanged, while `src/core/review.ts` drops from 427 to 334 lines and base checkout cleanup is easier to audit independently.
- Verification: `npm run test -- tests/core/review.test.ts -t "base worktree snapshot"` plus focused review tests.

## 2026-06-17: Surface coordination validation workflow in hints

- Status: accepted
- Context: `projscan coordinate` already exposed detailed local-only evidence, but compact coordination hints only told agents to rerun `projscan coordinate`.
- Decision: Build compact coordination hints from the existing validation workflow and include `coordinate`, `coordinate --watch`, and `agent-brief` proof commands.
- Consequences: Agent-facing handoffs carry the same local validation workflow as the detailed evidence object without adding schema fields, daemon requirements, network calls, or release behavior.
- Verification: `npm run test -- tests/core/coordination.test.ts`.

## 2026-06-16: Extract MCP server lifecycle

- Status: accepted
- Context: `src/mcp/server.ts` still owned file-watcher startup, file-change notification emission, tool-watch cancellation, watcher close waiting, and session flush inside the server orchestration closure.
- Decision: Move watcher lifecycle and close handling into `src/mcp/serverLifecycle.ts`.
- Consequences: JSON-RPC dispatch and tool handling stay unchanged, while lifecycle shutdown, watcher notification, and session-flush behavior are easier to audit in isolation.
- Verification: `npm run test -- tests/mcp/server.test.ts -t "watcher lifecycle"` plus focused MCP watcher/session tests.

## 2026-06-16: Extract hotspot memory tagging

- Status: accepted
- Context: `src/core/hotspotAnalyzer.ts` still owned best-effort Project Memory hotspot observation and accepted-hotspot tagging inline.
- Decision: Move memory observation and accepted-hotspot tagging into `src/core/hotspotMemory.ts`.
- Consequences: Hotspot ranking and report shape stay unchanged, while memory side effects are isolated from the analyzer's scoring/orchestration path.
- Verification: `npm run test -- tests/core/hotspotAnalyzer.test.ts -t "memory tagging"` plus focused hotspot and memory tests.

## 2026-06-16: Extract hotspot line counting helpers

- Status: accepted
- Context: `src/core/hotspotAnalyzer.ts` still owned file line counting and size-to-line fallback helpers inline, even though scoring, git churn, and issue matching were already isolated.
- Decision: Move line counting and LOC fallback helpers into `src/core/hotspotLines.ts`.
- Consequences: Hotspot analysis behavior remains unchanged, while the analyzer orchestration focuses on candidate selection, churn/issue joins, and hotspot assembly.
- Verification: `npm run test -- tests/core/hotspotAnalyzer.test.ts -t "line counting"` plus focused hotspot tests.

## 2026-06-16: Extract review head snapshot assembly

- Status: accepted
- Context: `computeReview` still assembled head-side scan, graph, issue, and hotspot data inline before comparing against the base worktree.
- Decision: Move head-side graph and hotspot enrichment into `src/core/reviewHeadSnapshot.ts`, leaving base worktree checkout and comparison orchestration in `review.ts`.
- Consequences: Review behavior and verdict inputs stay unchanged, while `computeReview` has a smaller boundary between current-worktree enrichment and base-worktree comparison.
- Verification: `npm run test -- tests/core/review.test.ts -t "head-side scan"` plus focused review tests.

## 2026-06-16: Extract review no-change report assembly

- Status: accepted
- Context: `computeReview` still constructed the identical-ref clean-worktree response inline, mixing fast-path report shape with review orchestration.
- Decision: Move the no-change report shape into `src/core/reviewNoChanges.ts` and keep intent annotation in `review.ts`.
- Consequences: The clean identical-ref review response remains unchanged, while `computeReview` focuses on repo checks, graph/diff orchestration, and intent application.
- Verification: `npm run test -- tests/core/review.test.ts -t "no-change report assembly|no changes between identical refs|dirty worktree"` plus focused review tests.

## 2026-06-16: Extract MCP JSON-RPC message parsing

- Status: accepted
- Context: `src/mcp/server.ts` still parsed and validated raw JSON-RPC lines inline, keeping protocol syntax checks inside the server orchestration and dispatch flow.
- Decision: Move raw line trimming, JSON parse errors, request validation, and invalid-request id preservation into `src/mcp/serverMessage.ts`.
- Consequences: MCP parse-error and invalid-request responses stay unchanged, while `server.ts` focuses on handler wiring, dispatch, watcher lifecycle, and transport close behavior.
- Verification: `npm run test -- tests/mcp/server.test.ts -t "message parsing"` and focused MCP server/payload/notification verification.

## 2026-06-16: Extract start adoption-gap shaping

- Status: accepted
- Context: `computeStartReport` still shaped first-run diagnostics into adoption gaps inline, mixing setup evidence projection with start report orchestration.
- Decision: Move adoption-gap projection into `src/core/startAdoptionGaps.ts` and call `buildStartAdoptionGaps` from the start orchestrator.
- Consequences: Start report JSON, CLI rendering, setup diagnostics, and adoption gap command preservation stay unchanged, while future adoption evidence changes can be reviewed separately from report assembly.
- Verification: `npm run test -- tests/core/start.test.ts -t "adoption gap shaping"` and focused start core/CLI verification.

## 2026-06-16: Extract basic config normalization

- Status: accepted
- Context: `src/utils/config.ts` still owned basic scalar/list config normalization for `minScore`, `baseRef`, `ignore`, and `disableRules`, keeping low-level field parsing in the main loader.
- Decision: Move those basic field normalizers into `src/utils/configBasics.ts` and import them from the main config normalizer.
- Consequences: `minScore` clamping, `baseRef` trimming, and string-list filtering for `ignore` and `disableRules` stay unchanged, while the main loader focuses on discovery and composition.
- Verification: `npm run test -- tests/utils/config.test.ts -t "basic scalar and list normalization"` and focused config/issue-trust verification.

## 2026-06-16: Extract config issue-rule application

- Status: accepted
- Context: `src/utils/config.ts` still owned `applyConfigToIssues` and disable-rule matching, mixing issue filtering/remapping policy with config file loading and normalization.
- Decision: Move issue-rule application into `src/utils/configIssueRules.ts` and re-export `applyConfigToIssues` from `src/utils/config.ts` for compatibility.
- Consequences: Existing imports from `config.ts` stay valid, exact and wildcard disable-rule behavior stays unchanged, and issue severity remapping remains exact-id based.
- Verification: `npm run test -- tests/utils/config.test.ts -t "issue rule application"` and focused config/issue-trust verification.

## 2026-06-16: Extract severity override config normalization

- Status: accepted
- Context: `src/utils/config.ts` still owned severity override parsing and the valid-severity allow-list, keeping issue remapping policy mixed with unrelated config branches.
- Decision: Move severity override normalization into `src/utils/configSeverity.ts` and import `applySeverityOverrides` from the main config normalizer.
- Consequences: Invalid severity overrides continue to be dropped, while severity remapping config review can focus on one helper module.
- Verification: `npm run test -- tests/utils/config.test.ts -t "severity override normalization"` and focused config/issue-mapping verification.

## 2026-06-16: Extract hotspot config normalization

- Status: accepted
- Context: `src/utils/config.ts` still owned hotspot `limit` and `since` config parsing, keeping risk-ranking options mixed with unrelated config branches.
- Decision: Move hotspot option normalization into `src/utils/configHotspots.ts` and import `applyHotspots` from the main config normalizer.
- Consequences: `hotspots.limit` clamping and `hotspots.since` trimming stay unchanged, while hotspot tuning review can focus on one helper module.
- Verification: `npm run test -- tests/utils/config.test.ts -t "hotspot option normalization"` and focused config/hotspot verification.

## 2026-06-16: Extract taint config normalization

- Status: accepted
- Context: `src/utils/config.ts` still owned taint source/sink config parsing, keeping security-sensitive analyzer tuning mixed with unrelated config branches.
- Decision: Move taint option normalization into `src/utils/configTaint.ts` and import `applyTaint` from the main config normalizer.
- Consequences: `taint.sources` and `taint.sinks` filtering behavior stays unchanged, while source/sink tuning review can focus on one helper module.
- Verification: `npm run test -- tests/utils/config.test.ts -t "taint option normalization"` and focused config/taint verification.

## 2026-06-16: Extract scan privacy config normalization

- Status: accepted
- Context: `src/utils/config.ts` still owned scan privacy option parsing for `includeIgnored`, `scanEnvValues`, and `offline`, keeping secret-adjacent config behavior inside the main loader.
- Decision: Move scan option normalization into `src/utils/configScan.ts` and import `applyScan` from the main config normalizer.
- Consequences: Scan config behavior stays unchanged, including the explicit `scan.scanEnvValues` opt-in required before reading tracked `.env` values.
- Verification: `npm run test -- tests/utils/config.test.ts -t "scan privacy option normalization"` and focused config/trust verification.

## 2026-06-16: Extract monorepo import-policy config normalization

- Status: accepted
- Context: `src/utils/config.ts` still owned monorepo import-policy rule parsing, keeping cross-package allow/deny normalization mixed with unrelated config branches.
- Decision: Move monorepo import-policy normalization into `src/utils/configMonorepo.ts` and import `applyMonorepo` from the main config normalizer.
- Consequences: `monorepo.importPolicy` schema and allow/deny behavior stay unchanged, while cross-package boundary config review can focus on one helper module.
- Verification: `npm run test -- tests/utils/config.test.ts -t "monorepo import policy normalization"` and focused config/cross-package verification.

## 2026-06-16: Extract report policy config normalization

- Status: accepted
- Context: `src/utils/config.ts` still owned report-policy preset parsing for scoped/redacted evidence, adding branches to the main config loader alongside unrelated scan, hotspot, monorepo, taint, and severity normalization.
- Decision: Move report-policy preset normalization into `src/utils/configReportPolicies.ts` and import `applyReportPolicies` from the main config normalizer.
- Consequences: `reportScope` and `redactPaths` config behavior stays unchanged, while scoped/redacted evidence config review can focus on one helper module.
- Verification: `npm run test -- tests/utils/config.test.ts -t "report policy preset normalization"` and focused config/report-scope verification.

## 2026-06-16: Extract file access path safety

- Status: accepted
- Context: `inspectFile` still owned relative-path validation, root canonicalization, symlink escape checks, stat checks, and file reads, making the inspector responsible for security-sensitive access policy plus payload assembly.
- Decision: Move safe project-file reading into `src/core/fileAccess.ts` with `readProjectFile`; keep `inspectFile` responsible for mapping failures into its existing `FileInspection` shape.
- Consequences: Absolute-path refusal, traversal rejection, symlink escape blocking, in-root symlink support, missing-file reasons, and relative-path reporting stay unchanged, while path-safety review can focus on one module.
- Verification: `npm run test -- tests/core/fileInspector.test.ts -t "file access path safety"` and focused file-inspector security verification.

## 2026-06-16: Extract file graph metric shaping

- Status: accepted
- Context: `inspectFile` still owned graph-derived complexity, fan-in, fan-out, and function-summary shaping, keeping metric-specific loops inside the path-safety and payload orchestration flow.
- Decision: Move graph metric shaping into `src/core/fileGraphMetrics.ts` and have `inspectFile` call `deriveFileGraphMetrics`.
- Consequences: File-inspection metric fields, function sorting, and missing/parse-failed graph behavior stay unchanged, while future graph metric adjustments can be reviewed separately from file access, issue collection, and import/export mapping.
- Verification: `npm run test -- tests/core/fileInspector.test.ts -t "graph metric shaping"` and focused file-inspector verification.

## 2026-06-16: Extract file issue detection

- Status: accepted
- Context: `fileInspector.ts` still owned file-level issue detection rules after prior purpose and export-type extractions, keeping linter-style checks inside the path-safety and graph-loading orchestrator.
- Decision: Move `detectFileIssues` into `src/core/fileIssues.ts`, import it from `fileInspector.ts`, and re-export it from `fileInspector.ts` for compatibility.
- Consequences: Existing file-inspection issue labels remain unchanged, while future issue-detection rules can be reviewed separately from path resolution, graph loading, hotspot lookup, and import/export shaping.
- Verification: `npm run test -- tests/core/fileInspector.test.ts -t "file issue detection"` and focused file-inspector verification.

## 2026-06-16: Extract file export type mapping

- Status: accepted
- Context: After purpose inference extraction, `fileInspector.ts` still owned graph export-kind to file-inspection export-type mapping, keeping a branch table inside the file inspection orchestrator.
- Decision: Move export-type mapping into `src/core/fileExportTypes.ts` and import `mapExportType` from `fileInspector.ts`.
- Consequences: Graph-backed export output stays unchanged, while future graph export-kind changes can be reviewed separately from path safety, graph loading, purpose inference, and issue detection.
- Verification: `npm run test -- tests/core/fileInspector.test.ts -t "export type mapping"` and focused file-inspector verification.

## 2026-06-16: Extract file purpose inference

- Status: accepted
- Context: `fileInspector.ts` remained a high-complexity hotspot and still mixed file inspection orchestration with filename/directory purpose rules and export-shape fallback inference.
- Decision: Move purpose inference rules into `src/core/filePurpose.ts` and re-export `inferPurpose` from `fileInspector.ts` for compatibility.
- Consequences: `projscan file` purpose labels and public imports stay unchanged, while purpose-rule changes can be reviewed separately from path safety, graph loading, hotspot lookup, and issue detection.
- Verification: `npm run test -- tests/core/fileInspector.test.ts -t "purpose inference rules|inferPurpose"` and focused file-inspector verification.

## 2026-06-16: Extract Python pyproject dependency parser

- Status: accepted
- Context: `pythonManifests.ts` remained a high-complexity hotspot after project-evidence, requirements, and root inference extraction because it still owned PEP 621, Poetry, dependency-groups, and pyproject list parsing.
- Decision: Move pyproject dependency parsing into `src/core/languages/pythonPyproject.ts`, move shared line/list text helpers into `src/core/languages/pythonManifestText.ts`, and keep `parsePyproject` re-exported from `pythonManifests.ts`.
- Consequences: Python manifest detection, pyproject dependency output, line numbers, and public imports stay unchanged, while future pyproject parser fixes can be reviewed separately from project detection and setup parsing.
- Verification: `npm run test -- tests/core/languages/pythonManifests.test.ts -t "pyproject dependency parsing|parsePyproject"` and focused Python manifest/upgrade verification.

## 2026-06-16: Extract review cycle classification

- Status: accepted
- Context: `src/core/review.ts` still owned cycle scoping, new/expanded cycle classification, overlap counting, and added-file sort priority after review tier extraction.
- Decision: Move review cycle classification into `src/core/reviewCycles.ts` and import `classifyNewCycles` plus `scopeCyclesToFiles` from the review orchestrator.
- Consequences: Review cycle output, package scoping, and added-file priority stay unchanged, while cycle-specific logic can be reviewed independently from git worktree orchestration and verdict assembly.
- Verification: `npm run test -- tests/core/review.test.ts -t "cycle classification isolated"` and focused review verification.

## 2026-06-16: Extract review tier shaping

- Status: accepted
- Context: `src/core/review.ts` remained a high-churn hotspot and still owned token-budget tier selection plus summary/verdict-only response shaping after the review graph, flow, contract, manifest, verdict, and changed-file extraction work.
- Decision: Move review tier selection and report shaping into `src/core/reviewTier.ts`, while re-exporting `selectReviewTier` and `shapeReviewForTier` from `review.ts` for compatibility with existing callers.
- Consequences: Review response tiers, totals, truncation behavior, and MCP cost-sidecar behavior stay unchanged, while budget shaping can be reviewed independently from PR diff orchestration.
- Verification: `npm run test -- tests/core/review.test.ts -t "tier shaping isolated"` and focused review-tier verification.

## 2026-06-16: Extract Hono framework request source matcher

- Status: accepted
- Context: After Koa, Express, and Fastify extraction, `frameworkSources.ts` still owned Hono request-source maps, import gating, handler-call gating, context parameter selection, and member-call matching.
- Decision: Move Hono request-source matching into `src/core/frameworkHonoSources.ts` and have the shared orchestrator import `HONO_REQUEST_SOURCES` plus `honoRequestSource`.
- Consequences: Hono dataflow source names, handler gating, and false-positive behavior stay unchanged, while future Hono source changes can be reviewed separately from Next, Express, Fastify, and Koa.
- Verification: `npm run test -- tests/core/frameworkSources.test.ts -t "Hono source matching"` and focused framework/dataflow verification.

## 2026-06-16: Extract Fastify framework request source matcher

- Status: accepted
- Context: After Koa and Express extraction, `frameworkSources.ts` still owned Fastify request-source maps, handler gating, request parameter selection, bare reference matching, and member-reference matching.
- Decision: Move Fastify request-source matching into `src/core/frameworkFastifySources.ts` and have the shared orchestrator import `FASTIFY_REQUEST_SOURCES` plus `fastifyRequestSource`.
- Consequences: Fastify dataflow source names, handler gating, and false-positive behavior stay unchanged, while future Fastify source changes can be reviewed separately from Hono, Express, Koa, and Next.
- Verification: `npm run test -- tests/core/frameworkSources.test.ts -t "Fastify source matching"` and focused framework/dataflow verification.

## 2026-06-16: Extract Express framework request source matcher

- Status: accepted
- Context: After Koa extraction, `frameworkSources.ts` still owned Express request-source maps, handler gating, request parameter selection, reference matching, and member-call matching.
- Decision: Move Express request-source matching into `src/core/frameworkExpressSources.ts` and have the shared orchestrator import `EXPRESS_REQUEST_SOURCES` plus `expressRequestSource`.
- Consequences: Express dataflow source names, handler gating, and false-positive behavior stay unchanged, while future Express source changes can be reviewed separately from Hono, Fastify, Koa, and Next.
- Verification: `npm run test -- tests/core/frameworkSources.test.ts -t "Express source matching"` and focused framework/dataflow verification.

## 2026-06-16: Extract Koa framework request source matcher

- Status: accepted
- Context: `frameworkSources.ts` still owned all Koa request-source maps, handler gating, member-reference matching, and member-call matching after the Next route extraction, keeping the shared framework source orchestrator broad.
- Decision: Move Koa request-source matching into `src/core/frameworkKoaSources.ts` and have the shared orchestrator import `KOA_REQUEST_SOURCES` plus `koaRequestSource`.
- Consequences: Koa dataflow source names, handler gating, and false-positive behavior stay unchanged, while future Koa source changes can be reviewed separately from Express, Fastify, Hono, and Next.
- Verification: `npm run test -- tests/core/frameworkSources.test.ts -t "Koa source matching"` and focused framework/dataflow verification.

## 2026-06-16: Extract Python package root inference

- Status: accepted
- Context: `pythonManifests.ts` still mixed Python package-root inference from `pyproject.toml` and `__init__.py` placement into the dependency manifest parser, keeping the hotspot larger than necessary after requirements extraction.
- Decision: Move `pyproject.toml` root extraction and `__init__.py` root inference into `src/core/languages/pythonRoots.ts`, while keeping `detectPythonProject` responsible for orchestration and final package-root fallback.
- Consequences: Package-root behavior and Python upgrade output remain unchanged, while future root-inference fixes can be reviewed in a focused module.
- Verification: `npm run test -- tests/core/languages/pythonManifests.test.ts -t "package root inference"` and the focused Python manifest/upgrade verification matrix.

## 2026-06-16: Extract Python requirements evidence reader

- Status: accepted
- Context: `detectPythonProject` still mixed root `requirements*.txt` and `constraints*.txt` filtering, file reads, dependency parsing, and pinned-version lock evidence into the main manifest detector.
- Decision: Move root requirements/constraints evidence reading into `src/core/languages/pythonRequirements.ts`, move the shared PEP 508 splitter into `pythonPep508.ts`, and keep compatibility re-exports from `pythonManifests.ts`.
- Consequences: Python dependency parsing behavior, public imports, and upgrade output stay unchanged, while `detectPythonProject` becomes a smaller orchestration function.
- Verification: `npm run test -- tests/core/languages/pythonManifests.test.ts -t "root requirements evidence"` and the focused Python manifest/upgrade verification matrix.

## 2026-06-16: Extract Python project evidence gate

- Status: accepted
- Context: Manifest-only Python upgrade preview added a root project-evidence gate to `pythonManifests.ts`, but the manifest parser is already a roadmap hotspot and should stay focused on parsing manifests and lockfile evidence.
- Decision: Move Python project evidence detection into `src/core/languages/pythonProjectEvidence.ts` and import the single `hasPythonProjectEvidence` gate from the manifest detector.
- Consequences: Python project detection behavior and output schemas remain unchanged, while review of root manifest/project evidence rules is isolated from Python dependency parsing.
- Verification: `npm run test -- tests/core/languages/pythonManifests.test.ts -t "project evidence gating"` and the focused Python manifest/upgrade verification matrix.

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

## 2026-06-16: Parse legacy Poetry dev dependencies

- Status: accepted
- Context: Python upgrade previews already use local `pyproject.toml` evidence and modern Poetry dependency groups, but older Poetry projects still commonly declare dev dependencies in `[tool.poetry.dev-dependencies]`.
- Decision: Parse legacy Poetry dev-dependency tables into `declared` Python dependency evidence with `scope: "dev"`, without changing lockfile/current-version semantics or adding any PyPI/network lookup.
- Consequences: `projscan upgrade` can now show declared dev-scope evidence for legacy Poetry projects. Public output shape stays unchanged; only additional local manifest evidence appears when the legacy table exists.
- Verification: `npm run test -- tests/core/languages/pythonManifests.test.ts -t "legacy poetry dev-dependencies"` failed before parsing the legacy table, then passed. `npm run test -- tests/core/languages/pythonManifests.test.ts tests/core/upgradePreview.test.ts tests/mcp/pythonUpgradeFallback.test.ts tests/reporters/markdownUpgradeReporter.test.ts tests/reporters/consoleUpgradeReporter.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed; only the expected manual release sign-off gate remained.

## 2026-06-16: Print coordinate session-boundary evidence

- Status: accepted
- Context: The coordination JSON evidence already separated live Git/worktree proof from remembered session context, but the default console evidence view only printed local-only signals and validation commands.
- Decision: Add the session-separation lines to the `projscan coordinate` console `Evidence` section without changing the JSON report shape.
- Consequences: Human reviewers and terminal-first agents see that current worktree evidence comes from live local git/worktree state, while remembered session context must be checked through session or agent-brief follow-ups.
- Verification: `npm run test -- tests/cli/coordinate.test.ts -t "coordinate console surfaces local evidence"` failed before the console renderer printed the session-boundary lines, then passed after `npm run build`. `npm run test -- tests/cli/coordinate.test.ts tests/core/coordination.test.ts tests/core/collisionDetector.test.ts tests/core/claims.test.ts tests/core/mergeRisk.test.ts tests/mcp/coordinateWatch.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- coordinate --quiet`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed; only the expected manual release sign-off gate remained.

## 2026-06-16: Add Fastify host dataflow sources

- Status: accepted
- Context: Fastify exposes request `host` and `hostname` fields derived from incoming request host data, but framework dataflow only covered Fastify body/query/params/headers/cookies/IP/raw URL/raw headers.
- Decision: Add qualified `request.host` and `request.hostname` detection as gated Fastify request sources inside Fastify handler context.
- Consequences: `projscan_dataflow` and review dataflow can flag Fastify host-derived values reaching default database sinks while ordinary helper objects with `host` or `hostname` fields stay quiet. Public output shape stays unchanged; only additional local source names appear when the pattern is present.
- Verification: `npm run test -- tests/core/dataflow.test.ts -t "Fastify request host fields"` failed before the sources were added, then passed. `npm run test -- tests/core/dataflow.test.ts tests/core/taint.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- dataflow --format json`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed; only the expected manual release sign-off gate remained.

## 2026-06-16: Extract MCP server session recorder

- Status: accepted
- Context: Hotspot evidence still flagged `src/mcp/server.ts` as a high-complexity changed file after dispatch and tool-context extraction. Session loading, touch recording, cost events, fs-watch session events, and dirty flushing were a cohesive state machine inside `createMcpServer`.
- Decision: Move MCP session recording into `src/mcp/serverSession.ts` behind `createServerSessionRecorder(rootPath)`, leaving `server.ts` to call `recordToolCall`, `recordFileWatch`, and `flush`.
- Consequences: `src/mcp/server.ts` drops from CC 59 to CC 45 and from 391 to 311 lines. Tool-call session touches, cost-summary events, fs-watch touches, and close-time persistence remain best-effort and behavior-compatible.
- Verification: `npm run test -- tests/mcp/server.test.ts -t "session recording out of server orchestration"` failed before the extraction, then passed. `npm run test -- tests/mcp/server.test.ts tests/mcp/sessionIntegration.test.ts tests/mcp/memoryIntegration.test.ts tests/mcp/costSidecarIntegration.test.ts tests/mcp/fileChangedNotifications.test.ts tests/mcp/progress.test.ts tests/mcp/crossCutting.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- file src/mcp/server.ts --format json`, `npm exec projscan -- file src/mcp/serverSession.ts --format json`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed after the extraction; only the expected manual release sign-off gate remained.

## 2026-06-16: Preserve HTTP URLs during path redaction

- Status: accepted
- Context: Scoped/redacted report exports redact file-like path tokens in issue text, but the unmapped-token matcher could consume part of an HTTP(S) documentation URL and replace it with a path label.
- Decision: Detect path-like matches that are part of an HTTP(S) URL token and leave those links intact, while continuing to redact standalone local/repo path tokens.
- Consequences: Reviewer-facing issue text keeps useful external documentation links such as `https://example.com/docs/src/private/secret.ts`, but standalone `src/private/secret.ts` text still becomes a stable `redacted-path-N` label.
- Verification: `npm run test -- tests/core/reportScope.test.ts -t "preserves http urls"` failed before the URL token guard, then passed. `npm run test -- tests/core/reportScope.test.ts tests/reporters/jsonReporter.test.ts tests/reporters/sarifReporter.test.ts tests/reporters/markdownAnalysisReporter.test.ts tests/reporters/markdownHealthReporter.test.ts tests/reporters/htmlReporter.test.ts tests/cli/formatHandling.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed; only the expected manual release sign-off gate remained.

## 2026-06-16: Parse Python dependency groups

- Status: accepted
- Context: Python upgrade previews already use local `pyproject.toml` evidence for PEP 621, Poetry, and legacy Poetry dev dependencies, but PEP 735 adds top-level `[dependency-groups]` for internal development requirements.
- Decision: Parse `[dependency-groups]` arrays from `pyproject.toml` as dev-scope declared dependency evidence and ignore `{ include-group = "..." }` references as group composition, not package requirements.
- Consequences: `projscan upgrade` can preview Python packages declared in dependency groups and report `declaredScope: "dev"` without adding PyPI/network lookup or changing output shape.
- Verification: `npm run test -- tests/core/languages/pythonManifests.test.ts -t "PEP 735 dependency groups"` failed before the parser change, then passed. `npm run test -- tests/core/languages/pythonManifests.test.ts tests/core/upgradePreview.test.ts tests/mcp/pythonUpgradeFallback.test.ts tests/reporters/markdownUpgradeReporter.test.ts tests/reporters/consoleUpgradeReporter.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm exec projscan -- file src/core/languages/pythonManifests.ts --format json`, `npm exec projscan -- release-train --format json`, `npm exec projscan -- review --format json`, `npm exec projscan -- bug-hunt --format json`, and `git diff --check` passed; only the expected manual release sign-off gate remained.

## 2026-06-16: Add Next route URL dataflow source

- Status: accepted
- Context: Next route handlers use the Web `Request`/`NextRequest` request object, whose URL can carry user-controlled query/path input, but framework dataflow only recognized route body-reader calls.
- Decision: Add `request.url` as a qualified Next route request source only for exported HTTP method handlers in `app/**/route.*` files.
- Consequences: `projscan_dataflow` and review dataflow can flag Next route URL strings reaching default database sinks while helper functions in the same route file that read a shaped `{ url }` object stay quiet. Public output shape stays unchanged; this only adds a source string when the narrow pattern exists.
- Verification: `npm run test -- tests/core/dataflow.test.ts -t "Next route request.url"` failed before the source was added, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-16: Extract Next route framework source matcher

- Status: accepted
- Context: Hotspot evidence ranked `src/core/frameworkSources.ts` as a high-complexity changed file after adding the Next route URL source. The Next route matcher is cohesive and does not share framework import or handler-call logic with Hono, Express, Fastify, or Koa.
- Decision: Move Next route source maps, route-file gating, HTTP method checks, and member-call/reference matching into `src/core/frameworkNextRouteSources.ts`, while keeping `frameworkSources.ts` as the shared public entry point.
- Consequences: `src/core/frameworkSources.ts` drops from CC 69 to CC 55 and from 428 to 369 lines. The extracted module is 74 lines with max function CC 6. Dataflow source names and public schemas stay unchanged.
- Verification: `npm run test -- tests/core/frameworkSources.test.ts -t "Next route source matching"` failed before the extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-16: Allow manifest-only Python upgrade previews

- Status: accepted
- Context: Python upgrade previews use local manifest and lockfile evidence, but the project detector returned `null` unless at least one `.py`/`.pyw` file was in the scanned file list. Early package-review repos can have a valid root `pyproject.toml` before Python source files are present.
- Decision: Treat root Python manifests, root requirements/constraints, and known root Python lockfiles as project evidence alongside `.py` files.
- Consequences: `projscan upgrade` can preview a package declared in `pyproject.toml` before any Python source exists, returning Python ecosystem metadata and no importers. The path remains offline and local-only; unsupported/nested manifests are still deferred.
- Verification: `npm run test -- tests/core/upgradePreview.test.ts -t "pyproject even before Python files"` failed before manifest evidence was accepted, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-16: Carry clear swarm hints into agent briefs

- Status: accepted
- Context: `projscan coordinate` already exposes local-only validation workflow evidence, but `coordinationHints` returned no hint when multiple worktrees were clear. That meant `agent-brief` omitted the coordination follow-up exactly when the next agent should preserve the clear state before continuing parallel work.
- Decision: Return one advisory `coordinationHints` message for clear multi-worktree coordination, telling agents to rerun `projscan coordinate` before parallel edits continue. Single-worktree and unavailable coordination remain quiet.
- Consequences: `agent-brief` and other consumers of `coordinationHints` carry a local validation cue without mixing remembered session context into current worktree evidence. Existing conflicted/caution hints remain unchanged.
- Verification: `npm run test -- tests/core/coordination.test.ts -t "multiple worktrees are clear"` failed before the hint was added, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract stability surface comparison

- Status: accepted
- Context: `scripts/check-stability.mjs` was the highest production-ish hotspot after the previous extraction train. It mixed live manifest loading, stable-surface comparison, addition reporting, baseline updates, and CLI exits in top-level script code, which made the stable contract hard to test directly.
- Decision: Move pure MCP/CLI/exit-code surface shaping and comparison into `scripts/stability-surface.mjs`; keep `scripts/check-stability.mjs` responsible for file IO, baseline updates, CLI output, and exit codes.
- Consequences: `scripts/check-stability.mjs` drops from 256 lines / CC 39 to 214 lines / CC 21. The new comparison module has no hotspot history and keeps every function at CC 5 or below. The CLI wording, allowed additions, baseline path, and `--update` behavior stay unchanged.
- Verification: `npm exec agentflight -- verify npm run test -- tests/scripts/stabilityCheck.test.ts` failed before the extraction because importing the script called `process.exit(0)`, then passed. `npm exec agentflight -- verify npm run test -- tests/scripts/stabilityCheck.test.ts tests/scripts/releaseCheck.test.ts tests/scripts/graphCorpusCheck.test.ts`, `npm exec agentflight -- verify npm run check:stability`, `npm exec agentflight -- verify npm run typecheck`, `npm exec agentflight -- verify npm run lint`, `npm exec agentflight -- verify npm run build`, `npm exec projscan -- bug-hunt --format json`, `npm exec projscan -- release-train --format json`, and `git diff --check` passed with only the expected manual release sign-off caution remaining.

## 2026-06-17: Extract dependency route signals

- Status: accepted
- Context: `src/core/intentRouter.ts` remains the largest production router hotspot. Dependency, audit, workspace, package lookup, bloat, and coupling signal checks were a cohesive group inside `routeKeywordMatches`, creating review noise for maintainers validating route behavior.
- Decision: Move dependency and architecture route-signal helpers into `src/core/intentRouterDependencySignals.ts`, and keep `intentRouter.ts` responsible for catalog data, route scoring, and dispatch composition.
- Consequences: `src/core/intentRouter.ts` drops from 8312 lines / CC 1500 to 8089 lines / CC 1444. The extracted helper has no hotspot history, max function CC 10, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts` passed after extraction. `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts`, `npm exec agentflight -- verify npm run typecheck`, `npm exec agentflight -- verify npm run lint`, `npm exec agentflight -- verify npm run build`, `npm exec projscan -- file src/core/intentRouter.ts --format json`, `npm exec projscan -- file src/core/intentRouterDependencySignals.ts --format json`, `npm exec projscan -- bug-hunt --format json`, `npm exec projscan -- release-train --format json`, and `git diff --check` passed with only the expected manual release sign-off caution remaining.

## 2026-06-17: Extract review route signals

- Status: accepted
- Context: After dependency signal extraction, `src/core/intentRouter.ts` was still the largest production hotspot. PR summary, reviewer routing, and security review keyword checks were a cohesive reviewer-handoff cluster inside the router.
- Decision: Move evidence-pack and review keyword helpers into `src/core/intentRouterReviewSignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 8089 lines / CC 1444 to 8020 lines / CC 1415. The extracted helper has no hotspot history, max function CC 9, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "review and evidence keyword routing"` failed before extraction, then passed. `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts`, `npm exec agentflight -- verify npm run typecheck`, `npm exec agentflight -- verify npm run lint`, `npm exec agentflight -- verify npm run build`, `npm exec projscan -- file src/core/intentRouter.ts --format json`, `npm exec projscan -- file src/core/intentRouterReviewSignals.ts --format json`, `npm exec projscan -- bug-hunt --format json`, `npm exec projscan -- release-train --format json`, and `git diff --check` passed with only the expected manual release sign-off caution remaining.

## 2026-06-17: Extract security route signals

- Status: accepted
- Context: Dataflow and privacy-check keyword routing are security-sensitive route decisions inside the largest production hotspot. Keeping those checks in `intentRouter.ts` made it harder to review route behavior separately from catalog and scoring logic.
- Decision: Move dataflow and privacy keyword helpers into `src/core/intentRouterSecuritySignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 8020 lines / CC 1415 to 7862 lines / CC 1395. The extracted helper has no hotspot history, max function CC 7, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "dataflow and privacy keyword routing"` failed before extraction, then passed. `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts`, `npm exec agentflight -- verify npm run typecheck`, `npm exec agentflight -- verify npm run lint`, `npm exec agentflight -- verify npm run build`, `npm exec projscan -- file src/core/intentRouter.ts --format json`, `npm exec projscan -- file src/core/intentRouterSecuritySignals.ts --format json`, `npm exec projscan -- bug-hunt --format json`, `npm exec projscan -- release-train --format json`, and `git diff --check` passed with only the expected manual release sign-off caution remaining.

## 2026-06-17: Extract infra search route signals

- Status: accepted
- Context: Infrastructure artifact search routing is part of the same intent-router hotspot and also prevents deployment/config lookup language from being misread as release-train intent. The matcher mixed blocked action/failure filters with Docker, orchestration, IaC, hosted config, and workflow deployment subjects in `intentRouter.ts`.
- Decision: Move infrastructure artifact search matching into `src/core/intentRouterSearchInfraSignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 7862 lines / CC 1395 to 7798 lines / CC 1366. The extracted helper has no hotspot history, max function CC 8, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "infra artifact search routing"` failed before extraction, then passed. `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts`, `npm exec agentflight -- verify npm run typecheck`, `npm exec agentflight -- verify npm run lint`, `npm exec agentflight -- verify npm run build`, `npm exec projscan -- file src/core/intentRouter.ts --format json`, `npm exec projscan -- file src/core/intentRouterSearchInfraSignals.ts --format json`, `npm exec projscan -- bug-hunt --format json`, `npm exec projscan -- release-train --format json`, and `git diff --check` passed with only the expected manual release sign-off caution remaining.

## 2026-06-17: Extract UI search route signals

- Status: accepted
- Context: UI interaction search routing is another cohesive cluster inside the largest production router hotspot. It distinguishes lookup questions about forms, loading/empty/error states, keyboard shortcuts, modals, i18n, aria, and focus traps from implementation-plan language.
- Decision: Move UI interaction search matching into `src/core/intentRouterSearchUiSignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 7798 lines / CC 1366 to 7737 lines / CC 1338. The extracted helper has no hotspot history, max function CC 6, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "UI interaction search routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract reliability search route signals

- Status: accepted
- Context: Reliability lookup routing for rate limits, cache invalidation, retries, timeouts, circuit breakers, idempotency, webhook signatures, and debounce behavior was another cohesive search matcher inside the intent-router hotspot.
- Decision: Move reliability search matching into `src/core/intentRouterSearchReliabilitySignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 7737 lines / CC 1338 to 7664 lines / CC 1314. The extracted helper has no hotspot history, max function CC 8, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "reliability search routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract style-system search route signals

- Status: accepted
- Context: Style-system lookup routing for design tokens, Tailwind themes/config, CSS imports/modules, dark mode, breakpoints, and color palettes was another cohesive search matcher inside the intent-router hotspot.
- Decision: Move style-system search matching into `src/core/intentRouterSearchStyleSignals.ts`, while keeping route catalog data, scoring, confidence, dispatch composition, and regression-failure routing inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 7664 lines / CC 1314 to 7589 lines / CC 1288. The extracted helper has no hotspot history, max function CC 6, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "style-system search routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract integration search route signals

- Status: accepted
- Context: Integration lookup routing for named external services, SDK/API clients, HTTP/fetch calls, email providers, S3 storage, GraphQL, and websocket clients was another cohesive search matcher inside the intent-router hotspot.
- Decision: Move integration search matching into `src/core/intentRouterSearchIntegrationSignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 7589 lines / CC 1288 to 7508 lines / CC 1265. The extracted helper has no hotspot history, max function CC 7, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "integration search routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract API contract search route signals

- Status: accepted
- Context: API contract lookup routing for OpenAPI/Swagger specs, tRPC routers, GraphQL schemas/resolvers/queries, protobuf, and gRPC services was another cohesive search matcher inside the intent-router hotspot.
- Decision: Move API contract search matching into `src/core/intentRouterSearchApiSignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 7508 lines / CC 1265 to 7469 lines / CC 1243. The extracted helper has no hotspot history, max function CC 7, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "API contract search routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract communication search route signals

- Status: accepted
- Context: Communication artifact lookup routing for email templates/copy, push notification copy, SMS templates, receipt emails/templates, and invoice PDFs was another cohesive search matcher inside the intent-router hotspot.
- Decision: Move communication artifact search matching into `src/core/intentRouterSearchCommunicationSignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 7469 lines / CC 1243 to 7424 lines / CC 1221. The extracted helper has no hotspot history, max function CC 6, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "communication artifact search routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract state-management search route signals

- Status: accepted
- Context: State-management lookup routing for Redux, Zustand, Jotai, Recoil, context providers, query hooks, and React Query was another cohesive search matcher inside the intent-router hotspot.
- Decision: Move state-management search matching into `src/core/intentRouterSearchStateSignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 7424 lines / CC 1221 to 7350 lines / CC 1199. The extracted helper has no hotspot history, max function CC 6, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "state management search routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract domain workflow search route signals

- Status: accepted
- Context: Domain workflow lookup routing for password reset, invites, onboarding flows, CSV export, audit logs, refunds, and subscription renewal was another cohesive search matcher inside the intent-router hotspot.
- Decision: Move domain workflow search matching into `src/core/intentRouterSearchDomainSignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 7350 lines / CC 1199 to 7310 lines / CC 1179. The extracted helper has no hotspot history, max function CC 7, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "domain workflow search routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract frontend page search route signals

- Status: accepted
- Context: Frontend page lookup routing for named pages, rendered pages, route segments, not-found pages, and 404 pages was another cohesive search matcher inside the intent-router hotspot.
- Decision: Move frontend page search matching into `src/core/intentRouterSearchPageSignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 7310 lines / CC 1179 to 7253 lines / CC 1160. The extracted helper has no hotspot history, max function CC 6, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "frontend page search routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract tooling config search route signals

- Status: accepted
- Context: Tooling config lookup routing for Vite, Vitest, Jest, Babel, Webpack, tsconfig, TypeScript aliases, package managers, workspaces, and lockfiles was another cohesive search matcher inside the intent-router hotspot.
- Decision: Move tooling config search matching into `src/core/intentRouterSearchToolingSignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 7253 lines / CC 1160 to 7175 lines / CC 1141. The extracted helper has no hotspot history, max function CC 6, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "tooling config search routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract navigation layout search route signals

- Status: accepted
- Context: Navigation/layout lookup routing for sidebar nav items, breadcrumbs, page titles, metadata, and Next/dashboard layouts was another cohesive search matcher inside the intent-router hotspot.
- Decision: Move navigation layout search matching into `src/core/intentRouterSearchNavigationSignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 7175 lines / CC 1141 to 7140 lines / CC 1124. The extracted helper has no hotspot history, max function CC 5, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "navigation layout search routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract PR diff route signals

- Status: accepted
- Context: PR-diff keyword routing for commit-message prompts, change summaries, PR size, branch freshness, and branch comparison was another cohesive matcher inside the intent-router hotspot.
- Decision: Move PR-diff keyword matching into `src/core/intentRouterPrDiffSignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 7140 lines / CC 1124 to 7086 lines / CC 1102. The extracted helper has no hotspot history, preserves the existing PR-diff matcher semantics, and does not change the public route schema.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "PR diff keyword routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract preflight route signals

- Status: accepted
- Context: Preflight routing for safe/ready/risk wording and rebase or merge-conflict recovery was another cohesive matcher group inside the intent-router hotspot.
- Decision: Move preflight ready, risk, and branch-recovery matching into `src/core/intentRouterPreflightSignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 7086 lines / CC 1102 to 7033 lines / CC 1086. The extracted helper has no imports, no hotspot history, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "preflight route routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract planning route signals

- Status: accepted
- Context: Feature placement and change-planning routing for domain workflows, state management, data access, navigation, style-system, documentation, database, and API changes was a contiguous helper group inside the intent-router hotspot.
- Decision: Move the planning helper group into `src/core/intentRouterPlanningSignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 7033 lines / CC 1086 to 6767 lines / CC 1033. The extracted helper has no imports, no hotspot history, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "planning route routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract repo setup and orientation route signals

- Status: accepted
- Context: Repo setup, local-service startup, database setup, npm/package script discovery, repo config, and repo orientation routing were a cohesive helper group inside the intent-router hotspot and also acted as blockers for search/test-data routing.
- Decision: Move repo setup and orientation matching into `src/core/intentRouterRepoSignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 6767 lines / CC 1033 to 6519 lines / CC 978. The extracted helper has no imports, no hotspot history, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "repo setup and orientation routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract test-data search route signals

- Status: accepted
- Context: Test-data lookup routing for seeds, fixtures, mocks, factories, and story/storybook artifacts depended on repo setup/script blockers and was another cohesive search matcher inside the intent-router hotspot.
- Decision: Move test-data search matching into `src/core/intentRouterSearchTestSignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 6519 lines / CC 978 to 6482 lines / CC 959. The extracted helper has no hotspot history, preserves existing setup/script blocker semantics through `intentRouterRepoSignals.ts`, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "test-data search routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract data lookup search route signals

- Status: accepted
- Context: Data contract and data access lookup routing for validation schemas, request parsing, JSON serialization, transactions, locking, pagination, ORM models, SQL queries, repositories, and DAOs were adjacent cohesive search matchers inside the intent-router hotspot.
- Decision: Move data lookup search matching into `src/core/intentRouterSearchDataSignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 6482 lines / CC 959 to 6358 lines / CC 929. The extracted helper has no hotspot history, preserves existing package-script blocker semantics through `intentRouterRepoSignals.ts`, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "data lookup search routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract background-work search route signals

- Status: accepted
- Context: Background-work lookup routing for cron jobs, scheduled tasks, workers, queues, processors, and background jobs was another cohesive search matcher inside the intent-router hotspot.
- Decision: Move background-work search matching into `src/core/intentRouterSearchBackgroundSignals.ts`, while keeping route catalog data, scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 6358 lines / CC 929 to 6299 lines / CC 920. The extracted helper has no imports, no hotspot history, preserves existing lookup semantics, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "background-work search routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract ownership search route signals

- Status: accepted
- Context: Ownership/team lookup routing for owner, team, area, expert, help, and contact questions was another cohesive search matcher inside the intent-router hotspot and needed to keep claim-routing blockers visible.
- Decision: Move ownership search matching into `src/core/intentRouterSearchOwnershipSignals.ts`, while keeping route catalog data, scoring, confidence, claim matching, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 6299 lines / CC 920 to 6280 lines / CC 910. The extracted helper has no imports, no hotspot history, receives the existing claim-context blocker from the router, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "ownership search routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract regression and failure route signals

- Status: accepted
- Context: Regression planning, CI failure, flaky test, local setup blocker, style-system failure, tooling failure, and proof-command routing shared a cohesive matcher cluster inside the intent-router hotspot.
- Decision: Move that matcher cluster into `src/core/intentRouterRegressionSignals.ts`, while keeping route catalog data, scoring, release routing, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 6280 lines / CC 910 to 6063 lines / CC 838. The extracted helper has no imports, no hotspot history, preserves the existing regression/failure keyword semantics, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "regression and failure routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract verification and coverage route signals

- Status: accepted
- Context: Verification planning, test-location lookup, coverage-gap routing, code-location lookup, and test-run guards were another cohesive matcher cluster inside the intent-router hotspot.
- Decision: Move that matcher cluster into `src/core/intentRouterVerificationSignals.ts`, while keeping route catalog data, route scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 6063 lines / CC 838 to 5928 lines / CC 800. The extracted helper imports only existing repo and regression signal helpers, has no hotspot history, preserves the existing verification/coverage keyword semantics, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "verification and coverage routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract general lookup search route signals

- Status: accepted
- Context: Route-handler, feature-flag, env-var, quoted debug text, observability, authorization, config, migration, generated-code, and documentation lookup routing formed a general search matcher cluster inside the intent-router hotspot.
- Decision: Move that matcher cluster into `src/core/intentRouterSearchLookupSignals.ts`, while keeping dataflow, route catalog data, route scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 5928 lines / CC 800 to 5582 lines / CC 761. The extracted helper has no imports, no hotspot history, preserves existing lookup keyword semantics, and no public route schema change. Projscan reports a potential TODO/FIXME on the helper only because an existing `todo` keyword token moved with the authorization blocker list.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "general lookup search routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract risk and impact route signals

- Status: accepted
- Context: File history/test questions, impact checks, rollback intent, doctor cleanup routing, and hotspot/performance routing formed a risk-focused matcher cluster inside the intent-router hotspot.
- Decision: Move that matcher cluster into `src/core/intentRouterRiskSignals.ts`, while keeping route catalog data, route scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 5582 lines / CC 761 to 5332 lines / CC 732. The extracted helper imports only existing repo and regression signal helpers, has no hotspot history, preserves existing risk/impact keyword semantics, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "risk and impact routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract release and no-release route signals

- Status: accepted
- Context: Release-readiness routing and prohibited no-release/version-bump wording are small but high-risk helpers inside the intent-router hotspot because they decide whether "do not release" wording suppresses release/upgrade routes.
- Decision: Move the release/no-release matcher cluster into `src/core/intentRouterReleaseSignals.ts`, while keeping route catalog data, route scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 5332 lines / CC 732 to 5225 lines / CC 717. The extracted helper has no imports, no hotspot history, preserves existing release-readiness and no-release keyword semantics, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "release and no-release routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract coordination and session route signals

- Status: accepted
- Context: Claim, coordinate, collision, merge-order, and session-resume routing formed a collaboration matcher cluster inside the intent-router hotspot and also blocked ownership search from becoming claim routing.
- Decision: Move that matcher cluster into `src/core/intentRouterCoordinationSignals.ts`, while keeping route catalog data, route scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 5225 lines / CC 717 to 5106 lines / CC 702. The extracted helper has no imports, no hotspot history, preserves existing coordination/session keyword semantics, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "coordination and session routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract workplan and bug-hunt route signals

- Status: accepted
- Context: Workplan, product-planning, bug-hunt speed, quick-win, and protected "improve next" routing formed a planning-opportunity matcher cluster inside the intent-router hotspot.
- Decision: Move that matcher cluster into `src/core/intentRouterWorkSignals.ts`, while keeping route catalog data, route scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 5106 lines / CC 702 to 4961 lines / CC 690. The extracted helper has no imports, no hotspot history, preserves existing workplan/bug-hunt keyword semantics, and no public route schema change. Projscan reports a potential TODO/FIXME on the helper only because the existing `todo` keyword token moved with workplan routing.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "workplan and bug-hunt opportunity routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract explicit dataflow route signals

- Status: accepted
- Context: Explicit dataflow and dataflow-risk context checks remained in the intent-router hotspot even though keyword-level dataflow and privacy routing already lived in `intentRouterSecuritySignals.ts`.
- Decision: Move the explicit dataflow helper pair into `src/core/intentRouterSecuritySignals.ts`, while keeping route catalog data, route scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 4961 lines / CC 690 to 4909 lines / CC 690. The expanded security helper still has no imports, no hotspot history, preserves existing dataflow/privacy keyword semantics, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "dataflow and privacy keyword routing"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract intent target route signals

- Status: accepted
- Context: File-path, env-var, quoted-text, package-removal, and package-change target detection remained as setup helpers at the bottom of the intent-router hotspot.
- Decision: Move the target detection helper group into `src/core/intentRouterTargetSignals.ts`, while keeping route catalog data, route scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 4909 lines / CC 690 to 4830 lines / CC 686. The extracted helper has no imports, no hotspot history, preserves existing target-detection semantics, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "intent target detection"` failed before extraction, then passed. Full slice verification is recorded in the AgentLoop report for this slice.

## 2026-06-17: Extract understand keyword route signals

- Status: accepted
- Context: `understandKeywordMatches` remained as a large route-specific helper inside the intent-router hotspot and carried repo, setup, verification, documentation, database, API, and feature-placement routing gates.
- Decision: Move the understand helper into `src/core/intentRouterUnderstandSignals.ts`, while keeping route catalog data, route scoring, confidence, and dispatch composition inside `intentRouter.ts`.
- Consequences: `src/core/intentRouter.ts` drops from 4830 lines / CC 686 to 4630 lines / CC 654. The extracted helper imports existing planning, repo, and verification signal modules, has no hotspot history, preserves existing understand keyword semantics, and no public route schema change.
- Verification: `npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "understand keyword routing"` failed before extraction, then passed. Full slice verification caught stale router imports via lint; those imports were removed and the fixed state passed.

## 2026-06-17: Add Next route nextUrl dataflow source

- Status: accepted
- Context: Next route handlers commonly read query parameters through `request.nextUrl.searchParams`, which is user-controlled request input. Existing framework dataflow covered Next body readers and `request.url`, but missed this precise query-param accessor.
- Decision: Add `request.nextUrl.searchParams` as a Next route request source only for exported HTTP method handlers in `app/**/route.*`, reusing the existing qualified member-reference gate.
- Consequences: `projscan dataflow` can report one additional additive source value for Next route handlers. Helper functions with a `request.nextUrl.searchParams`-shaped argument remain quiet because source detection is still route-file and HTTP-handler scoped.
- Verification: `npm run test -- tests/core/dataflowFrameworkNextHono.test.ts -t "nextUrl search params"` failed before the source-map change, then passed.

## 2026-06-17: Narrow file purpose test-name detection

- Status: accepted
- Context: `projscan file src/core/fileInspector.ts --format json` classified the source file as `Test file` because the purpose matcher treated any basename containing `spec` as a test, so words like `inspector` were false positives.
- Decision: Replace broad `test`/`spec` substring matching with separator-aware filename tokens: `test`, `tests`, `spec`, and `specs`.
- Consequences: Real `*.test.*` and `*.spec.*` files still classify as test files, while source files such as `fileInspector.ts` and `testCheck.ts` fall back to normal purpose inference.
- Verification: `npm run test -- tests/core/fileInspector.test.ts -t "words containing spec"` failed before the matcher change, then passed. A rebuilt `projscan file src/core/fileInspector.ts --format json` smoke reported `purpose: "Source module"`.

## 2026-06-17: Export code graph result types from package entrypoint

- Status: accepted
- Context: The package entrypoint exports `buildCodeGraph`, but consumers had to reach into `src/core/codeGraph` for the corresponding `CodeGraph` and `GraphFile` result types. After the internal code-graph type extraction, those types have a stable cycle-safe home and can be re-exported without changing runtime behavior.
- Decision: Add an additive type-only export for `CodeGraph` and `GraphFile` from `src/index.ts`, backed by public type tests.
- Consequences: Consumers can import `type CodeGraph` and `type GraphFile` from the package entrypoint alongside `buildCodeGraph`. Runtime output, CLI behavior, MCP behavior, and existing public schemas do not change.
- Verification: `npm run test -- tests/types/public-graph-types.test.ts` failed before the entrypoint export, then passed.

## 2026-06-17: Route prohibited-release continuation prompts to work planning

- Status: accepted
- Context: Agent instructions often say to keep implementing while explicitly prohibiting release, publish, deploy, push, merge, tag, or version-bump actions. The intent router already blocked release-action keywords in that context, but continuation wording such as "keep going and do not cut a release" could produce no route, and generic release-train keywords could still appear as lower-ranked alternatives.
- Decision: Treat guarded "keep going", "continue", and implementation-roadmap wording as workplan intent, suppress release-train and package-upgrade routes whenever the corresponding action is explicitly prohibited, and require real regression context before the standalone `full` keyword routes to regression planning.
- Consequences: No-release continuation prompts now route to `projscan_workplan` instead of release or upgrade workflows. Positive release-readiness prompts still route to release-train, and explicit full-regression prompts still route to regression planning.
- Verification: `npm run test -- tests/core/intentRouterCoordinationWork.test.ts` failed before the routing change, then passed. The adjacent router suites also passed: `tests/core/intentRouterCoordinationWork.test.ts`, `tests/core/intentRouterReviewRelease.test.ts`, `tests/core/intentRouterRegressionSecurity.test.ts`, and `tests/core/intentRouter.test.ts`.

## 2026-06-17: Ignore all JSON-RPC notifications in the MCP dispatcher

- Status: accepted
- Context: The MCP dispatcher detected notification-shaped requests (`id` omitted or `null`) but still dispatched known methods such as `ping` and `tools/list`, returning responses with `id: null`. JSON-RPC notifications must not produce responses.
- Decision: Return `null` for any notification before method dispatch, while preserving the existing initialized-notification behavior and normal request handling for messages with an id.
- Consequences: Inbound notification-shaped `ping`, `tools/list`, and other known methods no longer emit responses or perform tool-side work. Standard request/response calls with ids are unchanged, and outbound server notifications still use the existing `notify` path.
- Verification: `npm run test -- tests/mcp/server.test.ts` failed before the dispatcher change, then passed. Adjacent MCP server, file-change notification, progress, and cross-cutting suites passed together.

## 2026-06-17: Use UUID-backed MCP watch identifiers

- Status: accepted
- Context: Long-running MCP watch tools return a `watchId` that clients later pass to stop the stream. The review-watch implementation documented that server-side watch registration should use `crypto.randomUUID()`, but the shared server context still used a timestamp plus `Math.random()` suffix.
- Decision: Generate watch identifiers as `watch-${randomUUID()}` in `createToolContext`.
- Consequences: Watch IDs remain opaque strings but now have UUID entropy and a stable `watch-<uuid>` shape. Existing stop/list flows continue to work because clients should treat the identifier as opaque.
- Verification: `npm run test -- tests/mcp/serverContext.test.ts` failed before the UUID change, then passed. Watch lifecycle suites for server context, coordination watch, review watch, and cost summary stream passed together.

## 2026-06-17: Add Remix route dataflow request sources

- Status: accepted
- Context: Remix route modules pass user-controlled inputs through destructured `loader`, `action`, `clientLoader`, and `clientAction` arguments. `FunctionInfo.parameters` ignored object-pattern bindings, so dataflow could not classify `request` or `params` in those handlers.
- Decision: Capture binding names from destructured function parameters and add route-file-scoped Remix dataflow labels for `remix.request.json`, `remix.request.formData`, `remix.request.text`, `remix.request.arrayBuffer`, `remix.request.headers`, `remix.request.url`, `remix.request.signal`, and `remix.params`.
- Consequences: `projscan dataflow` can report additional additive source labels for `app/routes/**` Remix handlers. Same-shaped helpers outside route modules, or exported helpers that are not Remix request handlers, remain quiet.
- Verification: `npm run test -- tests/core/ast.references.test.ts tests/core/dataflowFrameworkRemix.test.ts tests/core/dataflowSuiteStructure.test.ts` failed before the AST/source changes, then passed.

## 2026-06-17: Route build-next start prompts to release-train roadmap evidence

- Status: accepted
- Context: The release-train roadmap task expects `projscan start --intent "what should we build next?"` to surface post-4.4 workstreams, but the intent previously routed to the bug-hunt workplan.
- Decision: Treat build-next, product roadmap, feature roadmap, and workstream planning prompts as release-train planning context, and add `evidence.roadmapPreview` to release-mode start output using the existing roadmap catalog.
- Consequences: Start JSON can now show a read-only roadmap preview with release-train lines and workstream titles. Explicit non-release modes still keep their selected workplan action, and explicit bug-hunt prompts remain bug-hunt.
- Verification: `npm run test -- tests/core/startAgentPlanning.test.ts tests/core/startReviewRouting.test.ts tests/cli/start.test.ts` failed before the routing/preview changes, then passed.

## 2026-06-17: Align build-next docs with roadmap routing

- Status: accepted
- Context: README and GUIDE still described `projscan start --intent "what should we build next?"` as a bug-hunt product-planning workplan after the implementation changed the route to release-train roadmap evidence.
- Decision: Update public docs to name release-train roadmap planning and `evidence.roadmapPreview`, while keeping quick-win, low-risk, and broad improve-next prompts documented as bug-hunt routes.
- Consequences: Agents reading docs see the same product-planning route that JSON clients receive. No command, schema, version, changelog, or release behavior changes.
- Verification: `npm run test -- tests/docs/startRoutingDocs.test.ts` failed before the docs changes, then passed.

## 2026-06-17: Simplify framework request-source dispatch

- Status: accepted
- Context: `src/core/frameworkSources.ts` remained a high-churn hotspot with one shared dispatcher at cyclomatic complexity 6 even though framework-specific source matching already lived in focused modules.
- Decision: Replace the shared dispatcher body with an ordered resolver pipeline that preserves Next, Remix, Hono, Express, Fastify, and Koa precedence while keeping `FrameworkRequestSourceContext` as the caller contract.
- Consequences: The dispatcher is a lower-complexity orchestrator and individual framework matchers remain isolated. Dataflow and taint callers keep the same API and request-source labels.
- Verification: `npm run test -- tests/core/frameworkSources.test.ts -t "low-complexity orchestrator"` failed before the resolver-pipeline refactor, then passed. The full framework dataflow fixture set also passed.

## 2026-06-17: Follow local Python requirement includes for upgrade evidence

- Status: accepted
- Context: Python upgrade previews read root requirements and constraints, but split pip requirements layouts can place declarations behind `-r` includes and pins behind `-c` includes.
- Decision: Follow local, repo-contained requirement and constraint includes from scanned requirements files. Included requirements add declaration evidence, included constraints add pinned current-version evidence, and unsafe or unscanned include paths are ignored.
- Consequences: `projscan upgrade <python-package>` can now preview split-requirements projects without installing packages, reading outside the scanned file set, adding network calls, or changing the upgrade schema. Exact pins in included requirements keep the existing behavior of acting as lockfile evidence.
- Verification: `npm run test -- tests/core/upgradePreview.test.ts -t "included requirements|included constraints"` and the adjacent Python project-detection/manifest suites failed before the include traversal, then passed. The complexity regression for the requirements include helpers also passed after refactor.

## 2026-06-17: Extract file inspection report assembly

- Status: accepted
- Context: `src/core/fileInspector.ts` remained a high-churn hotspot, and `inspectFile` still mixed path-read branching with scan loading, graph shaping, hotspot evidence, issue evidence, and report assembly.
- Decision: Move existing-file report assembly into `src/core/fileInspectionReport.ts` and keep `inspectFile` as the read-success/read-failure boundary.
- Consequences: `inspectFile` drops to cyclomatic complexity 2 while public exports, path-safety behavior, file purpose, imports, exports, issues, hotspots, graph metrics, and `FileInspection` output remain unchanged. The new helper owns one cohesive existing-file report assembly path at cyclomatic complexity 4.
- Verification: `npm run test -- tests/core/fileInspector.test.ts -t "low-complexity orchestration boundary"` failed before extraction, then passed. The full file inspector suite and `projscan file` metrics passed after extraction.

## 2026-06-17: Split Python lockfile parser tests

- Status: accepted
- Context: `tests/core/languages/pythonManifests.test.ts` still mixed requirements, pyproject, and five lockfile parser fixture families after earlier Python suite separation, increasing review friction for Python ecosystem changes.
- Decision: Move Poetry, Pipfile, uv, PDM, and Conda lockfile parser coverage into `tests/core/languages/pythonLockfiles.test.ts`, and add suite-structure assertions that keep lockfile parser coverage out of `pythonManifests.test.ts`.
- Consequences: The manifest parser suite now stays focused on PEP 508, requirements, and pyproject behavior at 150 lines. Lockfile parser exports and behavior are unchanged; this is a test organization hardening slice only.
- Verification: `npm run test -- tests/core/languages/pythonManifestSuiteStructure.test.ts` failed before the split, then passed. The manifest and lockfile parser suites passed together with 21 tests, and `projscan file tests/core/languages/pythonManifests.test.ts --format json` reported no issues.

## 2026-06-17: Simplify AST binding identifier traversal

- Status: accepted
- Context: `projscan review` flagged `src/core/astMembers.ts` `bindingIdentifierNames` as the one newly added high-CC function in the current train. That helper feeds destructured function parameter capture, which framework dataflow uses for route handlers.
- Decision: Convert `bindingIdentifierNames` into a small resolver dispatcher and delegate Identifier, AssignmentPattern, RestElement, ObjectPattern, and ArrayPattern traversal to focused helpers.
- Consequences: `bindingIdentifierNames` drops from cyclomatic complexity 12 to 3, and `projscan review` no longer reports risky functions. AST reference extraction, member alias capture, and framework request-source behavior remain unchanged.
- Verification: `npm run test -- tests/core/astMembersArchitecture.test.ts` failed before the refactor, then passed. The AST reference suite, Remix/Next/Hono framework dataflow suites, `projscan file src/core/astMembers.ts --format json`, and a parsed `projscan review --format json --quiet` summary passed after the refactor.

## 2026-06-17: Extract plugin manifest validation

- Status: accepted
- Context: `src/core/plugins.ts` remained a plugin trust-adjacent hotspot at 725 lines / cyclomatic complexity 90, with `validateManifest` at cyclomatic complexity 20.
- Decision: Move plugin manifest schema constants, manifest types, diagnostic types, reporter command validation, and `validateManifest` into `src/core/pluginManifestValidation.ts`, while re-exporting the same public names from `src/core/plugins.ts`.
- Consequences: `src/core/plugins.ts` drops to 547 lines / cyclomatic complexity 65 and remains focused on plugin runtime loading, trust checks, reporter rendering, and issue shaping. `validateManifest` now lives in a focused validation module at cyclomatic complexity 3. Public plugin API names and diagnostic behavior are unchanged.
- Verification: `npm run test -- tests/core/pluginArchitecture.test.ts` failed before extraction, then passed. Plugin pipeline, trust-gate, and MCP plugin suites passed; `projscan file` metrics for both plugin modules reported no issues.

## 2026-06-17: Extract dataflow risk assembly

- Status: accepted
- Context: `computeDataflow` owned source/sink setup, taint risk construction, bridge risk construction, filtering, sorting, and report assembly, leaving the exported dataflow entrypoint at cyclomatic complexity 24.
- Decision: Move direct, propagated, and bridge `DataflowRisk` construction into `src/core/dataflowRiskAssembly.ts`, while keeping `computeDataflow` as the public orchestration and report-shaping boundary.
- Consequences: The dataflow public API and report schema stay unchanged. Risk dedupe order, filter behavior, bridge reachability, and final sorting continue to use the existing traversal and filter helpers, but the entrypoint is now guarded by a low-complexity architecture test.
- Verification: `npm run test -- tests/core/dataflowArchitecture.test.ts` failed before extraction at cyclomatic complexity 24, then passed after the extraction.

## 2026-06-17: Simplify telemetry command categorization

- Status: accepted
- Context: `src/core/telemetry.ts` is policy-sensitive and remained a high-complexity hotspot. Its command categorizer used a long branch chain even though the behavior is a fixed mapping from sanitized command names to existing telemetry categories.
- Decision: Replace the branch chain with a constant command-to-category lookup table and keep `categorizeCommand` as a small sanitizer-plus-lookup helper.
- Consequences: Telemetry opt-in, no-network behavior, queueing, sending, event fields, and public telemetry exports remain unchanged. The category aliases stay explicit in one table, and `categorizeCommand` is guarded by an architecture test.
- Verification: `npm run test -- tests/core/telemetryArchitecture.test.ts` failed before the refactor at cyclomatic complexity 14, then passed after the lookup-table change.

## 2026-06-17: Simplify telemetry flush orchestration

- Status: accepted
- Context: `flushTelemetry` still mixed runtime guard checks, config eligibility, queue loading, sender execution, queue cleanup, and failure result shaping at cyclomatic complexity 11 inside the telemetry hotspot.
- Decision: Extract the runtime flush guard into `flushBlockedResult` and sender execution plus queue cleanup into `sendQueuedTelemetry`, leaving `flushTelemetry` as the public orchestration boundary.
- Consequences: Telemetry opt-in, no-network behavior, queue handling, sender behavior, failure shaping, event fields, and public telemetry exports remain unchanged. `flushTelemetry` is now guarded by the telemetry architecture test alongside command categorization.
- Verification: `npm run test -- tests/core/telemetryArchitecture.test.ts` failed before the refactor at cyclomatic complexity 11 for `flushTelemetry`, then passed after the helper extraction.

## 2026-06-17: Clear release readiness blockers

- Status: accepted
- Context: Full-suite release-readiness checks still had stale expectations for build-next intent routing, and preflight review reported a new telemetry taint flow from `recordCommandTelemetry` to queue cleanup after the flush helper extraction.
- Decision: Align the legacy intent-router tests with the accepted release-train roadmap route for build-next prompts, and route the telemetry no-network env read through `isTelemetryNetworkDisabled` so the command-recording function no longer owns both env access and a path to queue deletion.
- Consequences: Intent routing behavior, telemetry opt-in, no-network behavior, queue handling, sender behavior, event fields, and public telemetry exports remain unchanged. Review no longer reports the telemetry env-to-rm taint flow.
- Verification: `npm run test` and `projscan preflight --mode before_commit --format json` exposed the blockers before the fix. Focused intent-router tests, telemetry tests, and `projscan review --format json` passed after the fix with no new taint flows.

## 2026-06-18: Extract handler framework source matching helpers

- Status: accepted
- Context: Handler-based framework dataflow adapters repeated the same enabled-source, member-reference, member-call, route-handler, and known-parameter matching loops across Hono, Express, Fastify, and Koa.
- Decision: Add `src/core/frameworkSourceMatching.ts` for shared source matching primitives and route the handler-based framework adapters through it while preserving the existing framework-specific gating and source labels.
- Consequences: Dataflow request-source behavior remains unchanged, but future handler-based framework additions now review against one matching helper instead of several duplicated loops. The framework adapter guard prevents reintroducing per-adapter `bareName` and member-set loops in those adapters.
- Verification: `npm run test -- tests/core/frameworkSources.test.ts -t "shared helpers"` failed before the helper existed, then passed. The full framework source and framework dataflow suites passed after extraction.

## 2026-06-18: Separate coordination branch-delta and dirty-worktree counts

- Status: accepted
- Context: Coordination evidence used `changedFileCount` for files changed against the base ref. In a clean local branch ahead of `origin/main`, that count is nonzero even though there are no uncommitted files, which can mislead next-agent handoffs.
- Decision: Add `uncommittedChangedFileCount` to coordination worktree summaries and evidence while preserving `changedFileCount` as the branch/base delta field.
- Consequences: `projscan collisions`, `projscan coordinate`, and agent-brief coordination hints can now distinguish committed local work from dirty files without removing or renaming existing JSON fields.
- Verification: `npm run test -- tests/core/collisionDetector.test.ts tests/core/agentBrief.test.ts` failed before the additive field and hint wording, then passed after the change.

## 2026-06-18: Route shareable evidence prompts to report-control commands

- Status: accepted
- Context: Scoped/redacted report controls were available on `analyze`, `doctor`, and `ci`, but `projscan start --intent "share redacted evidence for src/api with a partner"` routed to generic repo understanding because `api` matched the understand route. That hid the path-safe artifact workflow from security reviewers and partner handoffs.
- Decision: Add a guarded `projscan_analyze` intent route for shareable scoped/redacted evidence, infer the before-commit workflow for that route, and return ready analyze, doctor, and CI commands with `--report-scope` and `--redact-paths`.
- Consequences: Mission Control now exposes the existing path-safe artifact workflow from natural-language prompts. Generic PR comment, PR description, checklist, and team-summary prompts still route to `projscan evidence-pack --pr-comment`. Report filtering, redaction, and output schemas are unchanged.
- Verification: `npm run test -- tests/core/startReviewRouting.test.ts tests/core/intentRouterReviewRelease.test.ts` failed before the route/action-plan change, then passed after it.

## 2026-06-18: Read nested Python constraints manifests

- Status: accepted
- Context: Python upgrade previews could read included constraints from root requirements files and direct root `constraints*.txt`, but common direct files such as `constraints/base.txt` and `constraints/prod.txt` were invisible unless another manifest included them.
- Decision: Treat recognized `constraints/*.txt` names as Python project evidence and pinned lock evidence when they are already present in the scan file list.
- Consequences: Offline Python previews can use nested constraints as current-version evidence without declaring runtime dependencies, adding globbing, or reading files outside the scan boundary. Existing included-constraint parsing and unsafe include guards remain unchanged.
- Verification: `npm run test -- tests/core/languages/pythonProjectDetection.test.ts tests/core/upgradePreview.test.ts` failed before nested constraints were recognized, then passed after the change.

## 2026-06-18: Group public entrypoint re-exports

- Status: accepted
- Context: `src/index.ts` remained a high-churn public entrypoint because every public value export edge lived directly in one dense file, so unrelated additions continued to touch the stable package entrypoint.
- Decision: Keep `src/index.ts` as the package entrypoint, but move grouped value re-exports into internal `publicCore`, `publicAgent`, `publicMcp`, and `publicLanguages` entry modules while preserving the type-only public type barrel export. Treat re-export regrouping as neutral in review-contract evidence when the symbol was already public before and remains public after.
- Consequences: Public names remain available from `src/index.ts`, but future public-surface edits can land in narrower grouped files. Stability-sensitive aliases, type specifiers, and review-contract noise from neutral regrouping stay covered by focused tests and the stable-surface gate.
- Verification: `npm run test -- tests/types/public-entrypoint-type-star.test.ts` failed before the grouped modules existed, then passed after the refactor. `npm run test -- tests/core/reviewContract.test.ts -t "neutral public re-export grouping"` failed before the contract evidence filter, then passed after the fix.

## 2026-06-18: Extract HTML review reporter

- Status: accepted
- Context: `src/reporters/htmlReporter.ts` still owned the PR review HTML renderer beside unrelated HTML formats, keeping a reviewer-facing artifact surface in one larger file.
- Decision: Move `reportReviewHtml` into `src/reporters/htmlReviewReporter.ts`, move shared HTML shell/escaping/sign helpers into `src/reporters/htmlShared.ts`, and keep `src/reporters/htmlReporter.ts` as the compatibility re-export boundary.
- Consequences: Review HTML artifact wording and import compatibility stay stable while the main HTML reporter sheds review-only rendering logic without introducing an import cycle.
- Verification: `npm run test -- tests/reporters/htmlReviewReporter.test.ts` failed before the extracted module existed, then passed after the extraction. A bug-pass review then flagged the moved renderer as a new high-CC function, so `tests/reporters/htmlReviewReporter.test.ts` now also guards the renderer entrypoint complexity; the full task verification passed after the helper split.

## 2026-06-18: Extract HTML PR diff reporter

- Status: accepted
- Context: `src/reporters/htmlReporter.ts` still owned the PR structural diff HTML renderer at cyclomatic complexity 9 after the review renderer extraction.
- Decision: Move `reportPrDiffHtml` into `src/reporters/htmlPrDiffReporter.ts`, reuse `src/reporters/htmlShared.ts`, and keep `src/reporters/htmlReporter.ts` as the compatibility re-export boundary.
- Consequences: PR diff HTML artifact wording and import compatibility stay stable while the main HTML reporter sheds another review-only renderer.
- Verification: `npm run test -- tests/reporters/htmlPrDiffReporter.test.ts` failed before the extracted module existed, then passed after the extraction. Existing HTML reporter coverage and `npm run typecheck` also passed.

## 2026-06-18: Extract HTML analysis reporter

- Status: accepted
- Context: `src/reporters/htmlReporter.ts` still owned the broad project analysis HTML renderer at cyclomatic complexity 9 after the review and PR diff renderer extractions.
- Decision: Move `reportAnalysisHtml` into `src/reporters/htmlAnalysisReporter.ts`, share report-control rendering through `src/reporters/htmlShared.ts`, and keep `src/reporters/htmlReporter.ts` as the compatibility re-export boundary.
- Consequences: First-run HTML analysis artifact wording and import compatibility stay stable while the main HTML reporter sheds another high-complexity renderer.
- Verification: `npm run test -- tests/reporters/htmlAnalysisReporter.test.ts` failed before the extracted module existed, then passed after the extraction. Existing HTML reporter coverage and `npm run typecheck` also passed.

## 2026-06-18: Extract HTML coverage and impact reporters

- Status: accepted
- Context: `src/reporters/htmlReporter.ts` still owned the remaining Coverage x Risk and Impact HTML renderers, leaving the highest local complexity in the compatibility reporter after the analysis, review, and PR diff extractions.
- Decision: Move `reportCoverageHtml` into `src/reporters/htmlCoverageReporter.ts`, move `reportImpactHtml` into `src/reporters/htmlImpactReporter.ts`, and keep both functions re-exported from `src/reporters/htmlReporter.ts`.
- Consequences: Coverage and impact artifact wording, escaping, unavailable states, and import compatibility remain stable while the umbrella reporter is narrowed to the smaller health, hotspot, and coupling renderers.
- Verification: `npm run test -- tests/reporters/htmlCoverageReporter.test.ts tests/reporters/htmlImpactReporter.test.ts` failed before the extracted modules existed, then passed after the extraction. Existing HTML reporter coverage also passed.

## 2026-06-18: Extract changed review report assembly

- Status: accepted
- Context: `src/core/review.ts` is a high-churn review gate hotspot and still owned the changed-review path after state resolution, including head/base snapshots, PR diffing, manifest reads, finding assembly, report shaping, and intent annotation.
- Decision: Move ready-state changed-review assembly into `src/core/reviewChangedReport.ts` while keeping `computeReview` responsible for state dispatch and no-change intent annotation.
- Consequences: Review verdict behavior, intent annotation, schemas, CLI/MCP behavior, and public exports remain unchanged. Future changed-review assembly edits now land in a focused helper instead of the review dispatcher.
- Verification: `npm run test -- tests/core/reviewArchitecture.test.ts` failed before the helper existed and `review.ts` stopped importing assembly helpers, then passed after extraction. Existing `tests/core/review.test.ts` behavior coverage also passed.

## 2026-06-18: Extract telemetry sender helper

- Status: accepted
- Context: `src/core/telemetry.ts` remained a moderate-complexity privacy-sensitive hotspot and still contained the `fetch`/`AbortController` sender implementation beside default-off policy, status, queueing, and flush orchestration.
- Decision: Move the default network sender and `TelemetrySender` type into `src/core/telemetrySender.ts`, and re-export the type from `src/core/telemetry.ts` for public compatibility.
- Consequences: Telemetry remains default-off, local-first, and controlled by the same offline/no-network/disabled env guards. Event payload shape, endpoint behavior, queue flushing, and public imports remain unchanged while network-capable code is easier to review in one module.
- Verification: `npm run test -- tests/core/telemetryArchitecture.test.ts` failed before `telemetry.ts` delegated sender wiring, then passed after extraction. Existing telemetry behavior tests also passed.

## 2026-06-18: Extract telemetry recording helper

- Status: accepted
- Context: After the sender split, `src/core/telemetry.ts` still mixed default-off policy/status/flush behavior with command and feedback event recording, usage updates, queue appends, and record-time flush delegation.
- Decision: Move command and feedback recording into `src/core/telemetryRecording.ts`, keep `src/core/telemetry.ts` as the public facade, and pass the existing runtime guard functions into the helper instead of changing their behavior.
- Consequences: Public telemetry imports, opt-in policy, event payload shape, queue semantics, flush behavior, and offline/no-network/disabled guards remain stable. Recording-specific privacy review now has one focused module.
- Verification: `npm run test -- tests/core/telemetryArchitecture.test.ts` failed before the helper existed and `telemetry.ts` stopped owning recording internals, then passed after extraction. Existing telemetry behavior tests also passed.

## 2026-06-18: Extract telemetry flush helper

- Status: accepted
- Context: After the sender and recording splits, `src/core/telemetry.ts` still owned flush orchestration, queued-event reads, default sender selection, queue clearing, and send-result mapping beside policy/status APIs.
- Decision: Move flush orchestration into `src/core/telemetryFlushing.ts`, keep `flushTelemetry` as a public facade in `src/core/telemetry.ts`, and pass the existing runtime guard functions into the helper.
- Consequences: Public telemetry imports, sender selection, queue clearing after successful sends, skipped/queued/failed result shapes, and offline/no-network/disabled guard behavior remain stable. The public telemetry facade drops to low complexity while flush review has one focused module.
- Verification: `npm run test -- tests/core/telemetryArchitecture.test.ts` failed before the helper existed and `telemetry.ts` stopped owning flush internals, then passed after extraction. Existing telemetry behavior tests also passed.

## 2026-06-18: Extract plugin issue validation helper

- Status: accepted
- Context: `src/core/plugins.ts` is a trust-boundary hotspot and still mixed plugin loading/execution with analyzer issue-shape validation and severity checks.
- Decision: Move analyzer plugin issue shape validation into `src/core/pluginIssueValidation.ts` and keep `runAnalyzerPlugins` responsible for execution, plugin-id prefixing, and category fallback.
- Consequences: Plugin trust gating, dynamic import behavior, reporter behavior, manifest validation, malformed issue dropping, and public plugin exports remain unchanged. The runtime file sheds private validation complexity into a focused helper.
- Verification: `npm run test -- tests/core/pluginArchitecture.test.ts` failed before the helper existed and `plugins.ts` stopped owning `isWellShapedIssue`, then passed after extraction. The malformed issue runtime test also passed.

## 2026-06-18: Extract plugin reporter runtime helper

- Status: accepted
- Context: `src/core/plugins.ts` still owned reporter plugin discovery, command support checks, trust diagnostics, dynamic module loading, render validation, and render failure isolation after analyzer loading had already moved out. Reporter plugins execute local code and produce reviewer-facing output, so this path needs a narrow audit boundary.
- Decision: Move reporter plugin resolution, reporter runtime types, trust-before-import loading, and render isolation into `src/core/pluginReporterLoading.ts`. Keep `src/core/plugins.ts` as the public facade by preserving `resolveReporterPlugin`, re-exporting `renderReporterPlugin`, and re-exporting reporter types.
- Consequences: Preview flag behavior, trust-on-first-use behavior, reporter diagnostics, CLI reporter behavior, public plugin imports, and MCP/CLI schemas remain unchanged. The plugin facade drops reporter runtime complexity while the helper is guarded against importing back from the facade.
- Verification: `npm run test -- tests/core/pluginArchitecture.test.ts` failed before the helper existed and `plugins.ts` stopped owning reporter internals, then passed after extraction. AgentLoop task verification passed for architecture tests, reporter runtime tests, rebuilt CLI reporter tests, typecheck, lint, build, and `projscan file` checks. Post-slice bug pass reported a clean doctor result and no concrete new review defects; remaining bug-hunt output is the known release-scale manual sign-off only.

## 2026-06-18: Extract start command option registration

- Status: accepted
- Context: `src/cli/commands/start.ts` is a high-churn Mission Control entrypoint because every new start output shortcut and resume flag edits the same command facade. The file was simple, but option-list churn made future reviews scan command registration and behavior wiring together.
- Decision: Move the Commander `.option(...)` chain into `src/cli/commands/startOptionsRegistration.ts`. Keep `registerStart()` as the command facade that creates the `start` command, sets its description, applies the option helper, and wires `runStartCommandAction`.
- Consequences: Start option names, descriptions, parser callbacks, action wiring, CLI help, Mission Control routing, and output schemas remain unchanged. Future option-list changes can land in one focused helper while the command facade stays stable.
- Verification: `npm run test -- tests/cli/startCommandArchitecture.test.ts` failed before the helper existed and `start.ts` delegated option registration, then passed after extraction. AgentLoop task verification passed for the architecture guard, typecheck, lint, build, rebuilt start CLI JSON behavior, rebuilt shortcut CLI behavior, and `projscan file` checks. Post-slice bug pass reported a clean doctor result and no concrete new review defects; remaining bug-hunt output is the known release-scale manual sign-off only.

## 2026-06-18: Extract start public type modules

- Status: accepted
- Context: `src/types/start.ts` had grown into a 515-line public type surface with 47 fan-in, making Mission Control, proof, review-gate, and final report contracts hard to audit in one file.
- Decision: Split the declarations into focused type-only modules for common start metadata, execution plans, Mission Control, proof reports, resume/runbook contracts, review gates, and tool calls. Keep `src/types/start.ts` as the compatibility re-export surface.
- Consequences: Existing imports from `src/types/start.ts`, the legacy `src/types.ts` barrel, and the package entrypoint keep the same exported type names and shapes. Future public type changes can be reviewed in smaller files.
- Verification: `npm run test -- tests/types/public-start-quality-types.test.ts` failed before `src/types/start.ts` delegated to focused modules, then passed after extraction. `npm run typecheck:public-types` and `npm run typecheck` also passed during implementation.

## 2026-06-18: Add SvelteKit framework dataflow sources

- Status: accepted
- Context: The 4.7 framework precision line covered Next, Remix, Hono, Express, Fastify, and Koa, but SvelteKit `RequestEvent` route handlers, server loads, and hooks were still invisible to the framework request-source resolver.
- Decision: Add a SvelteKit request-source matcher gated by `src/routes/**/+server.*`, `+page.server.*`, `+layout.server.*`, and `hooks.server.*`, then register its source identifiers with the shared framework source list and resolver.
- Consequences: Dataflow can now report SvelteKit request body readers, headers, params, URL fields/search params, and cookies flowing into default sinks. Non-route helpers and response builders remain quiet.
- Verification: `npm run test -- tests/core/dataflowFrameworkSvelteKit.test.ts tests/core/dataflowSuiteStructure.test.ts` failed before the matcher was registered, then passed after the additive source module was wired in.

## 2026-06-18: Print complete daily workflow paths in start console

- Status: accepted
- Context: `projscan start` exposed trusted daily workflows near the top of the console, but each workflow only showed its first command. That made the section look like a feature sampler instead of a copyable daily operating path.
- Decision: Render each daily workflow as a workflow name followed by all of its existing commands, while keeping the workflow definitions, JSON report shape, Mission Control routing, and section ordering unchanged.
- Consequences: Engineers can copy a full before-edit, before-handoff, or release-candidate path from the first console screen. Console output grows by a few lines but stays limited to the existing daily workflow commands.
- Verification: `npm run test -- tests/cli/start.test.ts` failed before the console printed all workflow commands, then `npm run build` and `npm run test -- tests/cli/start.test.ts tests/core/start.test.ts` passed after the formatter change.

## 2026-06-18: Keep linear start console output focused

- Status: accepted
- Context: The default `projscan start` console printed inline Handoff Prompt, Review Gate, and Reviewer Replies sections even when Mission Control had a single runnable command and no unresolved inputs. That made routine daily workflows look more bureaucratic than the risk warranted.
- Decision: Print inline handoff/review-gate sections only when the caller explicitly requested a handoff payload or Mission Control has unresolved inputs. Keep JSON, shortcuts, mission bundles, review-gate data, and runbook output unchanged.
- Consequences: Normal start output stays focused on daily workflows, Mission Control, resume checklist, action plan, proof, risks, and next commands. Ambiguous/fuzzy flows still surface inline handoff and review guidance.
- Verification: `npm run test -- tests/cli/start.test.ts` failed before the default console suppressed the heavy sections, then `npm run build` and `npm run test -- tests/cli/start.test.ts tests/cli/startHandoff.test.ts` passed after the rendering guard.

## 2026-06-18: Label healthy p2 start risks as a watch list

- Status: accepted
- Context: Healthy `projscan start` console output still used the `Top Risks` heading for p2-only hotspot evidence. That made routine watch items sound like caution or blocker output.
- Decision: Use `Watch List` in the normal start console when the quality verdict is healthy or excellent and every visible risk is p2. Keep `Top Risks` for p0/p1 items or unhealthy output, and keep risk data unchanged.
- Consequences: Healthy daily workflow output is less alarmist while still showing the same files and follow-up commands. JSON output, workplan output, evidence-pack comments, and risk scoring remain stable.
- Verification: `npm run test -- tests/cli/startConsoleGuidance.test.ts` failed before the heading helper existed, then passed after the helper and parser update.

## 2026-06-18: Split adoption follow-up from first-ten console output

- Status: accepted
- Context: The normal `projscan start` console placed feedback capture and dogfood adoption proof under `First 10 Minutes`. That made first-run onboarding sound broader than the immediate workflow engineers need to trust.
- Decision: Keep the structured `firstTenMinutes` data unchanged, but render `feedback-capture` and `adoption-proof` under a separate `Adoption Follow-Up` console section.
- Consequences: Human console output now keeps the first-ten section focused on trust boundary, orientation, preflight, MCP setup, and first PR evidence. Adoption proof remains visible without implying it belongs in the first ten minutes.
- Verification: `npm run test -- tests/cli/startConsoleGuidance.test.ts` failed before the console split existed, then passed after adoption follow-up rendering.

## 2026-06-18: Align start guide with focused console behavior

- Status: accepted
- Context: `docs/GUIDE.md` still described the normal start console as always printing Handoff Prompt and default review-gate replies, after the console had been narrowed for linear missions.
- Decision: Update the guide to describe the demonstrated behavior: focused linear console sections, Watch List labeling for healthy p2 evidence, and explicit handoff/review shortcuts or unresolved-input flows for detailed policy text.
- Consequences: Guide claims now match the product workflow instead of overstating default console breadth. Structured handoff/review data remains documented through shortcuts, runbooks, JSON, and saved bundles.
- Verification: `npm run test -- tests/docs/startRoutingDocs.test.ts` failed before the new wording existed and passed after the guide correction.
