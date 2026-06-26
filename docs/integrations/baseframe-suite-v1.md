# Baseframe Suite Integration v1

ProjScan produces the repository-risk assessment for a specific task. AgentLoopKit
can consume that assessment to create a task contract, and AgentFlight can later
consume both artifacts for review readiness. The products stay separate:
ProjScan does not depend on AgentLoopKit or AgentFlight packages and does not
write their artifacts.

## Artifact Paths

All artifacts are local files inside the target repository:

```text
.baseframe/
  agent-workflow.json
  evidence/
    <task-id>/
      projscan-assessment.json
      agentloopkit-task.json
      agentflight-result.json
```

ProjScan owns only:

```text
.baseframe/evidence/<task-id>/projscan-assessment.json
```

ProjScan may create or update `.baseframe/agent-workflow.json`. It preserves
unknown fields and existing AgentLoopKit or AgentFlight sections, and updates
only shared task timestamps plus `tools.projscan`.

## Command

```bash
projscan assess \
  --intent "Implement password reset" \
  --task-id auth-password-reset-20260626-01 \
  --emit-baseframe
```

The command prints the relative assessment path:

```text
.baseframe/evidence/auth-password-reset-20260626-01/projscan-assessment.json
```

An explicit ProjScan-owned output path is also supported:

```bash
projscan assess \
  --intent "Implement password reset" \
  --task-id auth-password-reset-20260626-01 \
  --output .baseframe/evidence/auth-password-reset-20260626-01/projscan-assessment.json
```

Task IDs must be filesystem-safe: 1 to 128 characters, start and end with a
letter or number, and contain only letters, numbers, hyphen, or underscore.

## Assessment Schema

```ts
type ProjScanAssessmentV1 = {
  schemaVersion: "1.0";
  kind: "projscan-assessment";
  producer: { name: "projscan"; version: string };
  taskId: string;
  intent: string;
  generatedAt: string;
  repository: { root: string; branch?: string; commit?: string };
  verdict: "proceed" | "caution" | "block" | "unknown";
  summary: string;
  repositoryType?: string;
  impactedAreas: Array<{ name: string; paths: string[]; reason: string }>;
  reviewFocus: Array<{
    path: string;
    priority: "high" | "medium" | "low";
    reasons: string[];
  }>;
  risks: Array<{
    id: string;
    severity: "info" | "warning" | "blocking";
    category: string;
    message: string;
    files?: string[];
    suggestedAction?: string;
  }>;
  suggestedChecks: Array<{
    command: string;
    reason: string;
    required: boolean;
  }>;
  artifacts?: Array<{ kind: "report" | "scan" | "log"; path: string }>;
};
```

ProjScan maps local evidence from `assess`, quality scorecard, bug hunt,
preflight, language detection, and framework detection. When a signal is not
available, ProjScan emits `unknown`, omits optional fields, uses empty arrays,
and explains the limitation in `summary`.

## Workflow Manifest

ProjScan writes manifest paths relative to the repository root:

```ts
type BaseframeAgentWorkflowV1 = {
  schemaVersion: "1.0";
  taskId: string;
  intent: string;
  createdAt: string;
  updatedAt: string;
  tools: {
    projscan?: {
      status: "created" | "completed" | "failed";
      assessmentPath: string;
      version: string;
    };
    agentloopkit?: {
      status: "created" | "completed" | "failed";
      taskPath?: string;
      version?: string;
    };
    agentflight?: {
      status: "created" | "completed" | "failed";
      resultPath?: string;
      version?: string;
    };
  };
};
```

Writes are local and atomic. ProjScan rejects malformed task IDs, traversal
paths, symlinked Baseframe directories, and existing output files that are not a
matching ProjScan assessment for the same task.

## AgentLoopKit Consumption

AgentLoopKit should read:

```text
.baseframe/evidence/<task-id>/projscan-assessment.json
```

It should use `taskId`, `intent`, `verdict`, `impactedAreas`, `reviewFocus`,
`risks`, and `suggestedChecks` to create its own task contract artifact at:

```text
.baseframe/evidence/<task-id>/agentloopkit-task.json
```

ProjScan does not call AgentLoopKit and does not write that file.

## Independent Use

The existing assessment workflows remain unchanged:

```bash
projscan assess --mode fix-first --format markdown
projscan assess --goal "make this repo safer to ship this week" --format json
```

Use the Baseframe flags only when a stable suite artifact is needed.
