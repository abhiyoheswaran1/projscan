# Team Workflow Adoption Design

## Goal

Make projscan useful at the recurring moments where developers and agent teams need code intelligence: starting work, reviewing a PR, setting team policy, and handing work to the next person or agent.

## Product Shape

The next branch adds a workflow layer over the existing graph, preflight, review, workplan, bug-hunt, scorecard, and adoption primitives. It does not add another static analyzer category. The core promise is: "tell me what to do next, why I should trust it, and how to verify it."

## Surfaces

1. `projscan start` / `projscan_start`
   - Read-only first-60-seconds orientation.
   - Combines first-run diagnostics, workplan, quality scorecard, and recipes.
   - Returns top risks, next commands, adoption gaps, and the recommended workflow.

2. `projscan init policy`
   - Writes a `.projscanrc.json` starter policy for frontend, platform, security, or monorepo teams.
   - Refuses to overwrite unless `--force` is passed.
   - Gives teams a concrete policy path instead of a blank config file.

3. `projscan evidence-pack --pr-comment`
   - Adds a PR-comment renderer for team review.
   - Summarizes verdict, blocking reasons, artifacts, and verification commands in markdown.
   - Stays read-only and suitable for GitHub Actions output.

4. `projscan handoff --write <file>`
   - Writes the concise handoff artifact already printed by `handoff`.
   - Helps agent teams persist context between sessions without inventing a new format.

5. `projscan init github-action`
   - Writes a GitHub Actions PR workflow that runs `projscan start`, `projscan preflight`, and `projscan evidence-pack --pr-comment`.
   - Posts projscan evidence where teams already review code.

## Non-Goals

- No publishing, tagging, or release automation on this branch.
- No SaaS dashboard.
- No embedded LLM.
- No new security scanner class unless it directly supports the workflow above.

## Success Criteria

- A new user can run one command and know what to do next.
- A team can initialize a policy starter in one command.
- A PR can receive a useful projscan comment without bespoke scripting.
- A next agent can resume from a written handoff artifact.
