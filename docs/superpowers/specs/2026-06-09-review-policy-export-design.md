# Review Policy Export Design

## Context

Mission Control now attaches a structured `missionControl.reviewGate.policy` object to the review gate and handoff JSON. It lists the actions blocked until explicit reviewer approval: another slice, release, publish, deploy, push, merge, and version bump.

Saved mission bundles still make machine clients open the larger `handoff.json` file to read that policy. The reviewer reply text has a small plain-text artifact, but the enforcement policy does not have an equivalent small JSON artifact.

## Goal

Add a compact machine-readable review policy export:

- `projscan start --review-policy --intent "<goal>"` prints only `missionControl.reviewGate.policy` as compact JSON.
- Saved mission bundles include `review-policy.json`.
- The bundle README, manifest, and shortcut index list the new policy artifact.

## Approaches

### Recommended: policy-only JSON export

Reuse `missionControl.reviewGate.policy` without reshaping it. Print compact JSON for the CLI shortcut and pretty JSON in saved bundles.

This gives agents and scripts a small policy file while keeping the existing review gate as the source of truth.

### Alternative: embed policy in `review-replies.txt`

Plain text is useful for humans, but agents need stable keys. Mixing policy JSON into a text reply file would make both consumers worse.

### Alternative: require `handoff.json`

`handoff.json` already works, but it is a larger transfer object. Small files matter in agent handoffs because they reduce parsing and reduce the chance that a client reads more state than it needs.

## Design

Add a Commander option:

```ts
.option('--review-policy', 'print only the Mission Control review policy as JSON')
```

Handle it near the existing review shortcuts:

```ts
if (cmdOpts.reviewPolicy === true) {
  printReviewPolicyOnly(report);
  return;
}
```

`printReviewPolicyOnly()` should print:

```ts
console.log(JSON.stringify(report.missionControl.reviewGate.policy));
```

Saved bundles should write:

```ts
review - policy.json;
```

with pretty JSON and a trailing newline.

Update `missionBundleFiles()` so `manifest.json` and the bundle README include:

```text
review-policy.json: Machine-readable review approval boundary and blocked actions.
```

Update the shortcut index to include `--review-policy` near `--review-gate` and `--review-replies`.

## Tests

- CLI shortcut: `projscan start --review-policy --intent "<goal>" --quiet` prints exactly the compact policy JSON plus newline and no broader Mission Control output.
- Saved bundle: `review-policy.json` exists, matches `handoff.reviewGate.policy`, and appears in stdout, README, and manifest.
- JSON bundle mode: the returned manifest file list includes `review-policy.json`.
- Shortcut index: `--shortcuts` includes `projscan start --review-policy ...`.

## Docs And Screenshots

Update README, GUIDE, and CHANGELOG for `--review-policy` and `review-policy.json`. Run `npm run docs:screenshots`; keep generated image changes only if the capture script changes assets.

## Out Of Scope

- New policy fields.
- Runtime blocking of commands.
- Changes to MCP schemas.
- Release, publish, deploy, push, merge, or version bump.

## Stop Point

After tests, docs, screenshots, verification, and a local commit, stop for review.
