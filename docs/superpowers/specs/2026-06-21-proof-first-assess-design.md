# Proof-First Assess Design

## Goal

Make `projscan assess` the proof-first engineering command center. A maintainer should be able to run one command and learn what is risky, why it matters, what to fix first, how to fix it safely, which commands prove the fix, what risk should drop, and whether the repo is ready to ship.

## Product Position

Projscan should not compete by adding another broad AI reviewer. Existing code scanning products already focus on AI remediation and autofix. Projscan should compete on trust: every recommendation must show local evidence and a verification path.

## User Problems

- Engineers do not trust vague warnings because they cannot see the evidence.
- Large repos produce long finding lists that do not tell a team what to fix first.
- Agents need bounded tasks with files, proof commands, and rollback notes.
- Teams need a way to capture false positives and accepted decisions without disabling useful checks.
- Maintainers need a short answer to "can we ship now?" without reading five command outputs.

## Public Workflow

```bash
projscan assess --goal "make this repo safer to ship this week"
projscan assess --mode fix-first --format markdown
projscan assess --mode ship-readiness --format json
```

`assess` composes existing local signals:

- `quality-scorecard` for dimensions and ranked risks.
- `bug-hunt` for concrete fix queues and verification commands.
- `preflight` for ship readiness.
- `hotspots` and file inspection evidence through the scorecard and bug-hunt paths.
- project memory and suppressions for trust loops.

## Report Shape

The JSON report uses `schemaVersion: 1` and contains:

- `goal`: normalized user goal.
- `mode`: `standard`, `fix-first`, or `ship-readiness`.
- `verdict`: `ready`, `watch`, or `blocked`.
- `answers`: the seven plain-language product answers.
- `proofCards`: bounded list of evidence-backed recommendations.
- `fixFirst`: one recommended action when available.
- `riskDelta`: baseline and projected risk movement.
- `shipReadiness`: preflight-derived readiness summary.
- `commands`: next commands to verify or continue.
- `feedback`: suppression and feedback commands.

## Proof Card

Each Proof Card contains:

- `id`
- `finding`
- `whyItMatters`
- `evidence`
- `impact`
- `recommendedFix`
- `verification`
- `confidence`
- `suppression`
- `feedback`
- `riskDelta`

Evidence must be local and cite the source command or analyzer. Recommended fixes must describe a safe change shape, not generated code patches.

## Risk Delta

Risk delta starts deterministic. It uses current health score, quality verdict, top-risk priority, issue counts, hotspot count, and preflight status to calculate:

- baseline risk score
- projected score after fixing the selected cards
- expected score delta
- risk removed summary

This first version is a planning estimate, not a promise. Later versions can compare saved before and after snapshots.

## Modes

`standard`: answer all seven questions and return up to five Proof Cards.

`fix-first`: return one or two cards with the highest expected risk reduction. Avoid broad advice.

`ship-readiness`: emphasize preflight, blocking issues, and final verification commands.

## CLI Output

JSON is complete. Markdown is concise and reviewer-ready. Console output can reuse markdown-style sections without adding a separate reporter layer in the first version.

## MCP Output

Add `projscan_assess` with inputs:

- `goal`
- `mode`
- `max_cards`
- `max_tokens`

The handler returns `{ assess: AssessReport }`.

## Feedback And Memory

Each Proof Card includes:

```bash
projscan feedback intake --text "<card-id>: false positive because ..." --format json
```

For issue-backed cards, include inline and config suppression hints where safe:

```ts
// projscan-ignore-line <rule-id> -- reason
```

Do not write memory automatically from `assess`. The first version keeps side effects out of read-only assessment.

## Non-Goals

- No release, tag, publish, or deploy.
- No hidden network calls.
- No LLM code generation.
- No automatic file mutations from `assess`.
- No new dependency unless a later phase proves a standard library approach is not enough.

## Verification Strategy

Each phase gets targeted tests plus a bug/security/performance pass. Final verification runs:

```bash
npm exec projscan -- assess --goal "make this repo safer to ship this week" --format json
npm exec projscan -- assess --mode fix-first --format markdown
npm run typecheck
npm run build
npm run test
```

