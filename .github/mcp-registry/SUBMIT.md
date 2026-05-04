# MCP Registry — projscan

projscan is published to the official MCP Registry at [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io) under the namespace **`io.github.abhiyoheswaran1/projscan`**. First publish: 2026-05-04, version `1.1.0`. Latest publish: 2026-05-04, version `1.1.1`.

This file documents how to **republish on every new release** so the registry stays in sync with npm. For the first-time submission story, see this file's git history (we keep the history in the repo for reference).

## On every release — keep registry in sync with npm

After `npm publish` succeeds for a new version, do this **before** marking the release ritual complete:

### 1. Bump both version fields in `server.json`

There are two of them (top-level + inside `packages[0]`). Both must match `package.json#version`:

```jsonc
{
  "version": "X.Y.Z",            // ← bump this
  "packages": [
    {
      "version": "X.Y.Z",         // ← and this
      ...
    }
  ]
}
```

### 2. Validate against the schema

```sh
/tmp/mcp-publisher validate .github/mcp-registry/server.json
```

Should print `✅ server.json is valid`. If you get a 422, the schema may have changed — check [registry.modelcontextprotocol.io/docs](https://registry.modelcontextprotocol.io/docs) and adjust.

### 3. Publish

```sh
/tmp/mcp-publisher publish .github/mcp-registry/server.json
```

Expected:

```
Publishing to https://registry.modelcontextprotocol.io...
✓ Successfully published
✓ Server io.github.abhiyoheswaran1/projscan version X.Y.Z
```

The registry stores all published versions; this doesn't replace the prior entries, it adds. Aggregators (PulseMCP, mcpmarket.com, etc.) see the new "latest" pointer within hours.

### 4. Commit the bumped server.json

Don't forget — local `.github/mcp-registry/server.json` should match what's actually on the registry. Otherwise future-you won't trust the file.

## If `mcp-publisher` is missing

The publisher CLI lives at `/tmp/mcp-publisher` if a previous session put it there. If not, grab a pre-built binary (Go toolchain not required):

```sh
# macOS arm64 — adjust for your platform
cd /tmp
curl -sL https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_darwin_arm64.tar.gz \
  | tar -xz
./mcp-publisher --version
```

Other platforms: see [github.com/modelcontextprotocol/registry/releases](https://github.com/modelcontextprotocol/registry/releases).

## If auth has expired

```sh
/tmp/mcp-publisher login github
```

Opens a browser for GitHub OAuth. Sign in as **`abhiyoheswaran1`** (the namespace owner). Re-auth lasts long enough that you'll only do this rarely.

## Why we republish on every minor (and every patch when convenient)

- **The registry's `version` field is metadata, not a directive.** npm semver still wins for actual installs.
- **But** consumers reading the registry directly (or via aggregators that show the registry's metadata) see whatever's there. Stale = misleading.
- The republish takes ~10 seconds. Cheap insurance for "registry shows what we actually ship."

## What was earned, one-time

- **Verified namespace.** `io.github.abhiyoheswaran1/*` is locked to our GitHub identity; nobody can typosquat.
- **Aggregator visibility.** PulseMCP, mcpmarket.com, builder.io best-MCP-servers lists pull from the registry. Listing is one-time work that compounds.
- **`package.json#mcpName`** field added in 1.1.0 to satisfy the registry's name-matching rule. Stays there forever.
