# AgentLoopKit Upgrade And Next-Major Train Design

## Goal

Upgrade projscan's repo-local AgentLoopKit workflow from `agentloopkit@0.33.0`
to `agentloopkit@0.47.1`, adopt the newer loop idioms fully, and use the
resulting workflow as the operating basis for the path to the next major
release.

The train must improve both:

- **Maintainer ergonomics**: a human maintainer should be able to enter the
  repo cold, identify the active task, run the right verification tier, and
  produce a review-ready handoff without guessing.
- **Product dogfooding**: projscan should use its own evidence surfaces where
  they materially reduce review uncertainty in the upgraded workflow.

This is a workflow and product-shaping train. It is not a blind dependency bump,
not a broad rewrite, and not an immediate release push.

## Operating Model

Use a two-phase train:

1. **Proof phase, no release**
   - Upgrade `agentloopkit`.
   - Refresh repo-local harness and guidance.
   - Reconcile task, verification, handoff, and review flows with the latest
     AgentLoopKit idioms.
   - Dogfood the upgraded loop locally until it is stable and useful.

2. **Post-proof shipping phase**
   - Allow additive `4.x` releases only for slices that are already proven by
     the new workflow and remain semver-safe.
   - Reserve `5.0` for deliberate contract breaks, removals, or major workflow
     resets that deserve a major boundary.

This avoids mixing workflow churn with release noise while still allowing proven
improvements to ship before the major.

## Current Context

- projscan currently declares `agentloopkit@^0.33.0`.
- npm currently reports `agentloopkit@0.47.1` as the latest available version.
- The repo already uses AgentLoopKit as a local development dependency and has
  repo-local guidance in `AGENTS.md`, `AGENTLOOP.md`, and `.agentloop/`.
- The repo already has a long-running no-release implementation loop, which is
  a useful pattern to preserve while updating the loop mechanics.

## Train Structure

Execute the train as four bounded slices under one upgrade program.

### 1. Upgrade And Harness Alignment

- Bump `agentloopkit` from `0.33.0` to `0.47.1`.
- Run `npm exec agentloop -- upgrade-harness --details`.
- Update `AGENTS.md`, `AGENTLOOP.md`, and `.agentloop/harness/*` to reflect the
  current loop vocabulary and expectations.
- Keep guidance edits explicit and reviewable rather than regenerating or
  replacing repo-local decisions wholesale.

### 2. Task-Contract And Verification Refresh

- Inspect current task contracts, reports, handoffs, gate usage, and next-action
  guidance.
- Tighten the distinction between:
  - focused task-slice verification,
  - broad repo verification,
  - release-grade verification.
- Make task-only verification the default path for bounded slices when task
  contracts already carry focused commands.

### 3. Maintainer Ergonomics

- Reduce ambiguity around active-task selection, proof freshness, handoff
  expectations, and review readiness.
- Make the next action clearer for a human maintainer entering the repo cold.
- Keep the loop small enough that maintainers will follow it rather than work
  around it.

### 4. Projscan Dogfood Integration

- Use projscan's own surfaces to validate or strengthen the upgraded workflow
  where doing so materially improves trust.
- Likely candidate surfaces include `start`, `review`, `prove`, `review-gate`,
  `bug-hunt`, report artifacts, and reviewer-facing evidence summaries.
- The bar is utility, not self-reference. If a projscan surface adds noise
  rather than clarity, do not expand it in this train.

## Scope

Likely files and areas:

- `package.json`
- `package-lock.json`
- `AGENTS.md`
- `AGENTLOOP.md`
- `.agentloop/harness/*`
- `.agentloop/tasks/*` for the new train contract or revised active contract
- selected docs such as `README.md`, `docs/GUIDE.md`, and `DECISIONS.md`
- projscan source and tests only where the upgraded workflow exposes a concrete
  product gap

## Non-Goals

- No version bump, tag, publish, deploy, push, merge, or release automation
  during the proof phase.
- No broad product rewrite to "match" AgentLoopKit.
- No new dependencies beyond the AgentLoopKit upgrade unless a later slice proves
  a concrete need and dependency policy is rechecked.
- No hidden network calls, telemetry expansion, daemon behavior, or secret-value
  reads.
- No semver-breaking public API or CLI changes in `4.x` slices unless a later
  major-release task explicitly authorizes them.

## Execution Rules

Each slice should follow the same loop:

1. Pin or create one explicit AgentLoop task for the slice.
2. Make the smallest change that advances the train.
3. Run targeted verification first.
4. Record handoff and gate evidence.
5. Only then decide whether the slice is ready to fold into the next one.

Prefer workflow and harness changes before product behavior changes. Product
changes are justified only when the upgraded loop reveals a real defect,
ambiguity, or missing proof surface.

## Proof Model

The train is complete only when it produces three kinds of proof.

### Workflow Proof

The upgraded AgentLoopKit flow makes sense in this repo end to end:

- `review-context`
- `status`
- `next`
- `verify`
- `check-gates`
- `ship`
- `prepare-pr`
- `maintainer-check`

These commands should give coherent guidance in projscan without requiring local
tribal knowledge.

### Maintainer Proof

A maintainer can:

- identify the active task quickly,
- choose the correct verification tier,
- understand what evidence is stale or missing,
- produce a reviewer-ready handoff without guessing.

### Dogfood Proof

projscan's own commands help explain or validate the loop in a way that reduces
review uncertainty. They should not exist just to say projscan was used.

## Verification Strategy

Testing should scale with the slice:

- Start with focused checks around the touched surface.
- Run broader repo checks when the slice changes shared workflow contracts or
  user-facing guidance.
- Keep failures visible. Do not relabel partial or failed verification as a
  pass.

During the proof phase, the repo should favor task-specific verification paths
where task contracts already define focused commands, and reserve broad `test`,
`lint`, `typecheck`, and `build` runs for slices that actually need them.

## Documentation

The train should leave the repo with consistent guidance across:

- `AGENTS.md`
- `AGENTLOOP.md`
- `.agentloop/harness/*`
- task contracts
- handoff expectations
- reviewer-readiness commands
- any updated public or maintainer docs needed to explain the new workflow

If the upgraded workflow changes architecture or durable public behavior,
document that in `DECISIONS.md`.

## Stop Conditions

Stop and ask before continuing if any slice requires:

- additional dependency changes beyond the AgentLoopKit upgrade,
- semver-breaking public API or CLI behavior in a `4.x` slice,
- release, publish, tag, or deploy activity during the proof phase,
- workflow changes that conflict with repo-local safety policies,
- product changes that are broader than the evidence gap that justified them

## Recommended First Implementation Order

1. Create or pin the upgrade-train task contract.
2. Upgrade `agentloopkit` and refresh lockfile evidence.
3. Run `agentloop upgrade-harness --details`.
4. Update harness and guidance files.
5. Reconcile verification and handoff flows.
6. Dogfood the upgraded loop on one bounded projscan improvement slice.
7. Decide which proven additive slices, if any, should ship in `4.x` before the
   `5.0` boundary.

## Release Constraint

This design explicitly starts with a no-release proof phase. The train prepares
the next-major path, but it does not authorize release activity by itself.
