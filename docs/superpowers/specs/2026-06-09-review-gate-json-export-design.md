# Review Gate JSON Export Design

## Context

Mission Control now builds a structured `missionControl.reviewGate` object with stop condition, checklist, review policy, done criteria, proof queue, evidence commands, worktree evidence, reviewer decisions, and Markdown.

Saved mission bundles expose the human-facing gate as `review-gate.md` and the policy subset as `review-policy.json`. A machine client that needs the full review packet still has to parse `handoff.json`, even when it only wants review state.

## Goal

Add a compact machine-readable review gate export:

- `projscan start --review-gate-json --intent "<goal>"` prints only `missionControl.reviewGate` as compact JSON.
- Saved mission bundles include `review-gate.json`.
- The bundle README, manifest, and shortcut index list the new review-gate JSON artifact.

## Approaches

### Recommended: full review gate JSON export

Reuse `missionControl.reviewGate` as the source of truth. Print compact JSON for the CLI shortcut and pretty JSON in saved bundles.

This gives agents one review packet containing policy, proof, worktree evidence, done criteria, and reviewer decisions without requiring the larger handoff object.

### Alternative: separate `review-proof.json` and `review-worktree.json`

Separate files keep each artifact small, but a reviewer usually needs proof and worktree evidence together. Splitting them would add more bundle files before there is a clear consumer need.

### Alternative: require `handoff.json`

`handoff.json` already contains the review gate, but it also contains resume state, primary action, ready actions, and unresolved inputs. A smaller review-specific object reduces parsing work and avoids exposing unrelated execution state to review-only tools.

## Design

Add a Commander option:

```ts
.option('--review-gate-json', 'print only the Mission Control review gate as JSON')
```

Handle it near the existing review shortcuts:

```ts
if (cmdOpts.reviewGateJson === true) {
  printReviewGateJsonOnly(report);
  return;
}
```

`printReviewGateJsonOnly()` should print:

```ts
console.log(JSON.stringify(report.missionControl.reviewGate));
```

Saved bundles should write:

```text
review-gate.json
```

with pretty JSON and a trailing newline.

Update `missionBundleFiles()` so `manifest.json` and the bundle README include:

```text
review-gate.json: Machine-readable review gate with policy, proof, decisions, and worktree evidence.
```

Update the shortcut index to include `--review-gate-json` near `--review-gate`, `--review-policy`, and `--review-replies`.

## Tests

- CLI shortcut: `projscan start --review-gate-json --intent "<goal>" --quiet` prints exactly the compact review gate JSON plus newline and no broader start-report output. The JSON object still includes the review gate `markdown` field because it is part of `missionControl.reviewGate`.
- Saved bundle: `review-gate.json` exists, matches `handoff.reviewGate`, and appears in stdout, README, and manifest.
- JSON bundle mode: the returned manifest file list includes `review-gate.json`.
- Shortcut index: `--shortcuts` includes `projscan start --review-gate-json ...`.

## Docs And Screenshots

Update README, GUIDE, and CHANGELOG for `--review-gate-json` and `review-gate.json`. Run `npm run docs:screenshots`; keep generated image changes only if the capture script changes assets.

## Out Of Scope

- New review gate fields.
- Changes to MCP schemas.
- Runtime blocking of commands.
- Release, publish, deploy, push, merge, or version bump.

## Stop Point

After tests, docs, screenshots, verification, and a local commit, stop for review.
