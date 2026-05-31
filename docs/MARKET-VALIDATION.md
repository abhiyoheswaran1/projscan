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

Create `.projscan-feedback.json` with the CLI, then add one response per reviewed PR:

```sh
projscan feedback init --output .projscan-feedback.json
projscan feedback add --file .projscan-feedback.json --repo api-service --pr https://github.com/acme/api-service/pull/42 --reviewer @platform-reviewer --useful true --minutes-saved 15 --prevented-bad-edit --owner-routing-clear true --next-command-clear true
projscan feedback summary --file .projscan-feedback.json --format json
```

Use `--false-positive-rule`, `--missing-signal`, and `--noisy-finding` when reviewers report noise. Clean feedback is evidence too.

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

- `proven`: the repo target is met, at least three reviewer responses marked the PR comment useful, average minutes saved is 10+ or at least one bad edit was prevented, false-positive reports do not outnumber useful responses, and at least one repo has repeat PR feedback
- `needs_more_repos`: fewer repos than the target
- `needs_feedback`: dogfood ran, but no reviewer feedback was captured
- `needs_tuning`: feedback exists but value, repeat use, false positives, or clarity need work first

## Website Proof

Use `marketValidation.websiteProof.markdown` as the source for website examples. When the status is not `proven`, the generated copy stays provisional so the website does not claim usefulness before repo coverage, reviewer feedback, and false-positive tuning are ready.
