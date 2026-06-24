# Executed Proof Runner Design

## Problem

`projscan prove --record-command` lets a caller add proof evidence, but the caller owns the truth of that record. A reviewer still has to ask whether the test actually ran, whether the exit code is accurate, and whether the output was captured after the current edit.

## Design

Add a CLI-only execution path:

```bash
projscan prove --run -- npm test -- tests/billing/retry.test.ts
```

The CLI treats every argument after `--run --` as the command vector. Core code executes that vector with `shell: false`, captures exit code and duration, writes a bounded redacted log under `.projscan/proof-logs/`, appends a Proof Ledger row with source `prove-run`, and returns the same record shape reviewers already see through `prove --changed`.

`projscan prove --record-command` remains for imported CI evidence and external proof results. `projscan_prove` over MCP does not execute commands in this slice.

## Data Flow

1. CLI validates that exactly one mode was selected.
2. `--run` requires a non-empty command vector after the delimiter.
3. Core gets changed files before executing the command.
4. Core spawns the command from the repo root without a shell.
5. Core captures bounded output, redacts it, writes a local log, and appends the ledger row.
6. `prove --changed` uses the existing ledger freshness logic to report passed, failed, missing, partial, or stale proof.

## Security

- Do not use shell strings, `sh -c`, `exec`, or `shell: true`.
- Do not expose command execution through MCP.
- Redact output summaries and logs before writing.
- Keep proof logs inside `.projscan/proof-logs/`.
- Bound captured output so a noisy command cannot consume unbounded memory.

## Testing

Add tests that first fail for:

- successful command execution records source `prove-run`, exit code, duration, changed files, redacted summary, and log path;
- failed command execution records a failed proof row without throwing away the receipt;
- `prove --changed` treats `prove-run` rows as fresh first-class proof evidence;
- CLI delimiter parsing works with `prove --run -- <command...>`;
- docs mention `--run` and keep `--record-command` for imported evidence.

## Non-Goals

- No release, version bump, tag, or publish.
- No dependency changes.
- No remote execution, CI runner, or MCP command execution.
