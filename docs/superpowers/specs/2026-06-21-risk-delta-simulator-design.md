# Risk Delta Simulator Design

## Goal

Add `projscan simulate --plan "<change plan>"` as the next proof-first workflow after `assess`.
The command helps engineers decide whether a proposed change is worth doing before they edit files.

## Product Shape

`simulate` is read-only. It does not generate code, edit files, or execute the plan. It turns a plain-language plan into a deterministic report:

- files likely touched
- tests likely affected
- public contracts or command surfaces likely affected
- coupling or hotspot evidence behind the prediction
- risk score before and after the proposed change
- safest rollout sequence
- worth-doing judgment
- proof commands to run if the team implements the change

The first target workflow is:

```bash
projscan simulate --plan "split bugHunt.ts into ranking, evidence, and output modules"
```

## Architecture

The simulator should compose existing local evidence instead of adding a new analysis engine:

- `scanRepository` and `buildCodeGraph` identify candidate files and import reachability.
- `computeQualityScorecard` supplies health, hotspot, and maintainability signals.
- `computeRiskDelta` supplies before/after scoring with a clear basis.
- A new `src/core/simulate.ts` owns plan normalization, candidate-file ranking, rollout generation, and worth-doing judgment.

The command accepts the user's plan text as intent, not as executable instructions. Matching is heuristic and deterministic:

- exact repo-relative file mentions win
- basename and token matches rank likely files
- words such as `split`, `extract`, `module`, `test`, `api`, `cli`, and `mcp` shape rollout and proof commands
- when no file matches, the report still returns a low-confidence result and tells the user what evidence is missing

## Output Contract

Create public types in `src/types/simulate.ts`.

The report schema:

- `schemaVersion: 1`
- `plan`
- `verdict: "worth-doing" | "needs-more-evidence" | "not-worth-it-yet"`
- `confidence: "high" | "medium" | "low"`
- `summary`
- `filesLikelyTouched`
- `testsLikelyAffected`
- `contractsLikelyAffected`
- `riskDelta`
- `rolloutPlan`
- `proofCommands`
- `evidence`
- `warnings`

Each candidate file includes a reason and available graph facts such as fan-in, fan-out, direct importers, and whether it appears in quality risks.

## Assess Integration

Proof Cards that recommend bounded refactors should include a `projscan simulate --plan ...` command in the card commands. This makes `assess` point naturally to the next workflow without changing its primary behavior.

## CLI And MCP

CLI:

```bash
projscan simulate --plan "split bugHunt.ts into ranking, evidence, and output modules"
projscan simulate --plan "..." --format json
projscan simulate --plan "..." --format markdown
```

MCP:

- Add `projscan_simulate`.
- Inputs: `plan`, optional `max_files`, optional `max_tokens`.
- Return `{ simulate: SimulateReport }`.
- Rely on the existing MCP payload budget wrapper for `max_tokens`.

## Error Handling

- Empty `--plan` fails with a clear CLI error.
- Missing or unparseable graph evidence does not fail the command; it reduces confidence and adds a warning.
- The command must not read or print secret file contents.

## Testing

Use TDD:

- core tests for plan matching, risk delta, rollout, and low-confidence fallback
- CLI tests for JSON, markdown, and missing-plan failure
- MCP tests for tool definition and handler output
- docs tests for README/GUIDE/STABILITY coverage and public tool count

## Non-Goals

- No automatic edits.
- No LLM-generated refactor plan.
- No network calls.
- No release, tag, push, or publish.
