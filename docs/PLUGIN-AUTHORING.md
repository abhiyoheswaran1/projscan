# Plugin Authoring

projscan 1.10 introduced the analyzer plugin preview; 1.11 extends it with
reporter plugins for CLI output. The preview is gated by
`PROJSCAN_PLUGINS_PREVIEW=1` while the 2.0 contract is being finalized.

Plugins are local code. Enabling the preview means you trust the plugin code in
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

Reporter plugins are CLI-only in the preview. The module must export a
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

## Validate

```sh
projscan plugin validate .projscan-plugins/policy.projscan-plugin.json
projscan plugin validate .projscan-plugins/policy.projscan-plugin.json --format json
```

Validation reports structured diagnostics with a stable `code`, the manifest
`field` when applicable, a `message`, and sometimes a `hint`.

## List

```sh
projscan plugin list
projscan plugin list --format json
```

The list command discovers manifests whether or not execution is enabled. It
shows `enabled:false` until the preview flag is set.

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

Reporter rendering is CLI-only in this preview. MCP tools continue to return
structured payloads.

## Failure Isolation

- One plugin failing to load does not stop other plugins.
- One plugin throwing during `check` does not stop built-in analyzers.
- Malformed issues are dropped.
- One reporter failing to load or render exits that CLI command with a
  diagnostic instead of falling back to a misleading built-in report.
- Runtime plugin warnings go to stderr so JSON stdout stays parseable.

## Compatibility

This is a preview for the 2.0 plugin contract. The current shape is the intended
direction, but plugin authors should expect final polish before 2.0 removes the
preview label.
