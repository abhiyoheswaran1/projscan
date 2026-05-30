# Release Proof: projscan 3.0.5

Date: 2026-05-30
Branch: `feat/3.0.5-proof-of-usefulness`
Status: PR opened for validation, not released

## What 3.0.5 Proves

- A team can run `projscan init team` and get policy, GitHub Action, CODEOWNERS guidance, and a local baseline starter.
- The generated PR comment is the hero surface: verdict, trust calibration, baseline trend, top risks, first fix, team routing, verification, next commands, and suggested next actions.
- The first PR experience is guarded by an end-to-end adoption harness, a dogfood command for 3+ repos, and five PR-comment benchmark fixtures.
- False-positive anxiety is lower: large releases become manual review when no concrete defect exists, generated-code defaults stay quiet, and Express/Next dataflow is receiver/context aware.
- Team memory is visible through baseline trend fields and changed-since-baseline summaries.
- Repeat use is visible through `projscan start` adoption-loop metrics and `projscan dogfood` multi-repo readiness totals.
- PR comments now ask for reviewer feedback directly: useful on this PR, missing/noisy signal, and owner/command clarity.

## PR Proof

- PR: https://github.com/abhiyoheswaran1/projscan/pull/45
- Actual generated PR comment: `docs/examples/pr-comments/actual-3.0.5-pr.md`
- Posted PR proof comment: https://github.com/abhiyoheswaran1/projscan/pull/45#issuecomment-4563604117
- Proof source: generated locally from the built 3.0.5 CLI with `projscan evidence-pack --pr-comment --quiet` after the PR was opened.
- Adoption proof doc: `docs/ADOPTION-PROOF.md`
- Website before/after examples: `docs/examples/pr-comments/before-after.md`

## Verification Checklist

Fresh verification must be rerun before merge and release from `main`.

- [x] `npm test`
- [x] `npm run build`
- [x] `npm run lint`
- [x] `npm run check:graph-corpus`
- [x] `git diff --check`
- [x] `npm pack --dry-run`
- [x] `npm audit --audit-level=high`
- [x] `npm run security:release-gate`
- [x] `npm run check:stability`
- [x] `npm run sbom:generate`
- [x] Built CLI dogfood: `doctor`, `start`, `preflight`, `evidence-pack --pr-comment`, `dogfood --repo .`, `mcp doctor`
- [x] Generated GitHub Action PR-comment validator executed in a real shell

## Release Boundary

No release is complete from this branch. The release path remains:

1. Open PR from this branch.
2. Validate the generated PR comment on GitHub.
3. Merge to `main` after approval.
4. Run release gates from clean `main`.
5. Tag `v3.0.5` and publish only after explicit approval.
