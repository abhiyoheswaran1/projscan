# projscan PR Comment Example: Docs-only PR

Derived from the 3.0.5 docs-only benchmark fixture. This is the low-anxiety shape for a safe documentation change.

```md
## projscan approval evidence

**Verdict:** caution
**Version:** 3.0.5
**Summary:** docs-only change has no actual defect signal and stays short enough for GitHub review.

### Verdict
- Ready: No blocking or cautionary preflight signals found.
- blockers: none recorded

### Trust Calibration
- clean: no actual defect, manual review, or watch signals found.
- actual defects: none
- manual review: none
- watch signals: none

### Baseline Trend
- risk from baseline: flat
- changed since baseline: docs/guide.md

### Top Risks
- No prioritized risks recorded.

### First Fix
- No immediate fix-first target. Preserve the baseline and rerun the verification commands.

### Team Routing
- No owner hints found. Add .github/CODEOWNERS line: `docs/** @team-name`
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
