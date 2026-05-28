# Team Habit Loop Design

## Goal

Make projscan feel useful on the first team PR and keep it useful on every later PR by automating setup, evidence, ownership routing, baseline memory, MCP verification, and practical plugin examples.

## Design

This is an adoption loop, not a new analysis engine. The existing graph, preflight, workplan, evidence-pack, baseline, ownership, and plugin APIs remain the foundation. New code should compose those APIs into repeatable team workflows.

## Surfaces

1. `projscan init team --team <team>` writes the team policy starter, PR evidence workflow, CODEOWNERS starter, and initial local baseline. It also returns a `projscan start` report so the bootstrap command ends with immediate orientation.
2. `projscan evidence-pack --pr-comment` becomes the hero PR surface: short verdict, baseline trend, top three risks, owner routing, next actions, and verification commands.
3. Baseline memory extends `.projscan-baseline.json` with rule counts and trend summaries so PR comments can say what changed since the saved team baseline.
4. `projscan mcp doctor --client <client>` verifies the expected stdio server command and prints the exact config to paste for supported MCP clients.
5. Workplans and PR comments surface ownership from CODEOWNERS/package metadata when available.
6. Example analyzer plugins cover API route ownership, security-sensitive files, and monorepo boundary policy.
7. Output stays compact: expensive baseline trend work only runs when a baseline file exists, and PR comments cap risk/action lists.

## Acceptance Criteria

- Bootstrap command creates useful team files without overwriting unless `--force` is passed.
- PR comment includes verdict, top risks, owners, baseline trend, next actions, and verification.
- Baseline diff reports score direction, new hotspots, and recurring noisy rules.
- MCP doctor returns actionable config and setup checks for at least Codex, Cursor, and Claude-style clients.
- Workplan tasks include owner routing when ownership metadata matches files.
- New plugins validate with the existing manifest rules.
- Build, lint, focused tests, full suite, self-preflight, and bug-hunt loop pass before commit.
