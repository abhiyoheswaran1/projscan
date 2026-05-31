# Trial Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `projscan trial`, a local-only executive adoption-readiness report that wraps onboarding, dogfood, reviewer feedback, trust signals, and website proof.

**Architecture:** Add a focused `src/core/trial.ts` orchestrator that composes `computeStartReport`, `computeDogfoodReport`, and feedback summaries without duplicating their logic. Add a thin CLI command that reads optional feedback JSON and renders console/JSON output. Keep release/publish untouched.

**Tech Stack:** TypeScript, Commander CLI, existing projscan core reports, Vitest.

---

### Task 1: Core Trial Report

**Files:**
- Create: `src/core/trial.ts`
- Modify: `src/types.ts`
- Test: `tests/core/trial.test.ts`

- [ ] Write failing tests for adoption-ready and needs-feedback trial reports.
- [ ] Add `TrialReport` / `TrialVerdict` types.
- [ ] Implement `computeTrialReport(rootPath, options)` by composing start, dogfood, and feedback summary.
- [ ] Verify focused tests pass.

### Task 2: CLI Command

**Files:**
- Create: `src/cli/commands/trial.ts`
- Modify: `src/cli/index.ts`, `src/utils/formatSupport.ts`, `scripts/check-stability.mjs`, `src/index.ts`
- Test: `tests/cli/trial.test.ts`

- [ ] Write failing CLI JSON test for `projscan trial --repo ... --feedback ...`.
- [ ] Register `projscan trial` with repeatable `--repo`, `--target-repos`, and `--feedback`.
- [ ] Render concise console output and full JSON.
- [ ] Verify focused CLI tests pass.

### Task 3: Docs And Verification

**Files:**
- Modify: `README.md`, `docs/GUIDE.md`, `docs/ADOPTION-PROOF.md`, `docs/WEBSITE-UPDATE-PROMPT.md`, `CHANGELOG.md`

- [ ] Document `projscan trial` as the top-level trial/adoption report.
- [ ] Run build, lint, focused tests, full tests, stability, graph corpus, doctor, preflight, bug-hunt.
- [ ] Stop before release/tag/push.
