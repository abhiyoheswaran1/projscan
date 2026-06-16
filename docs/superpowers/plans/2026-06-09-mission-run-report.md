# Mission Run Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a saved Mission Control `proof-logs/run-report.md` that summarizes `mission.sh` execution for human review.

**Architecture:** Keep runtime artifacts under `proof-logs/`. The bundle writer creates an initial `run-report.md`; saved `mission.sh` refreshes it on each run and appends command rows plus review gate commands. Console `--mission-script` stays unchanged because report generation is only enabled through `buildMissionScript(report, { proofLogs: true })`.

**Tech Stack:** TypeScript CLI command code, Vitest CLI tests, Markdown docs.

---

## File Structure

- Modify `src/cli/commands/start.ts`
  - `writeMissionBundle()` creates `proof-logs/run-report.md`.
  - `missionBundleFiles()` lists `proof-logs/run-report.md`.
  - `buildMissionScript()` initializes `PROOF_REPORT_FILE`, writes a Markdown table, appends rows, appends failure notes, and appends the review gate.
  - New helpers produce initial report text and shell-safe report lines.
- Modify `tests/cli/start.test.ts`
  - Extend the saved bundle test and JSON bundle test.
  - Extend the console `--mission-script` test to prove report plumbing stays out.
- Modify `README.md`, `docs/GUIDE.md`, and `CHANGELOG.md`
  - Mention `proof-logs/run-report.md` next to existing proof logs and `status.jsonl`.

## Task 1: Add Failing Tests

**Files:**

- Modify: `tests/cli/start.test.ts`

- [ ] **Step 1: Update the saved bundle test expectations**

Add expectations inside `test('start writes a Mission Control bundle when requested', ...)`:

```ts
expect(result.stdout).toContain('proof-logs/run-report.md');
expect(quickstart).toContain(
  '- `proof-logs/run-report.md`: Human-readable run report refreshed by mission.sh.',
);
expect(missionScript).toContain('PROOF_REPORT_FILE="${PROOF_LOG_DIR}/run-report.md"');
expect(missionScript).toContain(': > "$PROOF_REPORT_FILE"');
expect(missionScript).toContain("printf '%s\\n' '# Mission Run Report'");
expect(missionScript).toContain("printf '%s\\n' '| Step | Label | Exit | Log |'");
expect(missionScript).toContain('>> "$PROOF_REPORT_FILE"');
expect(missionScript).toContain(
  "printf '| %s | %s | %s | %s |\\n' 'current-ready-1' 'Run current command' \"$status\" 'proof-logs/current-ready-1.log'",
);
expect(missionScript).toContain("printf '%s\\n' 'Mission stopped before completion.'");
expect(missionScript).toContain("printf '%s\\n' 'Run report: ${PROOF_REPORT_FILE}'");
expect(missionScript).toContain("printf '%s\\n' '## Review Gate'");
expect(missionScript).toContain("printf '%s\\n' '- git status --short'");
expect(missionScript).toContain("printf '%s\\n' '- git diff --stat'");

const proofRunReport = await fs.readFile(
  path.join(bundleDir, 'proof-logs', 'run-report.md'),
  'utf-8',
);
expect(proofRunReport).toContain('# Mission Run Report');
expect(proofRunReport).toContain(
  'Run `./mission.sh` to refresh this report with command exit codes and log links.',
);
expect(proofRunReport).toContain('Review `status.jsonl` for machine-readable status rows.');

expect(manifest.files.map((file: { name: string }) => file.name)).toEqual([
  'README.md',
  'next-command.txt',
  'next-tool-call.json',
  'handoff-prompt.txt',
  'resume-prompt.txt',
  'task-card.md',
  'review-gate.md',
  'review-gate.json',
  'review-policy.json',
  'review-replies.txt',
  'runbook.md',
  'handoff.json',
  'resume.json',
  'ready-tool-calls.json',
  'shortcuts.json',
  'mission.sh',
  'proof-logs/README.md',
  'proof-logs/status.jsonl',
  'proof-logs/run-report.md',
  'proof-commands.txt',
  'manifest.json',
]);
```

- [ ] **Step 2: Update the JSON bundle test**

Add this file to the `expect.arrayContaining([...])` list:

```ts
'proof-logs/run-report.md',
```

- [ ] **Step 3: Update the console script test**

Add expectations inside `test('start prints a mission shell script when requested', ...)`:

```ts
expect(result.stdout).not.toContain('PROOF_REPORT_FILE');
expect(result.stdout).not.toContain('run-report.md');
expect(result.stdout).not.toContain('Mission Run Report');
```

- [ ] **Step 4: Run the focused test and verify red**

Run:

