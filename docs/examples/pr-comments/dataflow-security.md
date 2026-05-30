# projscan PR Comment Example: Dataflow/Security PR

Derived from the 3.0.5 dataflow/security benchmark fixture. Actual defect language is reserved for concrete taint or dataflow evidence.

```md
## projscan approval evidence

**Verdict:** blocked
**Version:** 3.0.5
**Summary:** concrete taint/dataflow evidence requires a fix before approval.

### Verdict
- Concrete blocker: 1 concrete blocker needs fixing before approval.
- blocker: new taint flow reaches child_process.exec

### Trust Calibration
- 1 actual defect/blocker signal requires fixes.
- actual defects: new taint flow reaches child_process.exec
- manual review: none
- watch signals: none

### Baseline Trend
- risk from baseline: up +3
- changed since baseline: src/api/run.ts

### Top Risks
- **p0** command-backed API route reaches exec owner: @security-team files: src/api/run.ts run: `projscan review --format json`

### First Fix
- **p0** command-backed API route reaches exec owner: @security-team
- files: src/api/run.ts
- run: `projscan review --format json`

### Team Routing
- @security-team: owns changed file(s) in this PR (src/api/run.ts)

### Verification
- `projscan preflight --mode before_merge --format json`
- `projscan evidence-pack --pr-comment`

### Next Commands
- `projscan preflight --mode before_merge --format json`

### Suggested Next Actions
- Review the stated owner/risk path before approval.

Approval guidance: Review cautions, then approve only after the regression plan passes.
```
