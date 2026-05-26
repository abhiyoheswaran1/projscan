# Graph Operations Platform 3.0.1 Design

## Goal

Ship the post-3.0 roadmap as one coherent 3.0.1 release: make the v3 semantic graph operational across review, workplans, cross-repo impact, plugins, and regression quality checks, while fixing the current review-time dataflow false positives before adding new consumers.

## Scope

This design rolls five roadmap lines into one release:

- 3.1 graph-backed consumers: review summaries, workplans, and agent briefs should cite semantic graph/dataflow evidence instead of only file-level health and hotspot data.
- 3.2 cross-repo impact: impact reports should explain package and ownership boundaries for sibling repositories where graph data is available.
- 3.3 plugin graph reads: analyzer plugins should be able to inspect read-only graph/dataflow context without forcing a plugin manifest v2 break.
- 3.4 golden regression corpus: language fixtures should produce deterministic semantic-graph and dataflow quality snapshots across bundled adapters.
- 3.5 hardening and bug hunt: reduce false-positive bridge risks, keep the review gate actionable, and refresh release docs/metadata.

Out of scope: cloud indexing, a general SAST engine, IDE extensions, or embedding LLM calls inside projscan.

## Design

### Dataflow Hardening

The current bridge detector resolves callees by bare name across the whole graph. That makes generic helpers such as `parse`, `safeParse`, and `exec` collide across unrelated files and can produce impossible paths. The fix is to prefer file-local call targets and only fall back to global bare-name matching when the name is not generic and the target is unambiguous enough. Review should only block on high-confidence bridge risks or medium-confidence risks whose source/bridge/sink path is structurally local to changed production files.

The dataflow report remains deterministic and offline. Existing `DataflowRisk` fields stay compatible; optional evidence fields can be added without breaking consumers.

### Graph-Backed Consumers

Review, workplan, and agent brief outputs gain compact graph evidence:

- Review summarizes semantic graph deltas and includes focused evidence for new dataflow risks.
- Workplans add graph/dataflow tasks when a preflight or review gate mentions review/dataflow risk.
- Agent briefs include graph context for the selected intent: changed public symbols, top packages, and dataflow-risk count.

The public payloads stay budget-aware: compact counts and top evidence first, full graph remains available through `projscan_semantic_graph`.

### Cross-Repo Boundaries

`computeImpact` already accepts sibling repo graphs. Extend its result with boundary summaries: repository totals, package import edges that mention the target, and optional ownership labels inferred from package/workspace names. File-mode cross-repo impact remains conservative unless a package import makes the boundary explicit.

### Plugin Read Context

Analyzer plugins keep the existing manifest schema. Their `check(rootPath, files)` call can receive an optional third context argument containing lazily built, read-only graph helpers:

```ts
{
  schemaVersion: 1,
  getCodeGraph(): Promise<CodeGraph>,
  getSemanticGraph(): Promise<SemanticGraphReport>,
  getDataflow(): Promise<DataflowReport>
}
```

Old plugins ignore the third argument. New plugins can use it without a manifest migration.

### Golden Corpus

Add a small corpus harness that scans the existing language fixtures and records quality metrics rather than brittle full snapshots: files, functions, packages, symbols, call edges, import edges, and dataflow risk counts. This catches adapter regressions while keeping tests stable across harmless ordering changes.

## Error Handling

- Graph/dataflow context failures in plugins become plugin diagnostics, not process crashes.
- Cross-repo impact marks unavailable boundary evidence instead of failing the base impact report.
- Golden corpus failures should identify the fixture and metric that regressed.
- Review keeps test-file filtering and avoids blocking on low-confidence or broad-file-IO dataflow.

## Testing

Use TDD for each slice:

- Regression test for the current `parse`/`safeParse` false-positive bridge path.
- Unit tests for dataflow target resolution and review confidence filtering.
- Unit and CLI/MCP tests for graph evidence in workplan and agent brief payloads.
- Impact tests for cross-repo package/ownership boundary summaries.
- Plugin tests proving the optional graph context is available and backward-compatible.
- Golden corpus tests across bundled fixtures.

Final verification: focused tests, `npm test`, `npm run lint`, `npm run build`, `npm run check:stability`, `npm run release:check`, `node ./dist/cli/index.js preflight --mode before_merge --format json`, and `node ./dist/cli/index.js review --format json`.

## Self-Review

- No placeholders remain.
- The design is scoped to the post-3.0 roadmap and does not duplicate already shipped 3.0 work.
- Public compatibility is preserved by adding optional fields and optional plugin context.
- The current review blocker is explicitly first so new consumers do not amplify noisy dataflow.
