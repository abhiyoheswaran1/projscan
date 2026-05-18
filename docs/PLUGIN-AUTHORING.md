# Plugin Authoring

projscan 2.0 stabilizes the local analyzer and reporter plugin contract.
Plugin execution is opt-in via `PROJSCAN_PLUGINS_PREVIEW=1` so repositories
must explicitly trust local plugin code before it runs.

Plugins are local code. Enabling the opt-in flag means you trust the plugin code in
the repository, the same way you trust project scripts in `package.json`.
projscan does not fetch remote plugin code.

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

The module must export a `check(rootPath, files)` function, either as the
default export or a named export.

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
projscan plugin test .projscan-plugins/policy.projscan-plugin.json --fixture ./test-fixture
```

For analyzer plugins, the test runner loads the module, scans the fixture root,
runs `check(rootPath, files)`, and verifies every returned issue has the required
shape. For reporter plugins, it renders sample `doctor`, `analyze`, and `ci`
payloads for the commands listed in the manifest and verifies each render returns
a string.

## List

```sh
projscan plugin list
projscan plugin list --format json
```

The list command discovers manifests whether or not execution is enabled. It
shows `enabled:false` until the opt-in flag is set.

## Enable

```sh
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
