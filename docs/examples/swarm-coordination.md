# Swarm Coordination Workflow

Use this recipe when two or more agents, worktrees, or developers are changing
the same repo. The goal is not to prevent parallel work; it is to make overlap,
claim contention, and merge order visible before code lands.

## Personas

- Platform lead: wants low merge conflict rate and clear ownership when several
  agents are active.
- Product engineer: wants to keep moving without reading every sibling branch.
- Release owner: wants a merge order and proof that high-risk overlaps were
  reviewed before sign-off.

## Start of Work

Run this before the first edit in each worktree:

```bash
projscan start --intent "show coordination status for parallel agents" --format json
projscan coordinate --format json
projscan claim list --format json
```

If the work has a known file, claim it with a short lease:

```bash
projscan claim add src/core/start.ts --agent api-agent --ttl 2700 --format json
```

Treat a claim conflict as a routing signal. Either choose another task, split
the file, or ask the owner to release the claim.

## During Work

Use the dedicated coordination tools for specific questions:

```bash
projscan collisions --format json
projscan merge-risk --format json
projscan coordinate --format json
```

Read the outputs this way:

| Tool | Question answered | Action |
| --- | --- | --- |
| `collisions` | Which worktrees touch the same files or dependent files? | Move one branch first, split work, or ask for review. |
| `claim list` | Who says they own a file, directory, or symbol right now? | Avoid edits under active leases unless agreed. |
| `merge-risk` | Which branch should merge first? | Integrate the least-entangled branch before larger branches. |
| `coordinate` | Is the current swarm clear, cautious, or conflicted? | Use this as the one-line status in handoffs. |
| `agent-brief` | What should the next agent know? | Include coordination hints in the next-agent packet. |

The JSON reports for `collisions` and `coordinate` include an `evidence` block
with the active command path, current worktree state, local-only source signals,
the validation workflow above, and a reminder that session memory is separate
from current Git/worktree evidence. The default `coordinate` console view prints
the same session-boundary reminder inside its `Evidence` section.
Read `currentWorktree.changedFileCount` as the branch/base delta used for
collision detection, including local commits and any dirty files. Read
`currentWorktree.uncommittedChangedFileCount` as the current dirty worktree
count from `git status`. A clean worktree can therefore show changed files
against `origin/main` while still reporting `0` uncommitted files.
When multiple worktrees are present, `agent-brief` also carries a
`context.coordinationHints` entry even for a clear swarm, so the next agent knows
to validate locally with `projscan coordinate --format json`,
`projscan coordinate --watch --interval 5 --format json`, and
`projscan agent-brief --format json` before continuing parallel edits.
`preflight` also carries this proof path under `evidence.coordination`: it keeps
the compact readiness counts and adds the local-only command path, current
worktree summary, validation workflow, and session-boundary reminder used by
`coordinate`.

For MCP clients that support long-running notifications, use the watch tool:

```text
projscan_coordinate_watch { "action": "start" }
projscan_coordinate_watch { "action": "list" }
projscan_coordinate_watch { "action": "stop" }
```

For CLI users, `coordinate` also supports polling:

```bash
projscan coordinate --watch --interval 5 --format json
```

The watch loop should be treated as advisory evidence. A changed notification
or emitted watch row means rerun `projscan coordinate` before editing or merging.

## Before Handoff

Capture a compact handoff with coordination evidence:

```bash
projscan agent-brief --intent "handoff current parallel-agent work" --format json
projscan preflight --mode before_commit --format json
projscan coordinate --format json
```

Handoff text should include:

- active claims you hold
- collision count and readiness verdict
- merge-risk order when multiple worktrees exist
- exact proof commands already run
- claim release command if the next agent owns the follow-up

## Before Merge

```bash
projscan preflight --mode before_merge --format json
projscan merge-risk --format json
projscan coordinate --format json
```

Merge only when the coordination verdict is `clear` or when the release owner
has reviewed the listed conflicts. If the verdict is `conflicted`, resolve or
split the overlap before merging.

## Evidence Gaps To Track

These are the next hardening targets for real swarm usage:

- transitive collision recall: prove dependent-file conflicts are caught, not
  only same-file conflicts
- live watch adoption: prove agents notice and act on coordination changes
- preflight and handoff adoption: prove agents consistently cite the shared
  coordination proof path before editing, committing, and handing off
