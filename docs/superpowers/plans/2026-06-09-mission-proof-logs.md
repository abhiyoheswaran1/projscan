# Mission Proof Logs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make saved `mission.sh` bundles write current-command and proof-command output into `proof-logs/`.

**Architecture:** Extend the existing script renderer in `src/cli/commands/start.ts` with an optional `proofLogs` mode used only by `writeMissionBundle()`. Keep console `--mission-script` unchanged. Add a generated `proof-logs/README.md` bundle file that lists expected logs and commands.

**Tech Stack:** TypeScript, Commander, Vitest, Markdown docs, existing docs screenshot command.

---

## File Structure

- Modify `tests/cli/start.test.ts`: add red assertions for saved `mission.sh` proof-log setup and `proof-logs/README.md`, plus a console shortcut assertion that log mode is off by default.
- Modify `src/cli/commands/start.ts`: add `MissionScriptOptions`, proof-log script rendering, proof-log README generation, bundle directory creation, and manifest entry.
- Modify `README.md`: mention `proof-logs/README.md` and runtime logs in saved mission bundles.
- Modify `docs/GUIDE.md`: explain that saved `mission.sh` logs current/proof command output.
- Modify `CHANGELOG.md`: add an Unreleased bullet.
- Run `npm run docs:screenshots`; no image diff is expected unless docs HTML changes.

### Task 1: Add Red Tests

- [ ] **Step 1: Extend saved bundle assertions**

In `tests/cli/start.test.ts`, inside `start writes a Mission Control bundle when requested`, add:

```ts
expect(result.stdout).toContain('proof-logs/README.md');
expect(quickstart).toContain('- `proof-logs/README.md`: Proof-log index for output written by mission.sh.');
const proofLogReadme = await fs.readFile(path.join(bundleDir, 'proof-logs', 'README.md'), 'utf-8');
expect(proofLogReadme).toContain('# Mission Proof Logs');
expect(proofLogReadme).toContain('- `current-ready-1.log`: `projscan search "auth token loader" --format json`');
expect(proofLogReadme).toContain('- `proof-1.log`: `projscan preflight --mode before_edit --format json`');
expect(missionScript).toContain('MISSION_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)');
expect(missionScript).toContain('PROOF_LOG_DIR="${MISSION_DIR}/proof-logs"');
expect(missionScript).toContain('mkdir -p "$PROOF_LOG_DIR"');
expect(missionScript).toContain('> "$PROOF_LOG_DIR/current-ready-1.log" 2>&1');
expect(missionScript).toContain('> "$PROOF_LOG_DIR/proof-1.log" 2>&1');
expect(manifest.files.map((file: { name: string }) => file.name)).toContain('proof-logs/README.md');
```

- [ ] **Step 2: Assert console script stays plain**

In `start prints a mission shell script when requested`, add:

```ts
expect(result.stdout).not.toContain('PROOF_LOG_DIR');
expect(result.stdout).not.toContain('> "$PROOF_LOG_DIR/');
```

- [ ] **Step 3: Run red tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|mission shell script" --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because `proof-logs/README.md` and script log redirections do not exist.

### Task 2: Implement Proof Logs

- [ ] **Step 1: Add renderer options**

In `src/cli/commands/start.ts`, add:

```ts
interface MissionScriptOptions {
  proofLogs?: boolean;
}
```

Change `buildMissionScript(report)` to `buildMissionScript(report, options = {})`.

- [ ] **Step 2: Render proof-log setup**

When `options.proofLogs === true` and the command set is safe, add:

```ts
'MISSION_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)',
'PROOF_LOG_DIR="${MISSION_DIR}/proof-logs"',
'mkdir -p "$PROOF_LOG_DIR"',
scriptPrintDoubleQuoted('Proof logs: ${PROOF_LOG_DIR}'),
scriptPrint(''),
```

Use direct script lines for variable expansion. Do not pass these lines through `scriptPrint()`.

- [ ] **Step 3: Redirect commands in proof-log mode**

Add helpers:

```ts
function scriptCommandBlock(label: string, command: string, logName: string | undefined): string[] {
  if (!logName) return [scriptPrint(label), command];
  return [
    scriptPrint(label),
    scriptPrint(`Writing ${logName}`),
    '{',
    `  ${command}`,
    `} > "$PROOF_LOG_DIR/${logName}" 2>&1`,
  ];
}
```

Use `current-${cursor.stepId}.log` for the cursor and `proof-${index + 1}.log` for proof commands.

- [ ] **Step 4: Write proof-log README and bundle entry**

In `writeMissionBundle()`, create `proof-logs/`, write `proof-logs/README.md`, and call `buildMissionScript(report, { proofLogs: true })` for saved `mission.sh`.

Add a manifest entry:

```ts
{
  name: 'proof-logs/README.md',
  path: path.join(targetDir, 'proof-logs', 'README.md'),
  description: 'Proof-log index for output written by mission.sh.',
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|mission shell script|shell expansion" --test-timeout 60000 --hook-timeout 60000
```

Expected: pass.

### Task 3: Docs And Screenshots

- [ ] **Step 1: Update docs**

Update README, GUIDE, and CHANGELOG with proof-log copy.

- [ ] **Step 2: Stop-slop review**

Cut vague phrases. The docs should say that saved `mission.sh` writes logs under `proof-logs/`.

- [ ] **Step 3: Regenerate screenshots**

Run:

```bash
npm run docs:screenshots
```

Expected: exit 0. If PNGs do not change, leave them untouched.

### Task 4: Verify And Commit

- [ ] **Step 1: Run focused verification**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: exit 0 for both.

- [ ] **Step 2: Run full verification**

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

Expected: each command exits 0. Known plugin-trust and HuggingFace 429 fallback warnings are acceptable when exit code is 0.

- [ ] **Step 3: Commit**

Commit with:

```bash
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md docs/GUIDE.md CHANGELOG.md
git commit -m "feat: log mission proof output"
```

## Self-Review

- The plan covers saved-bundle proof logs, plain console scripts, unsafe-command behavior, docs, screenshots, and verification.
- No release, publish, deploy, push, merge, or version bump work is included.
