# projscan PR Comment Example: Large Release PR

Derived from the 3.0.5 large-release benchmark fixture. Large change size becomes manual review, not automatically an actual defect.

```md
## projscan approval evidence

**Verdict:** caution
**Version:** 3.0.5
**Summary:** large platform release needs human sign-off, but no concrete defect blocker was found.

### Verdict
- Manual review: Scale or complexity needs human sign-off; no concrete taint/dataflow/health/plugin/supply-chain blocker was found.
- blockers: none recorded

### Trust Calibration
- manual review/watch signal(s); no actual defect blocker was found.
- actual defects: none
- manual review: Large platform release risk from changed-file scale/complexity
- watch signals: none

### Baseline Trend
- risk from baseline: up +2
- changed since baseline: src/platform.ts; docs/release.md

### Top Risks
- **p1** large platform change needs release sign-off owner: unassigned files: src/platform.ts run: `projscan preflight --mode before_merge --format json`

### First Fix
- **p1** large platform change needs release sign-off
- files: src/platform.ts
- run: `projscan preflight --mode before_merge --format json`

### Team Routing
- No owner hints found. Add .github/CODEOWNERS line: `src/platform/** @team-name`
- Replace `@team-name` with the owning team before merging.

### Verification
- `projscan preflight --mode before_merge --format json`
- `projscan evidence-pack --pr-comment`

### Next Commands
- `projscan preflight --mode before_merge --format json`

### Suggested Next Actions
- Review the stated owner/risk path before approval.

Approval guidance: Review cautions, then approve only after the regression plan passes.
```
