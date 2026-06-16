## projscan approval evidence

**Verdict:** caution
**Version:** 3.0.5
**Summary:** caution: 3.0.5 evidence is assembled but still needs explicit review

### Verdict

- Manual review: Scale or complexity needs human sign-off; no concrete taint/dataflow/health/plugin/supply-chain blocker was found.
- blockers: none recorded

### Trust Calibration

- 5 manual review/watch signal(s); no actual defect blocker was found.
- actual defects: none
- manual review: Large platform release risk: 65 changed files exceeds the preflight threshold of 50; review signal: Maximum changed-file risk score is 207.5 (>= 80).; 4 function(s) flagged: high CC added or jumped. Review blocks on scale/complexity rather than new taint, dataflow, health, plugin, or supply-chain defects. Treat this as a manual release sign-off gate.; 65 changed files exceeds the preflight threshold of 50; Review verdict is block due to scale/complexity risk: Maximum changed-file risk score is 207.5 (>= 80).; 4 function(s) flagged: high CC added or jumped.; Touched file overlaps high-risk hotspot src/types.ts (risk 330.2); Touched file overlaps high-risk hotspot tests/core/review.test.ts (risk 225.7)
- watch signals: none

### Baseline Trend

- No local baseline found. Run `projscan diff --save-baseline` after the first clean review.

### Top Risks

- **p1** 65 changed files exceeds the preflight threshold of 50 owner: unassigned run: `projscan review --format json`
- **p1** docs/examples/plugins/security-sensitive-files.mjs and docs/examples/pr-comments/before-after.md are in the same package or top-level area owner: unassigned files: docs/examples/plugins/security-sensitive-files.mjs run: `projscan preflight --format json`
- **p1** Large platform release risk: 65 changed files exceeds the preflight threshold of 50; review signal: Maximum changed-file risk score is 207.5 (>= 80).; 4 function(s) flagged: high CC added or jumped. Review blocks on scale/complexity rather than new taint, dataflow, health, plugin, or supply-chain defects. Treat this as a manual release sign-off gate. owner: unassigned run: `projscan review --format json`

### First Fix

- **p1** 65 changed files exceeds the preflight threshold of 50
- why first: First because this is the highest-priority review signal from PR evidence: 65 changed files exceeds the preflight threshold of 50
- run: `projscan review --format json`

### Team Routing

- No owner hints found. Add .github/CODEOWNERS line: `docs/** @team-name`
- Replace `@team-name` with the owning team before merging.

### Verification

- `projscan release-train --format json`
- `projscan bug-hunt --format json`
- `projscan workplan --mode release --format json`
- `projscan handoff --mode release`
- `projscan preflight --mode before_merge --format json`

### Next Commands

- `projscan preflight --mode before_merge --format json`
- `npm test`
- `projscan review --base main --head HEAD --format json`
- `projscan review --format json`
- `projscan hotspots --format json`
- `npm run release:check`

### Suggested Next Actions

- Prove product readiness: `npm test`
- Expand graph intelligence precision: `projscan review --base main --head HEAD --format json`
- Plan 3.2.x quality work: `npm test`
- Plan 3.3.x quality work: `npm test`
- Plan 3.4.x quality work: `npm test`

### Developer Feedback

- Was this useful on this PR? Ask the reviewer whether the comment saved 10-20 minutes.
- What was missing or noisy? Capture one missing signal, one noisy rule, or `none` before merge.
- Keep using it every PR: `projscan evidence-pack --pr-comment` and `projscan dogfood --repo <path-to-repo> --format json`.

Approval guidance: Review cautions, then approve only after the regression plan passes.
