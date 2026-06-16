# Review-Aware Handoff Prompt Design

## Context

Mission Control now exposes reviewer decisions and copyable replies in the review gate, task card, runbook, default console output, and saved mission bundle README.

The smallest handoff surface still has a gap: `missionControl.handoffPrompt`, `projscan start --handoff-prompt`, and saved `handoff-prompt.txt` tell the next agent where to resume, what input is missing, what proof remains, and what done condition matters. They do not carry the review stop condition or the reviewer reply choices.

That matters because teams often paste the one-line handoff prompt without the full runbook. The prompt should preserve the same no-release boundary as the review gate.

## Goal

Make the copyable handoff prompt review-aware by adding the Mission Review Gate stop condition and reviewer reply choices to `missionControl.handoffPrompt`.

## Approaches

### Recommended: append a compact review section to the existing prompt

Build the review gate before the handoff prompt, pass the gate into `missionHandoffPrompt`, and append:

```text
Review gate: Stop after the current Mission Control checklist and proof are complete. Reviewer replies: Approve next slice => Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version.; Request changes => Changes requested: address the review feedback first, update proof, then stop for another review.; Review version candidate => Prepare a version-candidate review only. Do not publish, deploy, push, merge, or bump the version.
```

This keeps the prompt self-contained while reusing the typed review gate.

### Alternative: mention only the stop condition

Adding only `Review gate: ...` would prevent some overrun, but reviewers would still need to invent exact reply wording.

### Alternative: keep prompt short and require the runbook

The runbook already contains the review gate. That works when the whole Markdown artifact travels with the task, but it fails for copy/paste handoffs and `--handoff-prompt`.

## Design

Change the Mission Control assembly order:

1. Build `resume`.
2. Build `reviewProof`.
3. Build `reviewGate`.
4. Build `handoffPrompt` with `reviewGate`.
5. Build runbook, task card, and handoff using the same prompt and gate.

Change the prompt builder signature:

```ts
function missionHandoffPrompt(
  resume: StartMissionResume,
  successCriteria: string[],
  whyNow: string,
  unresolvedInputs: StartUnresolvedInput[],
  proofCommands: string[],
  reviewGate: StartMissionReviewGate,
): string;
```

Add helper formatters:

```ts
function handoffReviewGatePrompt(reviewGate: StartMissionReviewGate): string {
  const decisions = reviewGate.decisions
    .map((decision) => `${decision.label} => ${decision.reply}`)
    .join('; ');
  return ` Review gate: ${trimTrailingPunctuation(reviewGate.stopCondition)}. Reviewer replies: ${decisions}.`;
}
```

Append this helper to the existing prompt after ready proof. Do not change `missionControl.resume.prompt`; it remains focused on the current cursor.

## Tests

- Core: `missionControl.handoffPrompt` contains `Review gate: Stop after the current Mission Control checklist and proof are complete.` and the three reviewer reply labels/text. Confirm `missionControl.resume.prompt` stays unchanged and focused on the current cursor.
- CLI: JSON output and `--handoff-prompt` output contain the review gate and reply text. Saved `handoff-prompt.txt` contains the same text.
- MCP: `projscan_start` returns the review-aware `missionControl.handoffPrompt`.

## Docs And Screenshots

Update README, GUIDE, and CHANGELOG to say the smallest handoff prompt carries the review gate and reviewer replies. Run `npm run docs:screenshots`; keep image changes only if generated assets differ.

## Out Of Scope

- New fields, commands, or flags.
- Changes to `missionControl.resume.prompt`.
- Changes to review-gate Markdown, task-card Markdown, runbook Markdown, or saved bundle file lists.
- Release, publish, deploy, push, merge, or version bump.

## Stop Point

After tests, docs, screenshots, verification, and a local commit, stop for review.
