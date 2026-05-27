# Agent Review Precision Design

## Goal

Build the next bundled patch train after 3.0.2 without releasing it yet. The bundle should make projscan more useful to agents working in monorepos and framework apps while reducing release/process friction.

## Scope

This branch targets six patch-level increments that should ship together as a future 3.0.3:

1. Package-scoped review filtering runs before verdict calculation, not as a late partial trim.
2. Review package scoping applies to taint flows, dataflow risks, contract changes, graph evidence, changed files, risky functions, cycles, dependency summaries, and verdict text.
3. Dataflow recognizes framework request body readers in Next-style route files, starting with `request.json()`, `request.formData()`, `request.text()`, and `request.arrayBuffer()`.
4. Default dataflow risks touching generated/codegen paths are suppressed unless callers opt in with `includeGenerated` / `include_generated` / `--include-generated`; custom sources and sinks still surface.
5. Ownership lookup falls back to workspace package metadata (`projscan.owner`, `projscan.owners`, `owner`, or `owners`) when CODEOWNERS does not match.
6. CI and release workflows move to `actions/checkout@v5` and `actions/setup-node@v5` after verifying both tags exist upstream.

## Non-goals

- No npm publish, GitHub Release, MCP Registry publish, or version tag in this branch.
- No schema-breaking changes to review, impact, or dataflow payloads.
- No large review/dataflow refactor beyond extracting shared path/source helpers.

## Architecture

Package scoping belongs in `computeReview` so all consumers get the same verdict. CLI and MCP review handlers should pass the package name into core and stop duplicating partial post-processing.

Framework source detection remains conservative: it only promotes request body methods to taint sources inside route-handler files and HTTP method exports. Generic `.json()` calls outside route files remain ignored.

Generated-code filtering is a default-noise control, not a hard exclusion. Custom sources or sinks bypass that suppression, matching the custom-rule visibility rule from 3.0.2.

Ownership stays a lookup function. Package-owner metadata becomes a fallback layer below CODEOWNERS, so explicit CODEOWNERS rules keep priority.

## Verification

Focused tests should prove red-green coverage for package scoping, route request sources, generated-code filtering, and package owner fallback. Broad verification should include build, lint, graph corpus, stability, and the relevant core test files before PR creation.
