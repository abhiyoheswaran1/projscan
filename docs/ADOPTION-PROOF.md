# Adoption Proof Loop

Use this loop when deciding whether projscan is useful enough for a real engineering team. It is intentionally practical: run it on real repos, capture reviewer feedback, and tune the product where the output is vague, noisy, or not worth repeating.

## What Good Looks Like

A team should be able to run projscan on every pull request because it saves review time or prevents a risky edit. The first useful proof is not a perfect score. The proof is a reviewer saying one of these happened:

- The PR comment saved 10-20 minutes.
- It found a risk the reviewer would have checked manually.
- It routed the right owner or team without guessing.
- It gave the exact next command or test that proves the fix.

## Run The Loop Across 3 Repos

Pick three real repos that represent the team: for example API, web, and worker. After the first PR comment has reviewer feedback, run:

```sh
projscan dogfood --repo ../api --repo ../web --repo ../worker --feedback .projscan-feedback.json --format json
projscan trial --repo ../api --repo ../web --repo ../worker --feedback .projscan-feedback.json --format json
```

The reports are read-only and record:

- whether each repo can generate a validated PR comment
- whether the repeat-use loop is present in `projscan start`
- whether MCP/setup readiness still has gaps
- the feedback questions to ask on the first real PR
- the next commands needed before calling adoption proven
- the trial verdict: `adopt`, `pilot`, `tune`, or `setup`

## Validate One Actual PR

On the first real PR, post or paste:

```sh
projscan evidence-pack --pr-comment
```

Ask the reviewer three questions before merge:

1. Did this save 10-20 minutes?
2. What was missing or noisy?
3. Which owner, command, or test should have been clearer?

Record `none` when there is no issue. That matters because repeat clean feedback is the signal that the product is becoming trusted.

## Repeat-Use Metrics

Track these locally or in release notes after each adoption run:

| Metric | Target | Command |
|---|---|---|
| First PR usefulness | reviewer says useful, time-saving, or risk-finding | `projscan evidence-pack --pr-comment` |
| Manual review rate | uncertain cases stay caution/manual review; hard blocks stay rare | `projscan preflight --mode before_merge --format json` |
| Repeat-use commands | every PR has evidence, preflight, and owner routing | `projscan start --mode before_merge --format json` |
| Feedback artifact | repeatable reviewer evidence exists | `projscan feedback init --output .projscan-feedback.json` + `projscan feedback add --file .projscan-feedback.json --repo <repo> --pr <url> --reviewer <handle> --useful true --minutes-saved 10` |
| Dogfood breadth | at least 3 representative repos evaluated | `projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json` |

## Tuning Rule

If output is vague, noisy, or not actionable, tune projscan before expanding rollout. Trust is the product. A caution that says exactly what to review is better than a red block that makes engineers stop reading.

## Structured Feedback Capture

For real validation, capture reviewer feedback with the CLI, then run dogfood with that artifact instead of relying only on readiness checks:

```sh
projscan feedback init --output .projscan-feedback.json
projscan feedback add --file .projscan-feedback.json --repo api --pr https://github.com/acme/api/pull/42 --reviewer @alice --useful true --minutes-saved 10
projscan feedback summary --file .projscan-feedback.json --format json
projscan dogfood --repo ../api --repo ../web --repo ../worker --feedback .projscan-feedback.json --format json
```

The report now includes `marketValidation` with repo coverage, useful responses, average and total minutes saved, risky edits prevented, repeat PR evidence, false-positive reports, and `websiteProof.markdown` for public proof copy. `proven` requires 3+ useful responses, value measured at 10+ average minutes saved or at least one prevented bad edit, false positives under control, and repeat PR feedback. See `docs/MARKET-VALIDATION.md` for the feedback workflow.

## One-Command Trial Report

After feedback exists, run the full local trial report:

```sh
projscan trial --repo ../api --repo ../web --repo ../worker --feedback .projscan-feedback.json --format json
```

`trial.verdict` is the adoption decision surface: `adopt` means the repo coverage, measured value, repeat PR use, and trust gates are ready; `pilot`, `tune`, and `setup` explain what to do next.

## Optional product-health telemetry

For teams that want repeat-use evidence without uploading code, use `projscan telemetry explain` during rollout. Telemetry stays off by default and only sends anonymous product-health buckets after explicit opt-in. It can show setup completion and repeat usage, but reviewer value still comes from `projscan feedback add`.
