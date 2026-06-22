# Proof Cards V2 Daily Trust Loop Design

## Goal

Turn the 4.11 proof-first surface into a repeatable daily team workflow:
assess risk, pick one proof-backed change, simulate the safest option, hand it
to an agent, verify the risk delta, and remember reviewer feedback.

## Scope

This train is additive and no-release. It may add JSON fields, CLI rendering,
MCP payload detail, docs, and demo assets. It must not bump versions, tag, push,
publish, deploy, or update release-channel metadata.

## Personas

- Agent-orchestrating senior engineer: wants the next safe command and a short
  handoff that does not add review work.
- Platform and release owner: wants proof commands, rollback notes, and stable
  evidence that can be reviewed outside an agent transcript.
- Security-conscious reviewer: wants local-only defaults, clear confidence, and
  a way to separate real risk from noisy output.
- OSS maintainer evaluating MCP adoption: wants a useful first result without
  setup friction or noisy false positives.

## Product Shape

### Proof Cards V2

Existing Proof Cards remain the central object. V2 adds evidence quality rather
than another broad scanner:

- `evidenceStrength`: a deterministic level and score based on the diversity of
  local evidence sources.
- `confidenceReason`: a short explanation for the confidence level.
- `evidenceGaps`: missing evidence that prevents high confidence.
- `ranking`: the reasons the card was ranked ahead of other cards.
- `trustMemory`: feedback and suppression context when available.
- `agentHandoff`: an AgentLoopKit-ready task packet for the card.

Existing fields stay intact so current JSON, CLI, and MCP consumers continue to
work.

### Daily Safe Commit

`projscan start --intent "is this safe to commit?"` should route to a compact
before-commit workflow. It should answer changed-file risk, missing proof,
contracts likely affected, one next action, and exact proof commands. The
default long orientation remains available through existing `start` output.

### Trust Memory

Existing feedback intake becomes useful in ranking:

- useful feedback raises confidence for matching workflow signals;
- false-positive and noisy feedback lowers confidence and creates evidence gaps;
- suppressions appear as feedback paths, not as blanket hiding of unrelated
  checks.

The first implementation stays local and deterministic. It reads an optional
feedback artifact when present and does not introduce network calls or telemetry.

### AgentLoopKit Handoff

Every Proof Card can be turned into a small AgentLoopKit task packet:

- title and problem statement;
- scope and files;
- constraints;
- verification commands;
- done criteria;
- rollback notes.

This is data first. It does not run `agentloop create-task` automatically.

### Simulator Alternatives

`projscan simulate --plan` keeps the current single-plan report and adds
alternative comparison. For common maintainability plans, it compares:

- bounded extraction;
- regression-test-first;
- leave unchanged.

The report recommends the option with the best risk reduction for the smallest
blast radius and explains why the other options lost.

## Data Flow

1. `computeAssess` gathers quality-scorecard, bug-hunt, preflight, and optional
   feedback memory.
2. `buildProofCards` creates cards, enriches evidence strength, ranks cards,
   attaches trust memory, and builds handoff packets.
3. `computeStartReport` continues to build Mission Control, with intent routing
   updated so safe-commit language selects before-commit proof.
4. `computeSimulation` ranks likely files, affected tests, contracts, rollout,
   proof commands, and alternative options.
5. CLI and MCP adapters expose the same additive structures.

## Error Handling

- Missing feedback files should not fail assessment; cards should report no
  trust-memory artifact.
- Vague simulation plans should continue returning low confidence with a warning.
- Agent handoff generation should still produce a packet when files are empty,
  using the card id and verification commands as the fallback scope.

## Testing

Use TDD per phase:

- core unit tests for new data fields and ranking behavior;
- CLI JSON and Markdown rendering tests;
- MCP contract tests for additive payloads;
- docs tests for README/GUIDE language;
- self-dogfood with `projscan assess`, `projscan simulate`, and `projscan start`;
- bug pass after each phase with `projscan bug-hunt --format json`.

## Performance

The daily workflow must stay quick. Evidence enrichment should reuse data that
`assess`, `start`, and `simulate` already compute. The final pass measures
`assess`, `simulate`, and safe-commit `start` and records any material slowdown.
