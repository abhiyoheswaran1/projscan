# AgentLoopKit Proof-Phase Upgrade Train Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade projscan from `agentloopkit@0.33.0` to `0.47.1`, fully refresh the repo-local AgentLoopKit workflow, and prove that the upgraded loop works end to end before any release activity.

**Architecture:** Treat the approved design as a proof-phase subproject. Update the dependency and repo-local harness first, then tighten task/verification/handoff guidance, then dogfood the upgraded loop to produce evidence and the first follow-up product slice contract. Keep product code changes out of this plan unless the workflow upgrade itself exposes a small concrete defect.

**Tech Stack:** TypeScript, npm, AgentLoopKit CLI, Markdown docs, Vitest, projscan CLI.

---

## Scope Split

The approved design covers two phases. This plan intentionally implements only
the **proof phase**:

1. upgrade `agentloopkit`,
2. refresh repo-local loop guidance,
3. prove the upgraded loop works,
4. mint the first dogfood slice that will run on top of it.

Do **not** use this plan to cut a release or start the broader `4.x` shipping
phase. That gets its own follow-up plan after proof-phase evidence exists.

## File Structure

- Create `.agentloop/tasks/2026-07-06-agentloopkit-proof-phase-upgrade-train.md` as the proof-phase task contract.
- Modify `package.json` and `package-lock.json` to upgrade `agentloopkit` to `0.47.1`.
- Modify `AGENTS.md` and `AGENTLOOP.md` to reflect the current loop guidance after the upgrade.
- Modify `.agentloop/README.md` and `.agentloop/tasks/README.md` if the upgraded workflow changes local expectations for task selection, verification tiers, or review evidence.
- Modify `.agentloop/harness/commands.md`, `.agentloop/harness/working-agreement.md`, `.agentloop/harness/definition-of-done.md`, `.agentloop/harness/review-checklist.md`, and `.agentloop/harness/release-checklist.md` where the new loop guidance needs explicit local decisions.
- Modify `.agentloop/harness/repo-map.md` and `.agentloop/harness/autonomous-work-rules.md` only if the new loop changes how maintainers locate active work or stop boundaries.
- Modify docs that encode the old workflow shape only if the proof phase actually changes their claims, likely `docs/examples/adoption-workflows.md` and selected maintainer-facing sections in `docs/GUIDE.md`.
- Modify tests that hard-code the old dev dependency version or loop wording, likely `tests/reporters/consoleReviewReporter.test.ts` and any focused docs tests that fail after the guidance refresh.
- Create a follow-up task contract for the first post-upgrade dogfood slice once the new loop evidence identifies the gap.

## Task 1: Create The Proof-Phase Task Contract And Baseline

**Files:**
- Create: `.agentloop/tasks/2026-07-06-agentloopkit-proof-phase-upgrade-train.md`
- Read: `docs/superpowers/specs/2026-07-06-agentloopkit-next-major-train-design.md`
- Read: `AGENTS.md`
- Read: `AGENTLOOP.md`

- [ ] **Step 1: Create the task contract with the approved scope**

Run:

