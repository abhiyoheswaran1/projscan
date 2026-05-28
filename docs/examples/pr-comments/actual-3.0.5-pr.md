## projscan approval evidence

**Verdict:** caution
**Version:** 3.0.5
**Summary:** caution: 3.0.5 evidence is assembled but still needs explicit review

### Verdict
- Manual review: Scale or complexity needs human sign-off; no concrete taint/dataflow/health/plugin/supply-chain blocker was found.
- manual gate: Large platform release risk: review signal: Maximum changed-file risk score is 207.5 (>= 80).; 4 function(s) flagged: high CC added or jumped. Review blocks on scale/complexity rather than new taint, dataflow, health, plugin, or supply-chain defects. Treat this as a manual release sign-off gate.
- manual gate: Review verdict is block due to scale/complexity risk: Maximum changed-file risk score is 207.5 (>= 80).; 4 function(s) flagged: high CC added or jumped.

### Trust Calibration
- 5 manual review/watch signal(s); no actual defect blocker was found.
- actual defects: none
- manual review: Large platform release risk: review signal: Maximum changed-file risk score is 207.5 (>= 80).; 4 function(s) flagged: high CC added or jumped. Review blocks on scale/complexity rather than new taint, dataflow, health, plugin, or supply-chain defects. Treat this as a manual release sign-off gate.; Review verdict is block due to scale/complexity risk: Maximum changed-file risk score is 207.5 (>= 80).; 4 function(s) flagged: high CC added or jumped.; Touched file overlaps high-risk hotspot src/types.ts (risk 329.3); Touched file overlaps high-risk hotspot tests/core/review.test.ts (risk 225.7); Touched file overlaps high-risk hotspot src/core/fileInspector.ts (risk 225.2)
- watch signals: none

### Baseline Trend
- No local baseline found. Run `projscan diff --save-baseline` after the first clean review.

### Top Risks
- **p0** Review verdict is block due to scale/complexity risk: Maximum changed-file risk score is 207.5 (>= 80).; 4 function(s) flagged: high CC added or jumped. owner: unassigned run: `projscan review --format json`
- **p1** docs/examples/plugins/security-sensitive-files.mjs and docs/examples/pr-comments/actual-3.0.5-pr.md are in the same package or top-level area owner: unassigned files: docs/examples/plugins/security-sensitive-files.mjs run: `projscan preflight --format json`
- **p1** Large platform release risk: review signal: Maximum changed-file risk score is 207.5 (>= 80).; 4 function(s) flagged: high CC added or jumped. Review blocks on scale/complexity rather than new taint, dataflow, health, plugin, or supply-chain defects. Treat this as a manual release sign-off gate. owner: unassigned run: `projscan review --format json`

### First Fix
- **p0** Review verdict is block due to scale/complexity risk: Maximum changed-file risk score is 207.5 (>= 80).; 4 function(s) flagged: high CC added or jumped.
- why first: First because this is the highest-priority blocking signal from PR evidence: Review verdict is block due to scale/complexity risk: Maximum changed-file risk score is 207.5 (>= 80).; 4 function(s) flagged: high CC added or jumped.
- run: `projscan review --format json`

### Team Routing
- No owner hints found. Add .github/CODEOWNERS line: `src/core/** @team-name`
- Replace `@team-name` with the owning team before merging.

### Verification
- `projscan release-train --format json`
- `projscan bug-hunt --format json`
- `projscan workplan --mode release --format json`
- `projscan handoff --mode release`
- `projscan preflight --mode before_merge --format json`

### Next Commands
- `projscan preflight --mode before_merge --format json`
- `projscan review --base main --head HEAD --format json`
- `npm test`
- `projscan review --format json`
- `projscan hotspots --format json`
- `npm run release:check`

### Suggested Next Actions
- Clear readiness blockers: `projscan preflight --mode before_merge --format json`
- Expand graph intelligence precision: `projscan review --base main --head HEAD --format json`
- Plan 3.2.x quality work: `npm test`
- Plan 3.3.x quality work: `npm test`
- Plan 3.4.x quality work: `npm test`

Approval guidance: Review cautions, then approve only after the regression plan passes.
