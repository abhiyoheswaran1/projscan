# Plugin Authoring

projscan 2.0 stabilizes the local analyzer and reporter plugin contract.
Plugin execution is gated by two independent controls:

1. **Opt-in flag** — set `PROJSCAN_PLUGINS_PREVIEW=1` to enable the plugin system at all.
2. **Trust-on-first-use** — even with the flag on, each plugin **module** must be
   explicitly approved with `projscan plugin trust <name>` before projscan will
   execute it. Approval pins the module's SHA-256; if the file later changes, it
   reverts to untrusted and must be re-approved. Untrusted plugins are discovered
   and listed but never run.

This means setting the flag globally (e.g. in your shell profile) can't silently
execute attacker-authored code from a repository you happen to scan — you still
have to approve each module once. The trust store lives in your user config
directory (`$XDG_CONFIG_HOME/projscan` or `~/.config/projscan`,
overridable with `PROJSCAN_PLUGIN_TRUST_HOME`), never inside the scanned repo.

Plugins are local code. Approving one means you trust that code in the repository,
the same way you trust project scripts in `package.json`. projscan does not fetch
remote plugin code.

## Layout

Plugin manifests live under `.projscan-plugins/`:

```text
.projscan-plugins/
  policy.projscan-plugin.json
  policy.mjs
  team-summary.projscan-plugin.json
  team-summary.mjs
```

## Manifest

Analyzer plugins add issues to the normal projscan issue stream:

```json
{
  "schemaVersion": 1,
  "name": "policy",
  "kind": "analyzer",
  "module": "./policy.mjs",
  "category": "custom",
  "description": "Project-specific policy checks"
}
```

Reporter plugins render CLI output for selected commands:

```json
{
  "schemaVersion": 1,
  "name": "team-summary",
  "kind": "reporter",
  "module": "./team-summary.mjs",
  "commands": ["doctor", "analyze", "ci"],
  "description": "Compact team health summary"
}
```

Fields:

- `schemaVersion`: must be `1`.
- `name`: stable plugin identifier. Issue ids are prefixed with `plugin:<name>:`.
- `kind`: `analyzer` or `reporter`.
- `module`: relative path inside the plugin directory. Absolute paths and `..` are rejected.
- `category`: analyzer-only fallback issue category when a plugin issue omits one.
- `commands`: reporter-only list of CLI commands the reporter supports: `doctor`, `analyze`, `ci`.
- `description`: optional summary for humans and agents.

## Schema

The machine-readable manifest schema lives at
[`docs/plugin.schema.json`](plugin.schema.json). The examples under
[`docs/examples/plugins/`](examples/plugins/) are tested in CI.

For packaged examples you can copy into a repo, see the
[Plugin Gallery](PLUGIN-GALLERY.md). It includes policy, graph-context, team health, security,
and release-readiness examples.

## Scaffold

Use `plugin init` to create a minimal local plugin without writing the manifest
by hand:

```sh
projscan plugin init --kind analyzer --name policy
projscan plugin init --kind reporter --name team-summary
projscan plugin init --kind analyzer --name policy --format json
```

The command writes a manifest and `.mjs` module under `.projscan-plugins/`.
It refuses to overwrite existing files.

## Analyzer Module

The module must export a `check(rootPath, files, context?)` function, either as the
default export or a named export. The optional third argument exposes lazy read-only graph helpers for analyzers that need deeper context.

```js
export default {
  check: async (rootPath, files) => {
    return files
      .filter((file) => file.relativePath.endsWith('.ts'))
      .filter((file) => file.relativePath.includes('legacy'))
      .map((file) => ({
        id: 'legacy-typescript-file',
        title: 'Legacy TypeScript file',
        description: `${file.relativePath} is under the legacy tree.`,
        severity: 'warning',
        category: 'custom',
        fixAvailable: false,
        locations: [{ file: file.relativePath, line: 1 }],
      }));
  },
};
```

Required issue fields:

- `id`
- `title`
- `description`
- `severity`: `error`, `warning`, or `info`
- `category`
- `fixAvailable`

Malformed issues are dropped so one bad plugin cannot poison the issue stream.

The analyzer `context` argument currently exposes:

- `getCodeGraph()`: the underlying code graph used by core analysis.
- `getSemanticGraph()`: the stable v3 semantic graph payload.
- `getDataflow()`: the focused dataflow report.

The packaged `graph-context` example under `docs/examples/plugins/` demonstrates the pattern without requiring a manifest schema bump.

## Reporter Module

Reporter plugins are CLI-only. The module must export a
`render(context)` function, either as the default export or a named export.

```js
export default {
  render: async ({ command, payload }) => {
    if (command === 'ci') {
      return `CI ${payload.ci.pass ? 'passed' : 'failed'}: ${payload.ci.score}/100`;
    }

    const issues = payload.issues ?? [];
    const score = payload.health?.score ?? 'analysis';
    return `${command}: ${issues.length} issue(s), score ${score}`;
  },
};
```

`context` contains:

- `command`: `doctor`, `analyze`, or `ci`.
- `rootPath`: absolute project root.
- `manifest`: the validated reporter manifest.
- `payload`: the command payload.

