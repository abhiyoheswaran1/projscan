# Review Replies Export Design

## Context

Mission Control now gives reviewers three allowed decisions with exact reply text: approve one more bounded slice, request changes, or review a version candidate without publishing. The replies appear in the default console review gate, the task card, the runbook, the saved bundle README, and the handoff prompt.

The saved mission bundle still makes reviewers open Markdown or JSON to copy those replies. That slows down the most common handoff loop: an agent stops, a reviewer scans the bundle, and the reviewer pastes one allowed reply.

## Goal

Add a copy-only reviewer reply surface for humans and agents:

- `projscan start --review-replies --intent "<goal>"` prints only the reviewer reply lines.
- Saved mission bundles include `review-replies.txt`.
- The bundle manifest and README list the new file.

## Approaches

### Recommended: plain text export backed by the existing decisions

Reuse `missionControl.reviewGate.decisions` and the current `missionReviewReplyLines()` formatter. Add a CLI shortcut that prints those lines, then write the same lines into `review-replies.txt` during `--save-mission`.

This keeps one source of truth for reply wording and gives reviewers the smallest useful artifact.

### Alternative: JSON-only export

The full handoff JSON already contains the decisions. Keeping replies JSON-only works for automated clients, but it is poor for a reviewer who wants to copy a reply from the filesystem or terminal.

### Alternative: add another Markdown section only

Markdown is already covered by `review-gate.md`, `task-card.md`, `runbook.md`, and the bundle README. Another Markdown surface does not solve the copy-only problem.

## Design

Add a Commander option:

```ts
.option('--review-replies', 'print only the Mission Control reviewer reply choices')
```

Handle it before `--handoff-prompt` in the shortcut section:

```ts
if (cmdOpts.reviewReplies === true) {
  printReviewRepliesOnly(report);
  return;
}
```

`printReviewRepliesOnly()` should use `missionReviewReplyLines(report)`, fail with exit code 1 when no lines exist, and print one reply per line without headings.

Update saved mission bundles:

- Write `review-replies.txt` with `missionReviewReplyLines(report).join('\n') + '\n'`.
- Add the file to `missionBundleFiles()`.
- Include it in `manifest.json`.
- The existing `README.md` file list will pick it up through `missionBundleFiles()`.

Update the shortcut index so `projscan start --shortcuts --intent "<goal>"` includes `--review-replies`.

## Tests

- CLI shortcut: `projscan start --review-replies --intent "<goal>" --quiet` prints exactly the three reply lines, no heading, and a trailing newline.
- Bundle writer: `--save-mission` writes `review-replies.txt`; stdout, README, and manifest include it.
- JSON bundle mode: the manifest file list includes `review-replies.txt`.
- Shortcut index: `--shortcuts` includes the `--review-replies` command.

## Docs And Screenshots

Update README, GUIDE, and CHANGELOG to describe `--review-replies` and `review-replies.txt`. Run `npm run docs:screenshots`; keep image changes only if the capture script changes assets.

## Out Of Scope

- New review decision labels or reply wording.
- Changes to MCP schemas.
- Release, publish, deploy, push, merge, or version bump.

## Stop Point

After tests, docs, screenshots, verification, and a local commit, stop for review.