```bash
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because `proof-logs/run-report.md` and `PROOF_REPORT_FILE` do not exist yet.

## Task 2: Implement Bundle Run Report

**Files:**

- Modify: `src/cli/commands/start.ts`

- [ ] **Step 1: Write the initial file**

In `writeMissionBundle()`, after writing `status.jsonl`, write:

```ts
await fs.writeFile(
  path.join(targetDir, 'proof-logs', 'run-report.md'),
  missionInitialRunReport(),
  'utf-8',
);
```

- [ ] **Step 2: List the file in the manifest**

In `missionBundleFiles()`, add after `proof-logs/status.jsonl`:

```ts
{
  name: 'proof-logs/run-report.md',
  path: path.join(targetDir, 'proof-logs', 'run-report.md'),
  description: 'Human-readable run report refreshed by mission.sh.',
},
```

- [ ] **Step 3: Add initial report helper**

Add:

```ts
function missionInitialRunReport(): string {
  return [
    '# Mission Run Report',
    '',
    'Run `./mission.sh` to refresh this report with command exit codes and log links.',
    'Review `status.jsonl` for machine-readable status rows.',
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Initialize report state in saved scripts**

In `buildMissionScript()`, inside the `if (proofLogs)` block, add:

```ts
'PROOF_REPORT_FILE="${PROOF_LOG_DIR}/run-report.md"',
': > "$PROOF_REPORT_FILE"',
...scriptInitRunReport(report),
scriptPrintExpanded('Run report: ${PROOF_REPORT_FILE}'),
```

Keep `: > "$PROOF_STATUS_FILE"` intact.

- [ ] **Step 5: Append command report rows**

In `scriptCommandBlock()`, after `scriptAppendStatusJsonl(...)`, add:

```ts
scriptAppendReportRow(logTarget.id, label, logTarget.logName),
```

In the failure branch, before `exit "$status"`, add:

```ts
...scriptAppendReportFailure(logTarget.id, logTarget.logName),
`  ${scriptPrintExpanded('Run report: ${PROOF_REPORT_FILE}')}`,
```

- [ ] **Step 6: Append final review gate**

At the end of `buildMissionScript()`, when `proofLogs` is true and all commands pass, append:

```ts
if (proofLogs) {
  lines.push(
    ...scriptAppendRunReportReviewGate(
      mission.reviewGate.stopCondition,
      mission.reviewGate.commands,
    ),
  );
}
```

Place this before the console review gate lines.

- [ ] **Step 7: Add shell helper functions**

Add helpers near `scriptAppendStatusJsonl()`:

```ts
function scriptInitRunReport(report: StartReport): string[] {
  const mission = report.missionControl;
  return [
    '{',
    `  ${scriptPrint('# Mission Run Report')}`,
    `  ${scriptPrint('')}`,
    ...(mission.intent ? [`  ${scriptPrint(`Intent: ${mission.intent}`)}`] : []),
    `  ${scriptPrint(`Mode: ${report.mode}`)}`,
    `  ${scriptPrint(`Status: ${mission.status}`)}`,
    `  ${scriptPrint(`Current step: ${mission.executionPlan.cursor.stepId} in ${mission.executionPlan.cursor.phaseId}`)}`,
    `  ${scriptPrint('')}`,
    `  ${scriptPrint('| Step | Label | Exit | Log |')}`,
    `  ${scriptPrint('| --- | --- | ---: | --- |')}`,
    '} >> "$PROOF_REPORT_FILE"',
  ];
}

function scriptAppendReportRow(id: string, label: string, logName: string): string {
  return `printf '| %s | %s | %s | %s |\\n' ${shellQuote(id)} ${shellQuote(label)} "$status" ${shellQuote(`proof-logs/${logName}`)} >> "$PROOF_REPORT_FILE"`;
}

function scriptAppendReportFailure(id: string, logName: string): string[] {
  return [
    '  {',
    `    ${scriptPrint('')}`,
    `    ${scriptPrint('Mission stopped before completion.')}`,
    `    ${scriptPrint(`Failed step: ${id}`)}`,
    `    ${scriptPrint(`Log: proof-logs/${logName}`)}`,
    '  } >> "$PROOF_REPORT_FILE"',
  ];
}

function scriptAppendRunReportReviewGate(stopCondition: string, commands: string[]): string[] {
  return [
    '{',
    `  ${scriptPrint('')}`,
    `  ${scriptPrint('## Review Gate')}`,
    `  ${scriptPrint(stopCondition)}`,
    ...commands.map((command) => `  ${scriptPrint(`- ${command}`)}`),
    '} >> "$PROOF_REPORT_FILE"',
  ];
}
```

- [ ] **Step 8: Run focused test and verify green**

Run:

```bash
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: all `tests/cli/start.test.ts` tests pass.

## Task 3: Update Docs

**Files:**

- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update README saved bundle copy**

Find the saved mission bundle paragraph and add `proof-logs/run-report.md` after `status.jsonl`. End with:

```md
Running saved `mission.sh` writes current and proof command output under `proof-logs/`, appends exit codes to `status.jsonl`, and refreshes `run-report.md` for review.
```

- [ ] **Step 2: Update guide saved bundle copy**

In the Mission Control usage paragraph, add `proof-logs/run-report.md` to the bundle list. End the proof-log sentence with:

```md
Saved `mission.sh` writes current-command and proof-command output under `proof-logs/`, appends exit-code rows to `status.jsonl`, and refreshes `run-report.md`, so reviewers can scan pass/fail proof before opening raw logs.
```

- [ ] **Step 3: Update changelog**

Under the current unreleased list, add:

```md
- Added saved mission bundle `proof-logs/run-report.md`; saved `mission.sh` now refreshes a Markdown pass/fail proof report with log links and review gate commands.
```

- [ ] **Step 4: Refresh README screenshots**

Run:

```bash
npm run docs:screenshots
```

Expected: command exits 0. Include any intended screenshot diffs in the implementation commit.

## Task 4: Verify and Commit

**Files:**

- Modified implementation, tests, and docs

- [ ] **Step 1: Run full verification**

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

Expected: all commands exit 0. Known non-fatal warnings may include untrusted example plugin notices and semantic fallback warnings.

- [ ] **Step 2: Commit implementation**

Run:

```bash
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md docs/GUIDE.md CHANGELOG.md
git commit -m "feat: write mission run reports"
```

- [ ] **Step 3: Stop for review**

Run:

```bash
git status --short --branch
git log --oneline -8
git -C '/Users/abhyoh/local dev folder/Apps/projscan' status --short
```

Expected: feature worktree is clean. Main checkout still shows only `M docs/WEBSITE-UPDATE-PROMPT.md`.
