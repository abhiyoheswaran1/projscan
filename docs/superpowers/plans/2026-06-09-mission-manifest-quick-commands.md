# Mission Manifest Quick Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured quick commands to saved mission bundle manifests so agents can run, inspect, and review a bundle without parsing README Markdown.

**Architecture:** `writeMissionBundle()` will populate a new `quickCommands` array on the existing manifest object. A helper will return the same three commands documented in the generated README.

**Tech Stack:** TypeScript, Node `fs/promises`, Vitest, Markdown docs.

---

## File Structure

- Modify `tests/cli/start.test.ts`: assert saved manifest and JSON CLI output expose `quickCommands`.
- Modify `src/cli/commands/start.ts`: add the manifest quick-command type, helper, and manifest field.
- Modify `README.md`: document that `manifest.json` exposes quick commands for JSON clients.
- Modify `CHANGELOG.md`: add an unreleased bullet.

## Task 1: Red Tests

- [ ] **Step 1: Add saved manifest assertions**

In `tests/cli/start.test.ts`, after `expect(manifest.directory).toBe(await fs.realpath(bundleDir));`, add:

```ts
expect(manifest.quickCommands).toEqual([
  {
    id: 'run',
    command: './mission.sh',
    description: 'Run the current command and remaining proof.',
  },
  {
    id: 'status',
    command: './status.sh',
    description: 'Print the latest mission state and next action.',
  },
  {
    id: 'review',
    command: './review.sh',
    description: 'Print the review packet for approval.',
  },
]);
```

- [ ] **Step 2: Add JSON save assertions**

In `start reports the Mission Control bundle as JSON when save-mission uses JSON format`, after the directory assertion, add:

```ts
expect(payload.missionBundle.quickCommands.map((entry: { id: string }) => entry.id)).toEqual([
  'run',
  'status',
  'review',
]);
expect(payload.missionBundle.quickCommands.map((entry: { command: string }) => entry.command)).toEqual([
  './mission.sh',
  './status.sh',
  './review.sh',
]);
```

- [ ] **Step 3: Run focused test and verify red**

Run:

```bash
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because `quickCommands` is not present on the manifest yet.

## Task 2: Manifest Generation

- [ ] **Step 1: Add quick-command type**

In `src/cli/commands/start.ts`, add:

```ts
interface MissionBundleQuickCommand {
  id: 'run' | 'status' | 'review';
  command: './mission.sh' | './status.sh' | './review.sh';
  description: string;
}
```

- [ ] **Step 2: Add manifest field**

In `MissionBundleManifest`, add:

```ts
quickCommands: MissionBundleQuickCommand[];
```

- [ ] **Step 3: Populate manifest field**

In the manifest object inside `writeMissionBundle()`, add:

```ts
quickCommands: missionBundleQuickCommands(),
```

- [ ] **Step 4: Add helper**

Near `missionBundleFiles()`, add:

```ts
function missionBundleQuickCommands(): MissionBundleQuickCommand[] {
  return [
    {
      id: 'run',
      command: './mission.sh',
      description: 'Run the current command and remaining proof.',
    },
    {
      id: 'status',
      command: './status.sh',
      description: 'Print the latest mission state and next action.',
    },
    {
      id: 'review',
      command: './review.sh',
      description: 'Print the review packet for approval.',
    },
  ];
}
```

- [ ] **Step 5: Run focused test and verify green**

Run:

```bash
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: focused start tests pass.

## Task 3: Docs

- [ ] **Step 1: Update README**

In `README.md`, update the saved bundle paragraph to include:

```md
`manifest.json` exposes the same quick commands under `quickCommands` for agents and JSON clients.
```

- [ ] **Step 2: Update changelog**

In `CHANGELOG.md`, add:

```md
- Added `quickCommands` to saved mission bundle manifests so agents can read the `./mission.sh`, `./status.sh`, and `./review.sh` workflow without parsing README Markdown.
```

- [ ] **Step 3: Run docs screenshot generation**

Run:

```bash
npm run docs:screenshots
```

Expected: screenshot generation exits `0`. Image files may remain unchanged.

## Task 4: Verification and Commit

- [ ] **Step 1: Build and focused test**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: both exit `0`.

- [ ] **Step 2: Quality gates**

Run:

```bash
npm run lint
git diff --check
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

Expected: all exit `0`.

- [ ] **Step 3: Direct manifest smoke**

Run:

```bash
tmpdir=$(mktemp -d)
node dist/cli/index.js start --intent 'what breaks if I rename the auth token loader' --save-mission "$tmpdir/mission" --format json --quiet >/tmp/projscan-manifest-quick-commands-smoke.json
node -e 'const fs=require("node:fs"); const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if (payload.missionBundle.quickCommands.map(c => c.command).join(",") !== "./mission.sh,./status.sh,./review.sh") process.exit(1);' /tmp/projscan-manifest-quick-commands-smoke.json
node -e 'const fs=require("node:fs"); const manifest=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if (manifest.quickCommands.map(c => c.id).join(",") !== "run,status,review") process.exit(1);' "$tmpdir/mission/manifest.json"
rm -rf "$tmpdir"
rm -f /tmp/projscan-manifest-quick-commands-smoke.json
```

Expected: JSON output and saved manifest both expose the structured quick commands.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md CHANGELOG.md
git commit -m "feat: add mission manifest quick commands"
```

Expected: commit succeeds. Do not release, publish, deploy, push, merge, or bump the version.

## Self-Review

- The plan covers every design requirement.
- The tests verify saved manifest JSON and CLI JSON output.
- The implementation does not change existing file list or console output.
- The verification plan includes focused tests, full tests, docs screenshots, packed install smoke, and direct manifest smoke.
