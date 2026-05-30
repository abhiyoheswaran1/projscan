# projscan PR Comment Example: Auth/API PR

Derived from the 3.0.5 auth/API benchmark fixture. This shows owner routing and a concrete first fix for a sensitive route change.

```md
## projscan approval evidence

**Verdict:** caution
**Version:** 3.0.5
**Summary:** auth/API change needs owner review before approval.

### Verdict
- Needs review: Review cautions and run the listed next actions before approval.
- blockers: none recorded

### Trust Calibration
- manual review signal(s); no actual defect blocker was found.
- actual defects: none
- manual review: auth/API ownership required
- watch signals: none

### Baseline Trend
- risk from baseline: up +1
- changed since baseline: src/auth/session.ts; src/api/routes.ts

### Top Risks
- **p1** auth/API route changed owner: @security-team files: src/auth/session.ts run: `projscan review --format json`

### First Fix
- **p1** auth/API route changed owner: @security-team
- files: src/auth/session.ts, src/api/routes.ts
- run: `projscan review --format json`

### Team Routing
- @security-team: owns changed file(s) in this PR (src/auth/session.ts)
- @api-team: owns changed file(s) in this PR (src/api/routes.ts)

### Verification
- `projscan preflight --mode before_merge --format json`
- `projscan evidence-pack --pr-comment`

### Next Commands
- `projscan preflight --mode before_merge --format json`

### Suggested Next Actions
- Review the stated owner/risk path before approval.

Approval guidance: Review cautions, then approve only after the regression plan passes.
```
