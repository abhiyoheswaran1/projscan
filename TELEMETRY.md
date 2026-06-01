# projscan telemetry

projscan telemetry is **off by default**. The CLI and MCP server do not send usage data unless a user explicitly opts in with `projscan telemetry enable` or accepts the prompt shown by `projscan init team` in an interactive terminal.

## Controls

```bash
projscan telemetry status
projscan telemetry explain
projscan telemetry enable
projscan telemetry disable
```

`projscan telemetry disable` turns telemetry off, clears the local queue, and removes the anonymous id.

## What is collected when enabled

Only anonymous product-health events are collected:

- command category and command name, such as `doctor`, `review`, `preflight`, or `dogfood`
- success or failure
- duration bucket, not exact command timing
- projscan version
- Node major version and operating-system platform
- whether CI, MCP setup, GitHub PR automation, or team bootstrap appears configured
- repeat-use buckets, such as run-count and active-day ranges
- optional feedback buckets from `projscan feedback add`, such as minutes-saved range, useful yes/no, prevented-bad-edit yes/no, and whether a false positive was reported

## What is never collected

projscan telemetry does **not** collect:

- source code
- file paths
- repository names
- branch names
- package names
- usernames or email addresses
- raw findings or scan output
- secrets or environment variable values

The implementation builds events from a fixed allowlist. It does not serialize scan reports, command arguments, file lists, dependency names, or analyzer findings.

## Storage and sending

Opt-in state is stored in the user config directory, or in `PROJSCAN_TELEMETRY_HOME` when set. Events are queued locally as JSONL and sent best-effort to:

```text
https://www.baseframelabs.com/api/projscan/telemetry
```

The endpoint can be overridden with `PROJSCAN_TELEMETRY_ENDPOINT`. Set `PROJSCAN_TELEMETRY_DISABLED=1` to force telemetry off in CI or managed environments. Set `PROJSCAN_TELEMETRY_NO_NETWORK=1` to keep enabled telemetry queued locally without sending network requests.

## Endpoint payload

The client posts JSON with this shape:

```json
{
  "schemaVersion": 1,
  "events": [
    {
      "schemaVersion": 1,
      "eventId": "evt_<random-uuid>",
      "eventType": "command_run",
      "anonymousId": "psn_<random-uuid>",
      "occurredAt": "2026-06-01T00:00:00.000Z",
      "commandCategory": "doctor",
      "commandName": "doctor",
      "status": "success",
      "durationBucket": "1-5s",
      "version": "3.0.9",
      "nodeMajor": 22,
      "platform": "darwin",
      "ci": false,
      "setup": {
        "githubActionConfigured": false,
        "mcpConfigured": false,
        "teamInitConfigured": false
      },
      "repeatUse": {
        "runCountBucket": "2-5",
        "activeDaysBucket": "1"
      }
    }
  ]
}
```

Feedback events use `eventType: "feedback_outcome"` and add a `feedback` object containing only buckets or booleans.

## Why this exists

Public download counts and stars do not show whether projscan actually helps engineers. Opt-in telemetry answers product-health questions such as whether teams finish setup, connect MCP, generate PR evidence, keep using projscan on later PRs, and report false positives. Outcome value still comes from explicit reviewer feedback:

```bash
projscan feedback add --minutes-saved 12 --prevented-bad-edit true --false-positive-rule owner:vague
```

Telemetry can show repeat use. Feedback explains whether that use was valuable.
