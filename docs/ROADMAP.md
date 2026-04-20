# ProjScan Roadmap

Planned features and improvements. Community suggestions welcome — open an issue or PR.

---

## Planned

### Dependency Impact Analysis
Analyze the impact of upgrading specific packages — detect breaking changes, semver jumps, and changelog summaries before you update.

*Source: community feedback*

---

## Under Consideration

- **Monorepo support** — scan multiple packages in a single workspace
- **Custom rule config** — allow `.projscanrc` for per-project thresholds and rule overrides
- **HTML report export** — generate a standalone HTML health report
- **Watch mode** — re-scan on file changes

---

## Recently Shipped

### v0.2.x (in progress)
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
