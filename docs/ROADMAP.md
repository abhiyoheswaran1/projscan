# ProjScan Roadmap

Planned features and improvements. Community suggestions welcome — open an issue or PR.

---

## Planned

### Dependency Impact Analysis
Analyze the impact of upgrading specific packages — detect breaking changes, semver jumps, and changelog summaries before you update.

*Source: community feedback*

### Unused Dependency & Dead Code Detection
Flag declared dependencies that aren't imported, and exports that nothing consumes.

### Coverage × Hotspots Join
Combine hotspot risk with test coverage data (LCOV/coverage-final.json) to surface "scariest untested files."

---

## Under Consideration

- **Monorepo support** — scan multiple packages in a single workspace
- **HTML report export** — generate a standalone HTML health report
- **Watch mode** — re-scan on file changes
- **Plugin API** — third-party analyzers and reporters

---

## Recently Shipped

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
