# Market Validation Loop

Use this when you need proof that projscan is useful on real engineering work, not just locally green.

## Goal

Run projscan on 3-5 representative repos, capture first-PR reviewer feedback, and turn that into evidence:

- minutes saved on review
- risky edits or missed review steps prevented
- owner routing clarity
- next-command clarity
- false positives, noisy findings, and missing signals
- website-ready proof copy grounded in measured feedback

## Feedback File

Create `.projscan-feedback.json` after the first real PR comment has been reviewed:

```json
{
  "responses": [
    {
      "repo": "api-service",
      "pr": "https://github.com/acme/api-service/pull/42",
      "reviewer": "@platform-reviewer",
      "useful": true,
      "minutesSaved": 15,
      "preventedBadEdit": true,
      "ownerRoutingClear": true,
      "nextCommandClear": true,
      "falsePositiveRules": [],
      "missingSignals": ["none"],
      "noisyFindings": ["none"]
    }
  ]
}
```

Use `none` when nothing was missing or noisy. Clean feedback is evidence too.

## Run The Proof

```sh
projscan dogfood \
  --repo ../api-service \
  --repo ../web-app \
  --repo ../worker \
  --target-repos 3 \
  --feedback .projscan-feedback.json \
  --format json
```

The `marketValidation` block reports whether the proof is:

- `proven`: the repo target is met, at least three reviewer responses marked the PR comment useful, and false-positive reports do not outnumber useful responses
- `needs_more_repos`: fewer repos than the target
- `needs_feedback`: dogfood ran, but no reviewer feedback was captured
- `needs_tuning`: feedback exists but false positives or unclear output need work first

## Website Proof

Use `marketValidation.websiteProof.markdown` as the source for website examples. When the status is not `proven`, the generated copy stays provisional so the website does not claim usefulness before repo coverage, reviewer feedback, and false-positive tuning are ready.
