# Runbook and Task Card Review Decisions Design

## Context

`missionControl.reviewGate` now carries a reviewer decision menu. The full review gate shows the choices a human can make after an autonomous slice: approve another bounded slice, request changes, or review a version candidate without publishing.

The two primary copyable artifacts still hide that menu. `missionControl.runbook.markdown` and `missionControl.taskCard.markdown` show the review checklist, but they do not show the allowed decisions. If a reviewer reads only the task card or runbook, they see the stop rule but not the decision menu.

## Goal

Render the existing review-gate decisions inside Mission Control runbooks and task cards so every copyable handoff artifact carries the same review choices.

## Approaches

### Recommended: reuse `reviewGate.decisions` in both Markdown renderers

Add a `## Reviewer Decision` section to `renderMissionRunbookMarkdown` and `renderMissionTaskCardMarkdown`. Use the existing `formatMissionReviewDecision` helper so the text matches `reviewGate.markdown`.

This keeps one source of truth for labels, descriptions, and consequences.

### Alternative: link to `review-gate.md`

The task card and runbook could point reviewers to `review-gate.md`, but many handoffs are pasted into chat, PRs, or issues without the saved bundle. The decision menu needs to travel with the artifact.

### Alternative: add structured fields to runbook and task card

Runbook and task card objects could expose `decisions` as structured fields. That may be useful later, but `missionControl.reviewGate.decisions` already gives JSON and MCP clients the structured data. This slice only fixes the missing Markdown surface.

## Design

Add this section after the `## Review Gate` checklist and before the review prompt in both renderers:

```md
## Reviewer Decision
- [ ] Approve next slice: The agent may start another bounded implementation slice. Consequence: No release, publish, deploy, or version bump is allowed unless the reviewer asks for it.
- [ ] Request changes: The agent must address review feedback before starting more scope. Consequence: The current mission stays open until feedback and proof are updated.
- [ ] Review version candidate: The agent may prepare release notes, version rationale, and remaining gates for review. Consequence: Publishing still requires a separate explicit approval.
```

Do not duplicate the decision data. Both renderers read `input.reviewGate.decisions` and call `formatMissionReviewDecision`.

## Tests

- Core: task card Markdown contains `## Reviewer Decision` and a decision line; runbook Markdown contains the same section and line.
- CLI: `--task-card` and `--runbook` outputs contain the decision menu.
- MCP: `projscan_start` runbook Markdown contains the decision menu.

## Docs

Update README and GUIDE to say task cards and runbooks carry the same reviewer decision menu. Update CHANGELOG with the Markdown propagation.

Run `npm run docs:screenshots`; commit PNG changes only if the generated images differ.

## Out of Scope

- New CLI flags.
- New structured fields on runbooks or task cards.
- Changing the decision ids, labels, descriptions, or consequences.
- Release, publish, deploy, or version-bump behavior.

## Auto-Mode Note

The user asked for auto-mode iteration and no release/deploy. This slice improves the review flow, then stops after verification and commit.