```bash
npm exec agentloop -- create-task \
  --title "AgentLoopKit proof-phase upgrade train" \
  --type dependency-upgrade \
  --out .agentloop/tasks/2026-07-06-agentloopkit-proof-phase-upgrade-train.md \
  --problem "projscan still runs on agentloopkit 0.33.0, so the repo-local task, verification, handoff, and review workflow is behind the current loop idioms." \
  --outcome "Upgrade agentloopkit to 0.47.1, refresh the repo-local harness and guidance, prove the upgraded loop works end to end, and create the first follow-up dogfood slice contract without cutting a release." \
  --constraint "Do not bump projscan version, tag, publish, deploy, or prepare release artifacts during this proof phase." \
  --constraint "Use npm exec agentloop -- upgrade-harness --details after the dependency upgrade and copy relevant guidance manually." \
  --constraint "Prefer repo-local guidance and task-flow updates before any projscan product behavior changes." \
  --constraint "Use task-only verification where focused task commands exist; reserve broad verification for shared workflow changes." \
  --non-goal "No additive 4.x release work in this task." \
  --non-goal "No broad projscan feature expansion unrelated to the workflow upgrade." \
  --likely-file package.json \
  --likely-file package-lock.json \
  --likely-file AGENTS.md \
  --likely-file AGENTLOOP.md \
  --likely-file .agentloop/harness \
  --likely-file .agentloop/README.md \
  --likely-file .agentloop/tasks/README.md \
  --acceptance "package.json and package-lock.json upgrade agentloopkit to 0.47.1." \
  --acceptance "AGENTS.md, AGENTLOOP.md, and relevant .agentloop harness files describe the upgraded loop coherently." \
  --acceptance "The upgraded workflow produces current review-context, status, verify, check-gates, ship, and maintainer-check evidence in this repo." \
  --acceptance "A follow-up dogfood slice contract is created from proof-phase evidence." \
  --verify-command "npm run typecheck" \
  --verify-command "npm run lint" \
  --verify-command "npm run build" \
  --verify-command "npm test -- tests/reporters/consoleReviewReporter.test.ts" \
  --risk "Dependency upgrade may change command expectations or generated harness wording." \
  --risk "Guidance rewrites can drift from actual CLI behavior if not verified with real AgentLoop runs." \
  --rollback "Revert package.json, package-lock.json, harness docs, and proof-phase task files if the upgraded loop fails verification."
```

Expected: AgentLoopKit writes `.agentloop/tasks/2026-07-06-agentloopkit-proof-phase-upgrade-train.md`.

- [ ] **Step 2: Pin the task and mark it in progress**

Run:

```bash
npm exec agentloop -- task set .agentloop/tasks/2026-07-06-agentloopkit-proof-phase-upgrade-train.md
npm exec agentloop -- task status .agentloop/tasks/2026-07-06-agentloopkit-proof-phase-upgrade-train.md in-progress
```

Expected: `agentloop task current` reports the new task as active and in progress.

- [ ] **Step 3: Capture baseline loop and policy state**

Run:

```bash
npm exec agentloop -- review-context
npm exec agentloop -- status
npm exec agentloop -- policy show dependency-change-policy
npm exec agentloop -- policy status
```

Expected: baseline output confirms the repo is entering a dependency-upgrade task with current policy guidance visible.

- [ ] **Step 4: Commit the task contract**

Run:

```bash
git add .agentloop/tasks/2026-07-06-agentloopkit-proof-phase-upgrade-train.md
git commit -m "chore: add agentloopkit proof-phase upgrade task"
```

Expected: one commit with only the new task contract.

## Task 2: Upgrade AgentLoopKit And Capture Harness Guidance

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Upgrade the dependency**

Run:

```bash
npm install --save-dev agentloopkit@0.47.1
```

Expected: `package.json` declares `"agentloopkit": "^0.47.1"` and `package-lock.json` resolves the new version.

- [ ] **Step 2: Verify the installed version**

Run:

```bash
node -p "require('./node_modules/agentloopkit/package.json').version"
npm exec agentloop -- version
```

Expected: the Node check prints `0.47.1`; the CLI command prints the upgraded AgentLoopKit version.

- [ ] **Step 3: Capture upgrade-harness guidance**

Run:

```bash
npm exec agentloop -- upgrade-harness --details
npm exec agentloop -- doctor
```

Expected: `upgrade-harness --details` prints copyable guidance only; `doctor` reports any harness/config hygiene issues introduced by the upgrade.

- [ ] **Step 4: Run a focused dependency proof**

Run:

```bash
npm test -- tests/reporters/consoleReviewReporter.test.ts
npm run build
```

Expected: focused tests and build pass, or any failures identify upgrade fallout before guidance edits begin.

- [ ] **Step 5: Commit the dependency bump**

Run:

```bash
git add package.json package-lock.json
git commit -m "build: upgrade agentloopkit to 0.47.1"
```

Expected: one commit containing only the dependency and lockfile change.

## Task 3: Refresh Top-Level Loop Guidance

**Files:**
- Modify: `AGENTS.md`
- Modify: `AGENTLOOP.md`
- Modify: `.agentloop/README.md`

- [ ] **Step 1: Update AGENTS.md from the upgrade guidance**

