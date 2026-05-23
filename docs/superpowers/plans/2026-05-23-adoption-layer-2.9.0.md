# Adoption Layer 2.9.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship projscan 2.9.0 as an adoption-focused release that makes the 2.8.0 agent surfaces easier to configure, learn, and trust.

**Architecture:** Add a small adoption core module that owns MCP client snippets, workflow recipes, and first-run diagnostics. Wire that module into thin CLI commands plus one MCP tool so humans and agents share the same guidance. Keep 3.0.0 graph-contract work out of this release.

**Tech Stack:** TypeScript, Commander CLI, existing MCP tool registry, Vitest, existing docs/examples plugin packaging.

---

### Task 1: Adoption Core And CLI

**Files:**
- Create: `src/core/adoption.ts`
- Create: `src/cli/commands/recipes.ts`
- Modify: `src/cli/commands/init.ts`
- Modify: `src/cli/index.ts`
- Modify: `src/utils/formatSupport.ts`
- Test: `tests/cli/adoption.test.ts`

- [ ] Write failing CLI tests for `projscan init mcp`, `projscan recipes`, and `projscan first-run`.
- [ ] Implement MCP config snippets for Claude Desktop, Claude Code, Cursor, Codex, Continue, Windsurf, Cline, Zed, and Gemini.
- [ ] Implement workflow recipes for before edit, bug hunt, release approval, handoff, and pre-merge.
- [ ] Implement first-run diagnostics for Node version, package metadata, git state, config, plugin manifests, and expected MCP startup command.
- [ ] Register CLI commands and command-format support.
- [ ] Run `npm test -- tests/cli/adoption.test.ts`.

### Task 2: MCP Adoption Tool

**Files:**
- Create: `src/mcp/tools/adoption.ts`
- Modify: `src/mcp/tools.ts`
- Modify: `docs/STABILITY.md`
- Test: `tests/mcp/adoption.test.ts`

- [ ] Write failing MCP tests for `projscan_adoption`.
- [ ] Implement `action: "mcp_config" | "recipes" | "first_run"`.
- [ ] Preserve structured JSON-compatible payloads and cost sidecars.
- [ ] Run `npm test -- tests/mcp/adoption.test.ts tests/mcp/server.test.ts`.

### Task 3: Plugin Gallery And Docs

**Files:**
- Create: `docs/PLUGIN-GALLERY.md`
- Create: `docs/examples/plugins/security-radar.projscan-plugin.json`
- Create: `docs/examples/plugins/security-radar.mjs`
- Create: `docs/examples/plugins/release-readiness.projscan-plugin.json`
- Create: `docs/examples/plugins/release-readiness.mjs`
- Modify: `docs/PLUGIN-AUTHORING.md`
- Modify: `README.md`
- Test: `tests/integration/packSmokeTest.test.ts`

- [ ] Add security analyzer and release reporter examples.
- [ ] Link the gallery from README and plugin authoring docs.
- [ ] Update package smoke expectations for the new example files.

### Task 4: Console Polish

**Files:**
- Modify: `src/reporters/consoleReporter.ts`
- Modify: `src/cli/commands/preflight.ts`
- Test: `tests/cli/preflight.test.ts`

- [ ] Add human-readable doctor next steps without changing JSON/SARIF/HTML/Markdown reporters.
- [ ] Add preflight required-check output and short next-step copy for console mode only.
- [ ] Run focused CLI tests.

### Task 5: Release 2.9.0

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/mcp-registry/server.json`
- Modify: `CHANGELOG.md`
- Modify: `docs/WEBSITE-UPDATE-PROMPT.md`
- Modify: `docs/ROADMAP.md`
- Test: release gate scripts

- [ ] Bump version to `2.9.0`.
- [ ] Add changelog entries for adoption-layer features only.
- [ ] Update registry description/tool count after build manifest generation.
- [ ] Run `npm run build`, focused tests, `npm run release:check`.
- [ ] Commit, tag `v2.9.0`, push, approve release workflow if needed, and verify npm, GitHub Release, and MCP Registry.
