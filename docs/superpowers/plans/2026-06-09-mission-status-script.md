# Mission Status Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an executable `status.sh` to saved Mission Control bundles so humans and CI wrappers can read mission state from `proof-logs/summary.json` with one command.

**Architecture:** The bundle writer creates `status.sh` beside `mission.sh`, lists it in the manifest, and marks it executable. The script locates its bundle directory, uses Node to parse `proof-logs/summary.json`, prints state and artifact pointers, and exits `0` for passed, `1` for failed, and `2` for not-run/running/unreadable summaries.

**Tech Stack:** TypeScript CLI command code, generated POSIX shell, Node for JSON parsing inside the generated script, Vitest CLI tests, Markdown docs.

---

## File Structure

- Modify `src/cli/commands/start.ts`
  - `writeMissionBundle()` writes `status.sh` and chmods it executable.
  - `missionBundleFiles()` lists `status.sh`.
  - Add `buildMissionStatusScript()` helper.
- Modify `tests/cli/start.test.ts`
  - Extend saved bundle file/README/manifest tests.
  - Execute generated `status.sh` against initial, passed, and failed summaries.
  - Keep console `--mission-script` expectations unchanged.
- Modify `README.md`, `docs/GUIDE.md`, and `CHANGELOG.md`
  - Mention `status.sh` next to `mission.sh` and `summary.json`.

## Task 1: Add Failing Tests

**Files:**
- Modify: `tests/cli/start.test.ts`

- [ ] **Step 0: Import direct process execution**

At the top of `tests/cli/start.test.ts`, add:

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
```

Below `const cliPath = ...`, add:

```ts
const execFileAsync = promisify(execFile);
```

- [ ] **Step 1: Add file presence expectations**

Inside `test('start writes a Mission Control bundle when requested', ...)`, add:

```ts
expect(result.stdout).toContain('status.sh');
expect(quickstart).toContain('- `status.sh`: Shell script that prints the latest mission run state from summary.json.');
```

- [ ] **Step 2: Read and assert script content**

After reading `missionScript`, add:

```ts
const statusScript = await fs.readFile(path.join(bundleDir, 'status.sh'), 'utf-8');
expect(statusScript.startsWith('#!/usr/bin/env sh\nset -eu\n')).toBe(true);
expect(statusScript).toContain('SUMMARY_FILE="${MISSION_DIR}/proof-logs/summary.json"');
expect(statusScript).toContain('Node.js is required to read proof-logs/summary.json.');
expect(statusScript).toContain('Mission status:');
expect(statusScript).toContain('Report:');
expect(statusScript).toContain('Status rows:');
expect(statusScript).toContain('Failed step:');
expect(statusScript).toContain('Exit code:');
expect(statusScript).toContain('Log:');
expect(statusScript).toContain('process.exitCode = status === "passed" ? 0 : status === "failed" ? 1 : 2;');
```

- [ ] **Step 3: Assert executable mode**

After reading `statusScript`, add:

```ts
const statusMode = (await fs.stat(path.join(bundleDir, 'status.sh'))).mode;
expect(statusMode & 0o111).not.toBe(0);
```

- [ ] **Step 4: Add script smoke helpers inside the saved bundle test**

After initial `proofSummary` assertions, add:

```ts
const initialStatus = await runScript(path.join(bundleDir, 'status.sh'), [], { cwd: bundleDir });
expect(initialStatus.exitCode).toBe(2);
expect(initialStatus.stdout).toContain('Mission status: not_run');
expect(initialStatus.stdout).toContain('Report: proof-logs/run-report.md');
expect(initialStatus.stdout).toContain('Status rows: proof-logs/status.jsonl');

await fs.writeFile(
  path.join(bundleDir, 'proof-logs', 'summary.json'),
  JSON.stringify({
    schemaVersion: 1,
    status: 'passed',
    report: 'proof-logs/run-report.md',
    statusRows: 'proof-logs/status.jsonl',
    totalCommands: 3,
  }) + '\n',
);
const passedStatus = await runScript(path.join(bundleDir, 'status.sh'), [], { cwd: bundleDir });
expect(passedStatus.exitCode).toBe(0);
expect(passedStatus.stdout).toContain('Mission status: passed');
expect(passedStatus.stdout).toContain('Total commands: 3');

