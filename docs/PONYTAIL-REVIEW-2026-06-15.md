# Ponytail Branch Review - 2026-06-15

## Scope

Reviewed the current multi-slice branch after AgentLoopKit and AgentFlight
setup, review precision changes, bug-hunt sign-off wording, start harness
guidance, and AgentLoop verification guidance.

## Evidence

- `npm exec projscan -- review --format json`
- `npm exec projscan -- bug-hunt --format json`
- `npm exec agentflight -- verify`
- `git diff --check`
- Direct diff inspection of review, bug-hunt, start harness, changed-file, and
  harness guidance changes.

## Findings

No blocking code defects found in the reviewed diff.

The branch still requires manual release-owner sign-off because `projscan review`
blocks on broad release-scale signals: max changed-file risk and two dev
dependency additions. It reports no new cycles, risky functions, public contract
changes, taint flows, or dataflow risks.

Harness caveat: `AGENTS.md`, `AGENTLOOP.md`, `agentloop.config.json`, and
`.agentloop/` are ignored through local `.git/info/exclude`. Their guidance is
active in this workspace, but those files will not appear in normal git diff or
PR evidence unless intentionally force-added or the local exclude rule changes.

## Ponytail Delete-List

- Do not add a new review JSON field for manual sign-off; the additive summary
  line is enough.
- Do not change review verdict thresholds to make this branch pass; keep the
  release sign-off gate visible.
- Do not remove configured AgentLoop broad commands; use task-only verification
  guidance for focused slices instead.
- Do not replace existing graph helpers with a TypeScript resolver or bundler.
- Do not expand this branch into publish, version bump, deploy, or release
  automation.
