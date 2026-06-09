# Mission Proof Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `proof-logs/status.jsonl` to saved Mission Control bundles and have saved `mission.sh` write command exit status rows while it runs.

**Architecture:** Extend the existing saved-bundle proof-log mode in `src/cli/commands/start.ts`. Keep console `--mission-script` unchanged. Render inline POSIX shell blocks that run each command, capture `$?`, append a JSONL row, and exit on failure.

**Tech Stack:** TypeScript, Commander, Vitest, POSIX shell script output, Markdown docs.

---

## File Structure

- Modify `tests/cli/start.test.ts`: add red assertions for `proof-logs/status.jsonl`, script status-file setup, JSONL append lines, and unchanged console script behavior.
- Modify `src/cli/commands/start.ts`: write empty `proof-logs/status.jsonl`, list it in the bundle manifest, update proof-log README copy, and enhance proof-log script blocks.
- Modify `README.md`: mention `proof-logs/status.jsonl`.
- Modify `docs/GUIDE.md`: tell users that saved `mission.sh` writes log files plus status rows.
- Modify `CHANGELOG.md`: add an Unreleased bullet.
- Run `npm run docs:screenshots`; no image diff should remain unless the screenshot source changes.

### Task 1: Add Red Tests

- [ ] **Step 1: Extend bundle file assertions**

In `tests/cli/start.test.ts`, inside `start writes a Mission Control bundle when requested`, add assertions:

```ts
expect(result.stdout).toContain('proof-logs/status.jsonl');
expect(quickstart).toContain('- `proof-logs/status.jsonl`: Runtime status rows written by mission.sh.');
const proofStatus = await fs.readFile(path.join(bundleDir, 'proof-logs', 'status.jsonl'), 'utf-8');
expect(proofStatus).toBe('');
expect(proofLogReadme).toContain('Read `status.jsonl` for command exit codes after `mission.sh` runs.');
expect(manifest.files.map((file: { name: string }) => file.name)).toContain('proof-logs/status.jsonl');
```

- [ ] **Step 2: Add script status assertions**

In the same saved-bundle script assertions, add:

```ts
expect(missionScript).toContain('PROOF_STATUS_FILE="${PROOF_LOG_DIR}/status.jsonl"');
expect(missionScript).toContain(': > "$PROOF_STATUS_FILE"');
expect(missionScript).toContain('status=$?');
expect(missionScript).toContain('>> "$PROOF_STATUS_FILE"');
expect(missionScript).toContain('"id":"current-ready-1"');
expect(missionScript).toContain('"exitCode":');
expect(missionScript).toContain('exit "$status"');
```

- [ ] **Step 3: Keep console script plain**

In `start prints a mission shell script when requested`, assert:

```ts
expect(result.stdout).not.toContain('PROOF_STATUS_FILE');
expect(result.stdout).not.toContain('status=$?');
```

- [ ] **Step 4: Run red tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|mission shell script" --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because `status.jsonl` and script status rows do not exist yet.

### Task 2: Implement Status Tracking

- [ ] **Step 1: Create and list status file**

In `writeMissionBundle()`, write an empty `proof-logs/status.jsonl` file after creating `proof-logs/`.

Add a `missionBundleFiles()` entry:

```ts
{
  name: 'proof-logs/status.jsonl',
  path: path.join(targetDir, 'proof-logs', 'status.jsonl'),
  description: 'Runtime status rows written by mission.sh.',
}
```

- [ ] **Step 2: Update proof-log README**

In `missionProofLogsReadme()`, add:

```ts
'Read `status.jsonl` for command exit codes after `mission.sh` runs.',
```

- [ ] **Step 3: Add status setup to proof-log script mode**

In `buildMissionScript()` proof-log setup, add:

```ts
'PROOF_STATUS_FILE="${PROOF_LOG_DIR}/status.jsonl"',
': > "$PROOF_STATUS_FILE"',
```

- [ ] **Step 4: Append JSONL rows from command blocks**

Change `scriptCommandBlock()` so log mode renders:

```sh
printf '%s\n' 'Run current command'
printf '%s\n' 'Writing proof-logs/current-ready-1.log'
set +e
{
  projscan search "auth token loader" --format json
} > "$PROOF_LOG_DIR/current-ready-1.log" 2>&1
status=$?
set -e
printf '%s%s%s\n' '{"id":"current-ready-1","label":"Run current command","log":"current-ready-1.log","command":"projscan search \"auth token loader\" --format json","exitCode":' "$status" '}' >> "$PROOF_STATUS_FILE"
if [ "$status" -ne 0 ]; then
  printf '%s\n' 'Command failed. See proof-logs/current-ready-1.log.' >&2
  exit "$status"
fi
```

Implement helpers for JSON string escaping and JSONL prefix rendering. Do not use `eval`.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|mission shell script|shell expansion" --test-timeout 60000 --hook-timeout 60000
```

Expected: pass.

### Task 3: Docs And Screenshots

- [ ] **Step 1: Update docs**

Update README, GUIDE, and CHANGELOG with `proof-logs/status.jsonl`.

- [ ] **Step 2: Stop-slop review**

Use direct wording: saved scripts write logs and status rows. Remove vague claims.

- [ ] **Step 3: Regenerate screenshots**

Run:

```bash
npm run docs:screenshots
```

Expected: exit 0. No PNG diff should remain.

### Task 4: Verify And Commit

- [ ] **Step 1: Run focused verification**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: both exit 0.

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

Expected: every command exits 0. Known plugin-trust and HuggingFace 429 fallback warnings are acceptable when exit code is 0.

- [ ] **Step 3: Commit**

Commit with:

```bash
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md docs/GUIDE.md CHANGELOG.md
git commit -m "feat: summarize mission proof status"
```

## Self-Review

- The plan covers bundle files, script behavior, docs, screenshot command, focused verification, and full gates.
- Console `--mission-script` remains unchanged.
- No release, publish, deploy, push, merge, or version bump work is included.
