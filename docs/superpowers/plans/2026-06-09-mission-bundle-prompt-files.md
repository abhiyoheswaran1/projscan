# Mission Bundle Prompt Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add standalone prompt files to saved Mission Control bundles.

**Architecture:** Reuse the existing `writeMissionBundle` flow in `src/cli/commands/start.ts`. Write the two text files from `report.missionControl.handoffPrompt` and `report.missionControl.resume.prompt`, then list them through the existing `missionBundleFiles` manifest source.

**Tech Stack:** TypeScript, Node `fs/promises`, Vitest, Markdown docs, existing Playwright screenshot script.

---

## File Structure

- Modify `tests/cli/start.test.ts`: extend saved bundle tests for prompt files.
- Modify `src/cli/commands/start.ts`: write prompt files and add manifest entries.
- Modify `README.md`: mention prompt files in the saved bundle contents sentence.
- Modify `docs/GUIDE.md`: mention prompt files in the shortcut paragraph.
- Modify `CHANGELOG.md`: update the `--save-mission` bullet.
- Modify `docs/demos/projscan-4-1-demo.html`: update the screenshot source line.
- Regenerate `docs/projscan-mission-control.png` and `docs/projscan-proof-router.png`.

## Task 1: Bundle Prompt Tests

- [ ] **Step 1: Extend stdout assertions**

In `tests/cli/start.test.ts`, inside `start writes a Mission Control bundle when requested`, add:

```ts
expect(result.stdout).toContain('handoff-prompt.txt');
expect(result.stdout).toContain('resume-prompt.txt');
```

- [ ] **Step 2: Add prompt file assertions**

After the `next-tool-call.json` assertion, add:

```ts
const handoffPrompt = await fs.readFile(path.join(bundleDir, 'handoff-prompt.txt'), 'utf-8');
expect(handoffPrompt).toContain('Resume: Resume at ready-1 in ready_now');
expect(handoffPrompt).toContain('Ready proof: Ready-to-run proof commands');
expect(handoffPrompt.endsWith('\n')).toBe(true);

const resumePrompt = await fs.readFile(path.join(bundleDir, 'resume-prompt.txt'), 'utf-8');
expect(resumePrompt).toBe(
  'Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file).\n',
);
```

- [ ] **Step 3: Extend README and manifest assertions**

Add README assertions:

```ts
expect(quickstart).toContain('- `handoff-prompt.txt`: Copyable prompt for handing this mission to another agent.');
expect(quickstart).toContain('- `resume-prompt.txt`: Focused prompt for resuming the current cursor.');
```

Change the manifest expected order to:

```ts
expect(manifest.files.map((file: { name: string }) => file.name)).toEqual([
  'README.md',
  'next-command.txt',
  'next-tool-call.json',
  'handoff-prompt.txt',
  'resume-prompt.txt',
  'runbook.md',
  'handoff.json',
  'resume.json',
  'ready-tool-calls.json',
  'proof-commands.txt',
  'manifest.json',
]);
```

- [ ] **Step 4: Extend JSON write-report assertion**

Change the array-containing assertion to include:

```ts
'handoff-prompt.txt',
'resume-prompt.txt',
```

- [ ] **Step 5: Run the red test**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|save-mission" --test-timeout 60000 --hook-timeout 60000
```

Expected: FAIL because the prompt files do not exist and the manifest omits them.

## Task 2: Bundle Prompt Implementation

- [ ] **Step 1: Write prompt files**

In `writeMissionBundle`, after `next-tool-call.json`, add:

```ts
await fs.writeFile(
  path.join(targetDir, 'handoff-prompt.txt'),
  report.missionControl.handoffPrompt.trimEnd() + '\n',
  'utf-8',
);
await fs.writeFile(
  path.join(targetDir, 'resume-prompt.txt'),
  report.missionControl.resume.prompt.trimEnd() + '\n',
  'utf-8',
);
```

- [ ] **Step 2: Add manifest entries**

In `missionBundleFiles`, after `next-tool-call.json`, add:

```ts
{
  name: 'handoff-prompt.txt',
  path: path.join(targetDir, 'handoff-prompt.txt'),
  description: 'Copyable prompt for handing this mission to another agent.',
},
{
  name: 'resume-prompt.txt',
  path: path.join(targetDir, 'resume-prompt.txt'),
  description: 'Focused prompt for resuming the current cursor.',
},
```

- [ ] **Step 3: Run the green focused test**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|save-mission" --test-timeout 60000 --hook-timeout 60000
```

Expected: PASS.

## Task 3: Docs And Screenshots

- [ ] **Step 1: Update README**

Change the saved bundle contents sentence to include:

```md
`handoff-prompt.txt`, `resume-prompt.txt`
```

- [ ] **Step 2: Update guide**

Update the bundle sentence to name `handoff-prompt.txt` and `resume-prompt.txt`.

- [ ] **Step 3: Update changelog**

Update the `--save-mission` bullet so it mentions copyable handoff and resume prompt files.

- [ ] **Step 4: Update demo HTML**

Change the dim line to:

```html
<span class="line dim">writes README.md, prompts, next-step files</span>
```

- [ ] **Step 5: Regenerate and inspect screenshots**

Run:

```bash
npm run docs:screenshots
```

Inspect:

```bash
open docs/projscan-mission-control.png
open docs/projscan-proof-router.png
```

## Task 4: Verification And Commit

- [ ] **Step 1: Build**

Run:

```bash
npm run build
```

- [ ] **Step 2: Run focused start suites**

Run:

```bash
npx vitest run tests/cli/start.test.ts tests/core/start.test.ts tests/mcp/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

- [ ] **Step 3: Run lint and diff checks**

Run:

```bash
npm run lint
git diff --check
```

- [ ] **Step 4: Smoke prompt files**

Run:

```bash
tmpdir=$(mktemp -d)
node dist/cli/index.js start --intent "what breaks if I rename the auth token loader" --save-mission "$tmpdir/mission" --quiet
cat "$tmpdir/mission/handoff-prompt.txt"
cat "$tmpdir/mission/resume-prompt.txt"
rm -rf "$tmpdir"
```

- [ ] **Step 5: Run broader guards**

Run:

```bash
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

- [ ] **Step 6: Review and commit**

Run:

```bash
git status --short
git diff --stat
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md docs/GUIDE.md CHANGELOG.md docs/demos/projscan-4-1-demo.html docs/projscan-mission-control.png docs/projscan-proof-router.png
git commit -m "feat: add mission bundle prompt files"
```

## Self-Review

- The plan covers tests, implementation, docs, screenshots, and verification.
- The files derive from existing prompt fields.
- Existing bundle files remain unchanged.
- No placeholders remain.
