# ProjScan Roadmap

Planned features and improvements. Community suggestions welcome — open an issue or PR.

---

## Planned

### Coverage × Hotspots Join (0.5.0)
Combine hotspot risk with test coverage data (LCOV/coverage-final.json) to surface "scariest untested files."

### Dead Code / Unused Exports (0.5.0)
Flag exports that nothing consumes, across the full import graph. Complements the unused-dependency detection shipped in 0.4.0.

### Registry-aware Upgrade Preview
Today's `projscan upgrade` is offline (local CHANGELOG + installed version). A future iteration will optionally fetch `latest` from the npm registry and diff against what's currently installed.

---

## Under Consideration

- **Monorepo support** — scan multiple packages in a single workspace
- **HTML report export** — generate a standalone HTML health report
- **Watch mode** — re-scan on file changes
- **Plugin API** — third-party analyzers and reporters
- **Real cyclomatic complexity** — AST-based, replacing the LOC proxy

---

## Recently Shipped

### v0.4.x
- **Dependency Health** theme
  - `projscan outdated` — offline declared-vs-installed drift check
  - `projscan audit` — wraps `npm audit --json`; SARIF-ready; joins findings to `package.json`
  - `projscan upgrade <pkg>` — offline upgrade preview: semver drift, local CHANGELOG breaking-change markers, importer list
  - Unused-dependency analyzer — anchored to exact line in `package.json` for GitHub Code Scanning PR annotations
  - `dep-risk-*` issues gain `package.json` locations

### v0.3.x
- **SARIF output** (`--format sarif`) — feeds GitHub Code Scanning directly; file/line locations on security findings
- **`--changed-only` mode** — scope `analyze` / `doctor` / `ci` to files changed vs a base ref (PR-diff semantics)
- **`.projscanrc` config** — thresholds, rule disables, severity overrides, ignore globs; supports `.projscanrc.json`, `.projscanrc`, or `package.json#projscan`
- **GitHub Action** (`action.yml`) — one-step install → run → upload SARIF to Code Scanning

### v0.2.x
- **Hotspot analysis** (`projscan hotspots`) — git churn × complexity × issue density to rank the files most worth fixing first
- **MCP server** (`projscan mcp`) — exposes projscan as a Model Context Protocol server so AI coding agents (Claude Code, Cursor, Windsurf) can ground their work in project health

### v0.1.x
- Health score and letter grades (A–F)
- Security scanner (secrets, .env files, private keys)
- CI health gate (`projscan ci`)
- Baseline tracking (`projscan diff`)
- Auto-fix system (ESLint, Prettier, Vitest, EditorConfig)
- Architecture diagrams
- File explanation engine
- Health badge generation
