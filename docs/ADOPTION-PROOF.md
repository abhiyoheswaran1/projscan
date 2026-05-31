# Adoption Proof Loop

Use this loop when deciding whether projscan is useful enough for a real engineering team. It is intentionally practical: run it on real repos, capture reviewer feedback, and tune the product where the output is vague, noisy, or not worth repeating.

## What Good Looks Like

A team should be able to run projscan on every pull request because it saves review time or prevents a risky edit. The first useful proof is not a perfect score. The proof is a reviewer saying one of these happened:

- The PR comment saved 10-20 minutes.
- It found a risk the reviewer would have checked manually.
- It routed the right owner or team without guessing.
- It gave the exact next command or test that proves the fix.

## Run The Loop Across 3 Repos

Pick three real repos that represent the team: for example API, web, and worker. Run:

```sh
projscan dogfood --repo ../api --repo ../web --repo ../worker --format json
```

The report is read-only and records:

- whether each repo can generate a validated PR comment
- whether the repeat-use loop is present in `projscan start`
- whether MCP/setup readiness still has gaps
- the feedback questions to ask on the first real PR
- the next commands needed before calling adoption proven

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
| Dogfood breadth | at least 3 representative repos evaluated | `projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --format json` |

## Tuning Rule

If output is vague, noisy, or not actionable, tune projscan before expanding rollout. Trust is the product. A caution that says exactly what to review is better than a red block that makes engineers stop reading.

## Structured Feedback Capture

For real validation, run dogfood with reviewer feedback instead of relying only on readiness checks:

```sh
projscan dogfood --repo ../api --repo ../web --repo ../worker --feedback .projscan-feedback.json --format json
```

The report now includes `marketValidation` with repo coverage, useful responses, total minutes saved, risky edits prevented, false-positive reports, and `websiteProof.markdown` for public proof copy. See `docs/MARKET-VALIDATION.md` for the feedback file schema.
