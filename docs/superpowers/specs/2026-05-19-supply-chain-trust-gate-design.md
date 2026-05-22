# Supply-Chain Trust Gate Design

## Goal

Make projscan safer to publish and safer for agents to use by adding a local supply-chain trust gate that blocks known malicious package indicators and risky dependency/persistence patterns before release or agent continuation.

## Scope

This design covers two tracks:

- Repository release hardening: add a release-gate script, run it in CI and release, keep `npm audit` blocking, verify registry signatures, and attach an SBOM to GitHub Releases.
- Product hardening: add a built-in analyzer that emits normal projscan issues for supply-chain risks, and surface those issues inside `projscan preflight` as blocking evidence.

This design does not automate npm Trusted Publishing setup or GitHub tag/environment protection. Those require package/repository owner settings outside this codebase. The repository will be prepared for OIDC/provenance and document the required owner actions.

## Detection Rules

The first version is intentionally deterministic and offline:

- Block known Mini Shai-Hulud/TanStack package/version IOCs from `package-lock.json` and package manifests.
- Block `router_init.js`, `gh-token-monitor`, `git-tanstack.com`, and the known payload hash when they appear in scanned files.
- Warn on dependencies, devDependencies, or optionalDependencies that point directly at GitHub or git commits.
- Warn on unexpected install lifecycle scripts: `preinstall`, `install`, `postinstall`, `prepare`, `prepublish`, and `prepublishOnly`.
- Block hidden persistence hooks in `.claude/settings.json`, `.vscode/tasks.json`, and `.vscode/settings.json` when they contain shell-like destructive or token-monitoring commands.
- Warn on large JavaScript payloads with obfuscation markers such as base64 eval, `Function(...)`, or dense minified one-line files.

## Architecture

Add `src/analyzers/supplyChainCheck.ts` as a normal doctor analyzer. It reads repository manifests, lockfiles, and selected hidden hook files from the already-scanned file list. The analyzer emits `Issue` objects with category `supply-chain`, stable issue ids, file locations, and direct remediation text.

`src/core/preflight.ts` will treat `category === "supply-chain"` as a first-class preflight source. Any supply-chain error blocks the verdict in all modes. Warnings produce caution. Evidence includes counts by severity so agents can decide whether to inspect `projscan doctor --format json` or run the release gate.

Add `scripts/release-gate.mjs` as a build-artifact consumer. It runs after `npm run build`, imports the built analyzer, scans the repository, runs `npm audit --audit-level=moderate`, and runs `npm audit signatures`. CI and release workflows call `npm run security:release-gate`. Release also generates a CycloneDX SBOM and uploads it with `dist/tool-manifest.json`.

## External Owner Actions

The package owner should configure npm Trusted Publishing for `projscan` against the GitHub Actions release workflow, then remove the long-lived `NPM_TOKEN` from the release job once verified. GitHub repository admins should protect `v*` tags and put the release job behind a protected environment if the repository supports it.

## Testing

Tests cover the analyzer rules directly through `computePreflight` fixtures and cover release workflow wiring through static workflow tests. Verification must include focused preflight/release workflow tests, `npm run build`, `npm test`, `npm run lint`, `npm audit --audit-level=moderate`, and the new release gate.