Edit the AgentLoopKit section in `AGENTS.md` so it keeps the repo-local command
form but reflects the upgraded loop vocabulary and proof-phase boundary. Keep
the command form explicit and preserve the existing no-destructive safety rules.

Use content shaped like:

```md
- Run `npm exec agentloop -- review-context` for one read-only snapshot before choosing or creating a task.
- Use `npm exec agentloop -- task set <path>` and `npm exec agentloop -- task status <path> in-progress` to pin the current slice explicitly.
- Prefer `npm exec agentloop -- verify --task <path> --task-commands --only-task-commands --write-run` for focused slice work when the task carries its own verification commands.
- Run `npm exec agentloop -- check-gates`, `npm exec agentloop -- ship`, and `npm exec agentloop -- maintainer-check` only after fresh verification and handoff evidence exist.
- During the AgentLoopKit proof phase, do not bump projscan version, tag, publish, deploy, or prepare release artifacts.
```

- [ ] **Step 2: Update AGENTLOOP.md to match**

Edit `AGENTLOOP.md` so the start-of-work and verification sections match the
same semantics as `AGENTS.md`, without diverging in wording about when to use
task-only verification, broad repo verification, and review-readiness commands.

Use content shaped like:

```md
1. Run `npm exec agentloop -- review-context`.
2. Inspect or create the task contract.
3. Pin the active task and mark it in progress.
4. Use task-only verification first when the task already carries focused commands.
5. Treat `check-gates`, `ship`, and `maintainer-check` as review-readiness proof, not as replacements for verification.
```

- [ ] **Step 3: Update .agentloop/README.md if the local workflow summary is stale**

If `.agentloop/README.md` still describes the older loop shape, align its short
summary with the upgraded task-first, proof-first workflow. Keep it concise.

- [ ] **Step 4: Verify doc consistency**

Run:

```bash
rg -n "0\\.33\\.0|task-only verification|maintainer-check|proof phase|upgrade-harness" AGENTS.md AGENTLOOP.md .agentloop/README.md
```

Expected: no stale `0.33.0` references remain, and the upgraded workflow terms appear where intended.

- [ ] **Step 5: Commit the top-level guidance refresh**

Run:

```bash
git add AGENTS.md AGENTLOOP.md .agentloop/README.md
git commit -m "docs: refresh top-level agentloop guidance"
```

Expected: one commit containing only the top-level guidance changes.

## Task 4: Refresh Harness Checklists And Task Guidance

**Files:**
- Modify: `.agentloop/harness/commands.md`
- Modify: `.agentloop/harness/working-agreement.md`
- Modify: `.agentloop/harness/definition-of-done.md`
- Modify: `.agentloop/harness/review-checklist.md`
- Modify: `.agentloop/harness/release-checklist.md`
- Modify: `.agentloop/harness/autonomous-work-rules.md`
- Modify: `.agentloop/harness/repo-map.md`
- Modify: `.agentloop/tasks/README.md`

- [ ] **Step 1: Update the harness command ladder**

Edit `.agentloop/harness/commands.md` so it distinguishes:

- task selection commands,
- focused verification commands,
- broad verification commands,
- review-readiness commands,
- release-only commands.

Use a table or bullets shaped like:

```md
- Slice start: `npm exec agentloop -- review-context`, `task list`, `task show`, `task set`, `task status`
- Focused proof: `npm exec agentloop -- verify --task <path> --task-commands --only-task-commands --write-run`
- Broad proof: `npm exec agentloop -- verify --task <path> --write-run`
- Review readiness: `npm exec agentloop -- check-gates`, `npm exec agentloop -- ship`, `npm exec agentloop -- maintainer-check`
- Release-only: `npm exec agentloop -- prepare-pr`, `report`, `badge`, `release-notes --write`, `npm-status`
```

- [ ] **Step 2: Update the working agreement and definition of done**

Edit `.agentloop/harness/working-agreement.md` and
`.agentloop/harness/definition-of-done.md` so they require:

- an explicit pinned task,
- fresh verification evidence,
- fresh handoff evidence,
- honest unverified-area notes,
- no release actions during the proof phase.

