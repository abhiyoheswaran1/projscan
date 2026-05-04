# Submitting projscan to the MCP Registry

The official MCP Registry lives at [github.com/modelcontextprotocol/registry](https://github.com/modelcontextprotocol/registry). Publishing requires the `mcp-publisher` CLI plus a `server.json` that matches a `mcpName` field in our `package.json`. Both are in this directory + the repo root respectively.

## Prerequisites

1. **`mcp-publisher` CLI installed.**
   ```sh
   git clone https://github.com/modelcontextprotocol/registry.git /tmp/mcp-registry
   cd /tmp/mcp-registry
   make publisher        # produces ./bin/mcp-publisher
   ```
   Or whatever the current install path is — check the registry README at submit time.

2. **GitHub authentication.** The namespace `io.github.abhiyoheswaran1/projscan` requires a GitHub token with `read:user` scope to verify ownership. The publisher CLI will prompt.

3. **`projscan@1.1.0` already published to npm.** The registry entry resolves to the npm tarball; if 1.1.0 isn't on npm yet, publishing will fail validation.

4. **`package.json` has `mcpName: "io.github.abhiyoheswaran1/projscan"`** at the top level. The registry tool will refuse to publish if the names don't match. (This is already in our `package.json` as of 1.1.0.)

## Publish

From the **projscan** repo root (so the publisher can read `package.json` for cross-reference):

```sh
mcp-publisher publish .github/mcp-registry/server.json
```

The CLI will:
1. Verify GitHub authentication for `abhiyoheswaran1`.
2. Verify the `mcpName` in `package.json` matches `name` in `server.json`.
3. Verify the npm package `projscan@1.1.0` is published and accessible.
4. POST the entry to the registry. The server appears immediately on `registry.modelcontextprotocol.io` and within a few hours on aggregators (PulseMCP, mcpmarket.com, etc.).

## Update on every release

The `version` field in `server.json` is hand-edited; it should match `package.json#version` at every release. Add this as step 7 of the release ritual in `CONTRIBUTING.md` once we've published once successfully.

A future minor could automate this — `scripts/sync-mcp-registry.mjs` could read `package.json#version` and write it into `server.json` as part of the build step. Worth doing if registry submission becomes routine.

## What this gets us

- **Discoverability.** Every agent picking a code-intel MCP server starts at the registry. Code Pathfinder is on it; we aren't.
- **Verified namespace.** `io.github.abhiyoheswaran1/*` is reserved to us; nobody can typosquat.
- **Aggregator visibility.** PulseMCP, mcpmarket.com, builder.io's "best MCP servers" lists pull from the registry. Listing is one-time work that compounds.

## Risks

- **Submission may be rejected** for namespace conflicts, schema validation, or quality bar. None expected (we own the GitHub namespace and our schema is conformant), but if rejected, read the error message and iterate.
- **The schema may change.** The pinned schema URL (`2025-12-11`) is dated; future schemas may add required fields. Re-check the registry quickstart before publishing.
- **The publisher CLI may move.** The `make publisher` build step is what the registry README documented in May 2026. If it's changed, follow whatever the current README says.
