# Review Replies First Surfaces Design

## Context

Mission Control review decisions now carry exact `reply` text. The typed review gate, task card, runbook, `--review-gate`, MCP output, and saved `review-gate.md` all expose those replies.

Two first surfaces still hide them:

- The default `projscan start` console output prints the review gate stop rule, evidence commands, and worktree summary, but not the reply choices.
- The saved mission bundle `README.md` opens with the next command and file index, but a reviewer must open `review-gate.md` before seeing the copyable replies.

Those are the surfaces a developer sees when they start a session or open a bundle. They should show the approval text inline.

## Goal

Show copyable reviewer replies in the default `projscan start` review gate and in saved mission bundle quickstart README files.

## Approaches

### Recommended: render compact reply lines in existing first surfaces

Reuse `missionControl.reviewGate.decisions` in `printReviewGate` and `missionBundleReadme`. The console output shows a compact `Reviewer Replies` subsection with each label and reply. The bundle README adds a `## Reviewer Replies` section before `## Files`.

This keeps one source of truth and improves the surfaces developers already use.

### Alternative: add new files to saved mission bundles

A `review-replies.md` or `review-replies.txt` file would make replies easy to copy, but it would add another artifact to a bundle that already has many files. The quickstart README is the right place for the first read.

### Alternative: add another CLI shortcut

A `--review-replies` shortcut would help terminal users, but it would fragment the review flow. The default review gate and `--review-gate` shortcut already own this decision.

## Design

Add two small formatters in `src/cli/commands/start.ts`:

```ts
function missionReviewReplyLines(report: StartReport): string[] {
  return report.missionControl.reviewGate.decisions.map(
    (decision) => `- ${decision.label}: ${decision.reply}`,
  );
}

function printReviewReplies(report: StartReport): void {
  const replies = missionReviewReplyLines(report);
  if (replies.length === 0) return;
  console.log(chalk.bold('Reviewer Replies'));
  for (const reply of replies) console.log(reply);
}
```

Use them in the two first surfaces:

- `printReviewGate(report)` prints `Reviewer Replies` after the worktree summary and before the stop line.
- `missionBundleReadme(report, files)` adds:

```md
## Reviewer Replies

- Approve next slice: Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version.
- Request changes: Changes requested: address the review feedback first, update proof, then stop for another review.
- Review version candidate: Prepare a version-candidate review only. Do not publish, deploy, push, merge, or bump the version.
```

Keep the existing `review-gate.md`, `task-card.md`, and `runbook.md` rendering unchanged.

## Tests

- CLI default output: `projscan start --intent "<goal>" --quiet` contains `Reviewer Replies` and the three reply strings near the review gate.
- CLI bundle: saved `README.md` contains `## Reviewer Replies` and all three reply strings.
- JSON output stays unchanged except for the existing public `reviewGate.decisions[*].reply` field from the previous slice.

## Docs And Screenshots

Update README and GUIDE to say the default console review gate and saved bundle quickstart show reviewer replies. Add a CHANGELOG entry under `Unreleased`.

The existing README screenshot already shows a review-gate reply line. Run `npm run docs:screenshots`; keep image changes only if the generated assets differ.

## Out Of Scope

- New CLI flags.
- New bundle files.
- Changes to review-gate Markdown, task-card Markdown, runbook Markdown, MCP output, or release behavior.
- Release, publish, deploy, push, merge, or version bump.

## Stop Point

After tests, docs, screenshots, verification, and a local commit, stop for review.