- [ ] **Step 3: Update review and release checklists**

Edit `.agentloop/harness/review-checklist.md` and
`.agentloop/harness/release-checklist.md` so proof-phase slices stop at review
readiness and explicitly defer release actions. The release checklist should
remain available, but it should not read like part of ordinary slice work.

- [ ] **Step 4: Update task README and stop-boundary docs**

Edit `.agentloop/tasks/README.md`, `.agentloop/harness/autonomous-work-rules.md`,
and `.agentloop/harness/repo-map.md` only where needed to clarify how a
maintainer finds the active task and when autonomous work must stop for review.

- [ ] **Step 5: Verify harness hygiene**

Run:

```bash
npm exec agentloop -- doctor
npm exec agentloop -- next
npm exec agentloop -- status
```

Expected: `doctor` reports no new harness issues, and `next` / `status` read coherently under the new guidance.

- [ ] **Step 6: Commit the harness refresh**

Run:

```bash
git add .agentloop/harness/commands.md .agentloop/harness/working-agreement.md .agentloop/harness/definition-of-done.md .agentloop/harness/review-checklist.md .agentloop/harness/release-checklist.md .agentloop/harness/autonomous-work-rules.md .agentloop/harness/repo-map.md .agentloop/tasks/README.md
git commit -m "docs: refresh agentloop harness workflow"
```

Expected: one commit containing the harness and task-guidance updates.

## Task 5: Repair Focused Tests And Maintainer-Facing Docs

**Files:**
- Modify: `tests/reporters/consoleReviewReporter.test.ts`
- Modify: `docs/examples/adoption-workflows.md`
- Modify: `docs/GUIDE.md`

- [ ] **Step 1: Repair any focused tests that encode the old version or flow**

If `tests/reporters/consoleReviewReporter.test.ts` or any directly related
focused test fails only because it still expects `agentloopkit@^0.33.0` or old
workflow wording, update the assertion to match the new dependency version or
revised maintainer flow.

Use assertion shapes like:

```ts
expect(out).toContain('+ agentloopkit@^0.47.1 (dev)');
```

- [ ] **Step 2: Refresh maintainer-facing examples only where the proof phase changed them**

Update `docs/examples/adoption-workflows.md` and the relevant maintainer-facing
sections in `docs/GUIDE.md` only if they now misdescribe task pinning, focused
verification, or review-readiness steps.

Use copy shaped like:

```md
Use `npm exec agentloop -- task set <path>` before editing when several open task contracts exist.
Prefer task-only verification for focused slices; use broad verification only when the task does not carry its own proof commands or the slice changes shared workflow behavior.
```

- [ ] **Step 3: Verify focused docs/tests**

Run:

```bash
npm test -- tests/reporters/consoleReviewReporter.test.ts
rg -n "0\\.33\\.0|task set <path>|task-only verification|maintainer-check" docs/examples/adoption-workflows.md docs/GUIDE.md
```

Expected: the focused test passes and the docs searches show only current wording.

- [ ] **Step 4: Commit the repair pass**

Run:

```bash
git add tests/reporters/consoleReviewReporter.test.ts docs/examples/adoption-workflows.md docs/GUIDE.md
git commit -m "test: align maintainer docs with upgraded agentloop flow"
```

Expected: one commit containing only focused test and docs repairs.

## Task 6: Prove The Upgraded Loop And Mint The First Dogfood Slice

**Files:**
- Create: `.agentloop/tasks/2026-07-06-agentloop-dogfood-follow-up.md`
- Read/Write: `.agentloop/reports/*`
- Read/Write: `.agentloop/handoffs/*`

- [ ] **Step 1: Run focused task verification through AgentLoopKit**

Run:

```bash
npm exec agentloop -- verify --task .agentloop/tasks/2026-07-06-agentloopkit-proof-phase-upgrade-train.md --task-commands --only-task-commands --write-run
```

Expected: AgentLoopKit writes a fresh verification report for the proof-phase task. If it fails, stop and fix the reported issue before continuing.

- [ ] **Step 2: Run review-readiness proof**

Run:

```bash
npm exec agentloop -- check-gates
npm exec agentloop -- ship
npm exec agentloop -- maintainer-check
```

