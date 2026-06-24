# Executed Proof Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `projscan prove --run -- <command...>` so projscan can execute a local proof command and write trusted Proof Ledger evidence.

**Architecture:** Reuse the existing Proof Ledger and receipt replay code. Add one safe execution adapter in `src/core/prove.ts`, expose it through the CLI, and keep MCP read-only for command execution.

**Tech Stack:** TypeScript, Node.js `child_process.spawn`, Vitest, AgentLoopKit.

---

## File Structure

- Modify `src/types/proofLedger.ts` to add the `prove-run` source.
- Modify `src/types/prove.ts` to add run mode and executed proof metadata where needed.
- Modify `src/core/prove.ts` to validate run mode, execute the command vector with `shell: false`, write redacted logs, and append a ledger row.
- Modify `src/cli/commands/prove.ts` to parse `--run -- <command...>` and render executed proof rows.
- Modify `tests/core/prove.test.ts`, `tests/cli/prove.test.ts`, and `tests/docs/proveDocs.test.ts`.
- Modify `README.md`, `docs/GUIDE.md`, `docs/STABILITY.md`, `docs/WEBSITE-UPDATE-PROMPT.md`, and `DECISIONS.md`.

## Task 1: Core Executed Proof Tests

- [ ] **Step 1: Write failing tests**

Add tests to `tests/core/prove.test.ts`:

```ts
test('runs a proof command and records executed ledger evidence', async () => {
  await fs.writeFile(path.join(tmp, 'src/core/bugHunt.ts'), 'export const changed = true;\n');

  const report = await computeProve(tmp, {
    runCommand: [process.execPath, '-e', 'console.log("token=secret-value"); process.exit(0);'],
  } as never);

  expect(report.mode).toBe('run');
  expect(report.ledgerRecord?.source).toBe('prove-run');
  expect(report.ledgerRecord?.status).toBe('passed');
  expect(report.ledgerRecord?.changedFiles).toContain('src/core/bugHunt.ts');
  expect(report.ledgerRecord?.logPath).toMatch(/^\.projscan\/proof-logs\//);
  expect(report.ledgerRecord?.outputSummary).toContain('[redacted]');
  expect(report.ledgerRecord?.outputSummary).not.toContain('secret-value');
});
```

- [ ] **Step 2: Verify red**

Run:

```bash
npm test -- tests/core/prove.test.ts
```

Expected: fail because `runCommand` and mode `run` are not implemented.

## Task 2: Core Implementation

- [ ] **Step 1: Implement minimal core path**

Add `runCommand?: string[]` and `runTimeoutMs?: number` to `ComputeProveOptions`, add `prove-run` to the ledger source type, and implement `computeRunProof`.

- [ ] **Step 2: Keep execution safe**

Use `spawn(command[0], command.slice(1), { cwd: rootPath, shell: false })`. Capture bounded stdout and stderr, write a redacted log under `.projscan/proof-logs/`, and append the Proof Ledger row with source `prove-run`.

- [ ] **Step 3: Verify green**

Run:

```bash
npm test -- tests/core/prove.test.ts
```

Expected: pass.

## Task 3: CLI Delimiter

- [ ] **Step 1: Write failing CLI test**

Add a test to `tests/cli/prove.test.ts` that calls:

```ts
await runCli([
  'prove',
  '--run',
  '--',
  process.execPath,
  '-e',
  'console.log("ok");',
  '--format',
  'json',
  '--quiet',
]);
```

Expected JSON mode `run` and ledger source `prove-run`.

- [ ] **Step 2: Implement CLI parsing**

Use commander passthrough options for `prove`, collect args after `--run --`, and pass them to `computeProve` as `runCommand`.

- [ ] **Step 3: Verify**

Run:

```bash
npm test -- tests/cli/prove.test.ts
```

Expected: pass.

## Task 4: Docs and Public Surface

- [ ] **Step 1: Update docs**

Update README and GUIDE to prefer `projscan prove --run -- <command...>` for local proof and keep `--record-command` for imported evidence.

- [ ] **Step 2: Update stability and decisions**

Add `--run` and `--run-timeout-ms` to documented flags and record the architecture decision.

- [ ] **Step 3: Stop-slop review**

Remove inflated claims, keep the copy concrete, and state that `--run` executes local commands.

- [ ] **Step 4: Verify docs tests**

Run:

```bash
npm test -- tests/docs/proveDocs.test.ts
```

Expected: pass.

## Task 5: Verification Loop

- [ ] **Step 1: Focused verification**

Run:

```bash
npm test -- tests/core/prove.test.ts tests/cli/prove.test.ts tests/docs/proveDocs.test.ts
```

- [ ] **Step 2: Static checks**

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

- [ ] **Step 3: Security pass**

Run:

```bash
npm run security:release-gate
rg -n "shell:\\s*true|exec\\(|execFile\\(|\\.arg\\(\"-c\"\\)|sh -c" src/core/prove.ts src/cli/commands/prove.ts
```

Expected: no unsafe shell execution.

- [ ] **Step 4: Performance pass**

Measure `prove --run -- node -e "process.exit(0)"` and compare against `prove --record-command` for rough overhead. The command itself dominates runtime; projscan should add only bounded ledger/log work.

- [ ] **Step 5: AgentLoop evidence**

Run:

```bash
npm exec agentloop -- verify --task .agentloop/tasks/2026-06-24-executed-proof-runner.md --task-commands --only-task-commands --write-run
npm exec agentloop -- check-gates
npm exec agentloop -- ship
```

Expected: pass or report any remaining blocker.