await fs.writeFile(
  path.join(bundleDir, 'proof-logs', 'summary.json'),
  JSON.stringify({
    schemaVersion: 1,
    status: 'failed',
    report: 'proof-logs/run-report.md',
    statusRows: 'proof-logs/status.jsonl',
    failedStep: 'proof-1',
    exitCode: 7,
    log: 'proof-logs/proof-1.log',
  }) + '\n',
);
const failedStatus = await runScript(path.join(bundleDir, 'status.sh'), [], { cwd: bundleDir });
expect(failedStatus.exitCode).toBe(1);
expect(failedStatus.stdout).toContain('Mission status: failed');
expect(failedStatus.stdout).toContain('Failed step: proof-1');
expect(failedStatus.stdout).toContain('Exit code: 7');
expect(failedStatus.stdout).toContain('Log: proof-logs/proof-1.log');
```

- [ ] **Step 5: Update manifest and JSON bundle expectations**

Add `'status.sh'` after `'mission.sh'` in:

- exact `manifest.files.map(...).toEqual([...])`
- JSON save `expect.arrayContaining([...])`

- [ ] **Step 6: Add test helper**

Near the bottom of `tests/cli/start.test.ts`, add:

```ts
async function runScript(scriptPath: string, args: string[] = [], options: { cwd?: string } = {}) {
  try {
    const result = await execFileAsync(scriptPath, args, {
      cwd: options.cwd,
      env: process.env,
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: typeof e.code === 'number' ? e.code : 1,
    };
  }
}
```

- [ ] **Step 7: Run focused test and verify red**

Run:

```bash
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because `status.sh` is not generated yet.

## Task 2: Implement `status.sh`

**Files:**
- Modify: `src/cli/commands/start.ts`

- [ ] **Step 1: Write and chmod status script**

In `writeMissionBundle()`, after `mission.sh` is written and chmodded, add:

```ts
const statusScriptPath = path.join(targetDir, 'status.sh');
await fs.writeFile(statusScriptPath, buildMissionStatusScript(), 'utf-8');
await fs.chmod(statusScriptPath, 0o755).catch(() => undefined);
```

- [ ] **Step 2: List status script**

In `missionBundleFiles()`, add after `mission.sh`:

```ts
{
  name: 'status.sh',
  path: path.join(targetDir, 'status.sh'),
  description: 'Shell script that prints the latest mission run state from summary.json.',
},
```

- [ ] **Step 3: Add script builder**

Near `buildMissionScript()`, add:

```ts
function buildMissionStatusScript(): string {
  return [
    '#!/usr/bin/env sh',
    'set -eu',
    '',
    'MISSION_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)',
    'SUMMARY_FILE="${MISSION_DIR}/proof-logs/summary.json"',
    '',
    'if ! command -v node >/dev/null 2>&1; then',
    `  ${scriptPrintError('Node.js is required to read proof-logs/summary.json.')}`,
    '  exit 2',
    'fi',
    '',
    'node - "$SUMMARY_FILE" <<\\'NODE\\'',
    'const fs = require("node:fs");',
    'const summaryPath = process.argv[2];',
    'let summary;',
    'try {',
    '  summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));',
    '} catch (error) {',
    '  console.error(`Unable to read ${summaryPath}: ${error.message}`);',
    '  process.exit(2);',
    '}',
    'const status = typeof summary.status === "string" ? summary.status : "unknown";',
    'console.log(`Mission status: ${status}`);',
    'if (summary.report) console.log(`Report: ${summary.report}`);',
    'if (summary.statusRows) console.log(`Status rows: ${summary.statusRows}`);',
    'if (summary.totalCommands !== undefined) console.log(`Total commands: ${summary.totalCommands}`);',
    'if (summary.failedStep) console.log(`Failed step: ${summary.failedStep}`);',
    'if (summary.exitCode !== undefined) console.log(`Exit code: ${summary.exitCode}`);',
    'if (summary.log) console.log(`Log: ${summary.log}`);',
    'process.exitCode = status === "passed" ? 0 : status === "failed" ? 1 : 2;',
    'NODE',
    '',
  ].join('\\n');
}
```

Escape the heredoc lines correctly in TypeScript strings.

- [ ] **Step 4: Run focused test and verify green**

Run:

```bash
npm run build && npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: build exits 0 and all start tests pass.

## Task 3: Update Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update README**

In the saved mission bundle paragraph, add `status.sh` after `mission.sh`. Add:

```md
Run `./status.sh` from the bundle to print the latest mission state from `summary.json`; it exits `0` for passed, `1` for failed, and `2` for not-run/running states.
```

- [ ] **Step 2: Update GUIDE**

In the Mission Control saved bundle paragraph, add `status.sh` after `mission.sh`. Add:

```md
Bundle `status.sh` reads `summary.json` and uses exit codes `0`, `1`, and `2` for passed, failed, and not-ready states.
```

- [ ] **Step 3: Update CHANGELOG**

Under the current unreleased added list, add:

```md
- Added saved mission bundle `status.sh`, an executable status gate for `proof-logs/summary.json` with CI-friendly exit codes.
```

- [ ] **Step 4: Refresh screenshots**

Run:

```bash
npm run docs:screenshots
```

Expected: command exits 0. Include intended PNG diffs if any appear.

## Task 4: Verify and Commit

**Files:**
- Modified implementation, tests, and docs

- [ ] **Step 1: Run verification**

Run:

```bash
npm run build && npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
npm run lint
git diff --check
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

Expected: every command exits 0. Known non-fatal warnings may include untrusted example plugin notices and HuggingFace 429 semantic fallback.

- [ ] **Step 2: Direct generated script smoke**

Run a temporary bundle and check:

```bash
tmpdir=$(mktemp -d)
repo='/Users/abhyoh/local dev folder/Apps/projscan/.worktrees/super-product-devex'
printf '{"name":"fixture","version":"0.0.0","type":"module"}\n' > "$tmpdir/package.json"
printf '# fixture\n' > "$tmpdir/README.md"
mkdir -p "$tmpdir/src"
printf 'export const value = 1;\n' > "$tmpdir/src/index.ts"
(cd "$tmpdir" && node "$repo/dist/cli/index.js" start --intent 'what breaks if I rename the auth token loader' --save-mission artifacts/mission --quiet >/tmp/projscan-status-smoke.out)
sh -n "$tmpdir/artifacts/mission/status.sh"
"$tmpdir/artifacts/mission/status.sh"
rm -rf "$tmpdir"
rm -f /tmp/projscan-status-smoke.out
```

Expected: `sh -n` exits 0; `status.sh` exits 2 for the initial `not_run` state and prints `Mission status: not_run`.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md docs/GUIDE.md CHANGELOG.md
git commit -m "feat: add mission status script"
```

- [ ] **Step 4: Stop for review**

Run:

```bash
git status --short --branch
git log --oneline -10
git -C '/Users/abhyoh/local dev folder/Apps/projscan' status --short
```

Expected: feature worktree is clean. Main checkout still only shows `M docs/WEBSITE-UPDATE-PROMPT.md`.