Payloads:

- `doctor`: `{ health, issues }`
- `analyze`: the same `AnalysisReport` shape returned by `--format json`
- `ci`: `{ ci: { score, grade, pass, threshold, totalIssues, errors, warnings, info, issues } }`

Renderers must return a string. They should not write directly to stdout or
stderr; projscan writes the returned text after the renderer succeeds.

## Custom Presentation

Reporter plugins are the customization boundary for team-specific presentation.
Use them for white-label reports, team-branded summaries, and output shaped for
local workflows. The built-in HTML reporter stays the default core renderer
instead of growing project-specific theming flags.

## Validate

```sh
projscan plugin validate .projscan-plugins/policy.projscan-plugin.json
projscan plugin validate .projscan-plugins/policy.projscan-plugin.json --format json
```

Validation reports structured diagnostics with a stable `code`, the manifest
`field` when applicable, a `message`, and sometimes a `hint`.

## Test

Use `plugin test` after editing a plugin:

```sh
projscan plugin test .projscan-plugins/policy.projscan-plugin.json
projscan plugin test .projscan-plugins/policy.projscan-plugin.json --format json
PROJSCAN_PLUGINS_PREVIEW=1 projscan plugin test .projscan-plugins/policy.projscan-plugin.json --execute
PROJSCAN_PLUGINS_PREVIEW=1 projscan plugin test .projscan-plugins/policy.projscan-plugin.json --execute --fixture ./test-fixture
```

By default, `plugin test` validates the manifest, checks that the module file is readable, and reports guidance without importing or running plugin code. Add `--execute` only when you intentionally want to run local plugin code, and set `PROJSCAN_PLUGINS_PREVIEW=1` in the process environment.

In execute mode, analyzer plugins scan the fixture root, run `check(rootPath, files)`, and verify every returned issue has the required shape. Reporter plugins render sample `doctor`, `analyze`, and `ci` payloads for the commands listed in the manifest and verify each render returns a string.

The JSON result also includes three guidance blocks:

- `trust`: reminds callers that local plugins execute repository code, stay local-only, and require `PROJSCAN_PLUGINS_PREVIEW=1` before execution.
- `commands`: gives copyable `validate`, static `test`, preview-enabled `execute`, and `enable` commands for the same manifest.
- `context`: reports whether the plugin requested graph/dataflow context and lists detected capabilities such as `semanticGraph` and `dataflow`.

Graph-aware analyzers should keep context access lazy. Only call `context.getSemanticGraph()` or `context.getDataflow()` when the plugin needs that evidence for its issues.

## List

```sh
projscan plugin list
projscan plugin list --format json
```

The list command discovers manifests whether or not execution is enabled. It
shows `enabled:false` until the opt-in flag is set, and a per-plugin `trust`
status (`trusted` / `untrusted` / `changed`) so you can see what would actually run.

## Trust

Approve a plugin's current module bytes before it can execute:

```sh
projscan plugin trust policy        # approve one plugin by name
projscan plugin trust --all         # approve every valid discovered plugin
projscan plugin untrust policy      # revoke approval
```

Trust is intentionally a human CLI action — it is not exposed over the MCP server,
so an agent can't approve a plugin on your behalf.

## Enable

Enabling requires both the opt-in flag and a trusted module:

```sh
projscan plugin trust --all
PROJSCAN_PLUGINS_PREVIEW=1 projscan doctor
PROJSCAN_PLUGINS_PREVIEW=1 projscan ci
PROJSCAN_PLUGINS_PREVIEW=1 projscan analyze
PROJSCAN_PLUGINS_PREVIEW=1 projscan doctor --reporter team-summary
PROJSCAN_PLUGINS_PREVIEW=1 projscan analyze --reporter team-summary
PROJSCAN_PLUGINS_PREVIEW=1 projscan ci --reporter team-summary
```

When enabled, analyzer plugin issues are merged into the same issue stream as
built-in analyzer issues. That means they affect health scores and CI gates in
the same way.

Reporter plugins are selected with `--reporter <name>` on supported commands.
Do not combine `--reporter` with `--format json`, `markdown`, `sarif`, or
`html`; reporter output is its own stdout text.

## MCP

The `projscan_plugin` MCP tool supports:

- `action: "list"`
- `action: "validate"` with `manifest_path`

Plugin execution for MCP `projscan_doctor` and `projscan_analyze` follows the
same `PROJSCAN_PLUGINS_PREVIEW` flag as the CLI.

Reporter rendering is CLI-only. MCP tools continue to return structured
payloads.

## Failure Isolation

- One plugin failing to load does not stop other plugins.
- One plugin throwing during `check` does not stop built-in analyzers.
- Malformed issues are dropped.
- One reporter failing to load or render exits that CLI command with a
  diagnostic instead of falling back to a misleading built-in report.
- Runtime plugin warnings go to stderr so JSON stdout stays parseable.

## Compatibility

This is the stable 2.0 plugin contract for local analyzer and reporter plugins.
New optional manifest fields may be added in 2.x; existing required fields keep
their names and types.
