# projscan PR Comment Example: Generated-code PR

Derived from the 3.0.5 generated-code benchmark fixture. Default taint/dataflow anxiety stays quiet for generated files unless custom policy says otherwise.

```md
## projscan approval evidence

**Verdict:** caution
**Version:** 3.0.5
**Summary:** generated-code update has no actual defect signal from default taint/dataflow rules.

### Verdict

- Ready: No concrete blocker found.
- blockers: none recorded

### Trust Calibration

- clean: no actual defect, manual review, or watch signals found.
- actual defects: none
- manual review: none
- watch signals: none

### Baseline Trend

- risk from baseline: flat
- changed since baseline: src/**generated**/client.ts

### Top Risks

- No prioritized risks recorded.

### First Fix

- No immediate fix-first target. Preserve the baseline and rerun the verification commands.

### Team Routing

- No owner hints found. Add .github/CODEOWNERS line: `src/__generated__/** @team-name`
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
