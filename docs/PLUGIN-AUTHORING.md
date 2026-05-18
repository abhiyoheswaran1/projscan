# Plugin Authoring

projscan 1.10 introduced an analyzer plugin preview. The preview is gated by
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
```

## Manifest

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

Fields:

- `schemaVersion`: must be `1`.
- `name`: stable plugin identifier. Issue ids are prefixed with `plugin:<name>:`.
- `kind`: currently only `analyzer`.
- `module`: relative path inside the plugin directory. Absolute paths and `..` are rejected.
- `category`: fallback issue category when a plugin issue omits one.
- `description`: optional summary for humans and agents.

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
```

When enabled, analyzer plugin issues are merged into the same issue stream as
built-in analyzer issues. That means they affect health scores and CI gates in
the same way.

## MCP

The `projscan_plugin` MCP tool supports:

- `action: "list"`
- `action: "validate"` with `manifest_path`

Plugin execution for MCP `projscan_doctor` and `projscan_analyze` follows the
same `PROJSCAN_PLUGINS_PREVIEW` flag as the CLI.

## Failure Isolation

- One plugin failing to load does not stop other plugins.
- One plugin throwing during `check` does not stop built-in analyzers.
- Malformed issues are dropped.
- Runtime plugin warnings go to stderr so JSON stdout stays parseable.

## Compatibility

This is a preview for the 2.0 plugin contract. The current shape is the intended
direction, but plugin authors should expect final polish before 2.0 removes the
preview label.
