# Plugin Gallery

These examples are packaged with projscan under `docs/examples/plugins/`. Copy
the manifest and module into `.projscan-plugins/`, then run:

```bash
projscan plugin validate .projscan-plugins/<name>.projscan-plugin.json
projscan plugin test .projscan-plugins/<name>.projscan-plugin.json
PROJSCAN_PLUGINS_PREVIEW=1 projscan doctor
```

Local plugins are code execution. Only enable plugins you trust. `projscan plugin test --format json` returns `trust`, `commands`, and `context` guidance so agents can validate a plugin, see the preview flag, and detect graph/dataflow context needs before execution.

## Analyzer Plugins

### `policy`

Flags TypeScript files under a `legacy` path so teams can keep local migration
rules close to the repo.

Files:
- `docs/examples/plugins/policy.projscan-plugin.json`
- `docs/examples/plugins/policy.mjs`

### `security-radar`

Flags common local security review triggers:
- committed `.env` style files
- package scripts that pipe `curl` or `wget` output into a shell

Files:
- `docs/examples/plugins/security-radar.projscan-plugin.json`
- `docs/examples/plugins/security-radar.mjs`

### `graph-context`

Demonstrates analyzer access to the optional graph/dataflow context. It reads the semantic graph and dataflow report through `context.getSemanticGraph()` and `context.getDataflow()` and emits a compact architecture summary issue. The test result marks `context.requested: true` and lists `semanticGraph` plus `dataflow` capabilities.

Files:
- `docs/examples/plugins/graph-context.projscan-plugin.json`
- `docs/examples/plugins/graph-context.mjs`


### `api-route-ownership`

Flags API route files that are not covered by CODEOWNERS-style routing, so PRs that change externally visible routes get a clear team owner.

Files:
- `docs/examples/plugins/api-route-ownership.projscan-plugin.json`
- `docs/examples/plugins/api-route-ownership.mjs`

### `security-sensitive-files`

Highlights auth, crypto, secrets, payment, middleware, and environment-related paths for explicit security-conscious review.

Files:
- `docs/examples/plugins/security-sensitive-files.projscan-plugin.json`
- `docs/examples/plugins/security-sensitive-files.mjs`

### `monorepo-boundary`

Flags package source files that reach across monorepo boundaries with deep relative imports instead of package entrypoints or declared workspace dependencies.

Files:
- `docs/examples/plugins/monorepo-boundary.projscan-plugin.json`
- `docs/examples/plugins/monorepo-boundary.mjs`

## Reporter Plugins

### `team-radar`

Renders `doctor`, `analyze`, and `ci` output in a compact team health voice.

Files:
- `docs/examples/plugins/team-radar.projscan-plugin.json`
- `docs/examples/plugins/team-radar.mjs`

### `release-readiness`

Renders `doctor`, `analyze`, and `ci` output as a release approval summary with
score, blocking issue count, warnings, and a continue/hold decision.

Files:
- `docs/examples/plugins/release-readiness.projscan-plugin.json`
- `docs/examples/plugins/release-readiness.mjs`

## Suggested Adoption Path

1. Start with `projscan init mcp --client all` to wire projscan into your MCP
   client.
2. Run `projscan recipes` to pick an agent workflow.
3. Copy one gallery plugin into `.projscan-plugins/` only when you need local
   policy or team-specific reporting.
4. Keep MCP tools structured; use reporter plugins for human presentation.
