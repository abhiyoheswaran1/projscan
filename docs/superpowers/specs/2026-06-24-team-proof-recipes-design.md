# Team Proof Recipes Design

## Goal

Make the existing proof workflow understand optional repo-specific proof rules. Teams should be able to say, in `.projscanrc.json`, that a critical surface requires specific proof commands, reviewers, and forbidden drift.

## User Problem

Proof Contracts, Proof Sufficiency, and Proof Replay already show what changed and whether proof is fresh. The weak point is that projscan infers proof from generic local evidence. Reviewers need proof that matches their team’s standards, such as “billing changes require billing tests and payments review” or “auth changes must not touch deployment files.”

## Config Shape

`proofRecipes` is optional and additive:

```json
{
  "proofRecipes": [
    {
      "id": "billing-critical",
      "matches": ["src/billing/**"],
      "requiredCommands": ["npm test -- tests/billing/retry.test.ts"],
      "requiredReviewers": ["@payments"],
      "forbiddenFiles": ["src/auth/**", "src/security/**"],
      "riskSurface": "billing",
      "reason": "Billing retry changes need focused payments proof."
    }
  ]
}
```

Normalization keeps only string arrays and non-empty strings. Invalid recipe rows are dropped. No dependency or expression engine is added.

## Behavior

- `projscan prove --intent` loads config through existing CLI/MCP config paths and passes normalized recipes to `computeProve`.
- Intent mode matches recipes against inferred allowed files and likely tests. Matched recipes add proof commands, forbidden files, reviewer labels, and recipe evidence to the Proof Contract.
- Changed mode matches recipes against the real changed files and the saved contract recipes. The Proof Receipt shows matched recipe IDs, required reviewers, recipe proof gaps, and recipe-driven forbidden drift.
- Proof Sufficiency evaluates recipe commands as proof requirements. Missing, stale, or failed recipe commands affect the same readiness and reviewer decision logic as inferred proof.
- `evidence-pack --pr-comment` includes recipe IDs and required reviewers when a Proof Receipt is available.

## Public Surface

All fields are additive:

- `ProjscanConfig.proofRecipes`
- `ProveContract.teamProofRecipes`
- `ProveReceipt.teamProofRecipes`
- `EvidencePackProofReceiptSummary.teamProofRecipes`

No new command, release action, telemetry, or network path is introduced.

## Safety

Recipe matching is deterministic local glob matching. Supported patterns are exact paths and suffix `/**` directory globs, matching current proof forbidden-file behavior. If a recipe is too broad, the receipt shows the matched recipe so users can debug the rule.

## Verification

Tests cover config normalization, contract recipe injection, receipt recipe reporting, proof sufficiency for recipe commands, evidence-pack PR comments, and docs. Release-gate security and stability checks must pass before handoff.