Expected: the upgraded loop produces coherent gate, ship, and maintainer-review output using the refreshed local guidance.

- [ ] **Step 3: Dogfood the upgraded loop through projscan surfaces**

Run:

```bash
npm exec projscan -- start --intent "upgrade the repo-local agentloop workflow and prove the maintainer loop" --format json
npm exec projscan -- review-gate --intent "upgrade the repo-local agentloop workflow and prove the maintainer loop" --format json
npm exec projscan -- bug-hunt --format json
```

Expected: these commands surface at least one concrete maintainer or evidence gap, or confirm the upgraded loop is already legible enough to move on.

- [ ] **Step 4: Create the first follow-up dogfood slice task**

Pick the smallest concrete issue surfaced by Step 3 or by the review-readiness
commands, then mint a focused follow-up task contract that captures that gap and
points at the exact verification path to use next.

Run:

```bash
npm exec agentloop -- create-task \
  --title "AgentLoop dogfood follow-up slice" \
  --type feature \
  --out .agentloop/tasks/2026-07-06-agentloop-dogfood-follow-up.md \
  --problem "The upgraded AgentLoopKit proof phase surfaced at least one maintainer or reviewer evidence gap that should become the first bounded dogfood improvement slice." \
  --outcome "Capture the smallest evidence-backed follow-up slice under the upgraded loop, including the exact commands and files that will prove it." \
  --constraint "Do not bump projscan version, tag, publish, or deploy." \
  --constraint "Keep the slice additive and semver-safe." \
  --acceptance "The task contract records the concrete gap surfaced by proof-phase evidence, names the likely files, and defines one focused verification command." \
  --verify-command "npm exec projscan -- bug-hunt --format json"
```

Then immediately open the task and replace the generic problem statement,
acceptance text, likely files, and verification command with the concrete
evidence surfaced in Step 3.

Run:

```bash
npm exec agentloop -- task show .agentloop/tasks/2026-07-06-agentloop-dogfood-follow-up.md
```

Expected: a new follow-up task exists and is narrow enough to execute under the refreshed loop.

- [ ] **Step 5: Produce handoff evidence**

Run:

```bash
npm exec agentloop -- prepare-pr
npm exec agentloop -- report
```

Expected: reviewer-ready body and one local HTML evidence artifact exist for the proof phase.

- [ ] **Step 6: Mark the proof-phase task ready for review**

Run:

```bash
npm exec agentloop -- task status .agentloop/tasks/2026-07-06-agentloopkit-proof-phase-upgrade-train.md review
git status --short
```

Expected: the task status is `review`, with the follow-up slice ready to become the next active task.

## Task 7: Final Static Checks

**Files:**
- Read: `package.json`
- Read: `package-lock.json`
- Read: updated docs and harness files

- [ ] **Step 1: Run final repo checks for the workflow refresh**

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: all static checks pass after the dependency and guidance refresh.

- [ ] **Step 2: Confirm no stale dependency version remains**

Run:

```bash
rg -n "agentloopkit@\\^0\\.33\\.0|\"agentloopkit\": \"\\^0\\.33\\.0\"" . --glob '!node_modules/**'
```

Expected: no matches.

- [ ] **Step 3: Commit the final proof-phase evidence**

Run:

```bash
git add package.json package-lock.json AGENTS.md AGENTLOOP.md .agentloop docs tests
git commit -m "chore: prove upgraded agentloop workflow"
```

Expected: one final proof-phase commit containing any remaining staged workflow evidence updates.

## Self-Review Checklist

- Spec coverage:
  - dependency upgrade: covered by Task 2
  - harness and top-level guidance refresh: covered by Tasks 3 and 4
  - maintainer ergonomics and verification model: covered by Tasks 3, 4, and 6
  - dogfood proof and next bounded slice: covered by Task 6
  - no-release proof phase: enforced across Tasks 1 through 7
- Placeholder scan:
  - no `TODO`, `TBD`, or unnamed files remain in the plan
- Type and command consistency:
  - all AgentLoopKit commands use the repo-local `npm exec agentloop -- ...` form
  - all projscan commands use `npm exec projscan -- ...`
