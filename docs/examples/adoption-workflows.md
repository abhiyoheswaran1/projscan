# Adoption Workflows

These examples turn projscan from a one-off scanner into a repeatable team
habit. They are written around the personas in `docs/PERSONAS.md`: skeptical
senior reviewer, platform lead, product engineer, release owner, and security
reviewer.

## Daily workflows engineers can trust

Start with the workflows below before adding team policy, plugin, or rollout
machinery.

### Before editing a feature

```bash
projscan start --intent "what files do I need to change for auth?"
projscan understand --view change --intent "add auth token refresh" --format json
projscan preflight --mode before_edit --format json
```

Success criteria: the product engineer and agent agree on likely touched files,
read-first context, and before-edit risk before code changes begin.

### Before handoff or commit

```bash
projscan bug-hunt --format json
projscan preflight --mode before_commit --format json
projscan evidence-pack --pr-comment
```

Success criteria: the senior reviewer sees concrete defects, manual review
gates, owner routing, and proof commands without reading the whole agent
transcript.

### Before release-candidate review

```bash
projscan release-train --format json
projscan preflight --mode before_merge --format json
projscan evidence-pack --pr-comment
```

Success criteria: the release owner gets read-only readiness evidence and a
specific next action for `caution`, including manual sign-off when the signal is
release scale rather than a concrete defect.

## 1. Agent Orchestration

Use this when a team is standardizing how agents start work, prove changes, and
hand off safely.

```bash
projscan privacy-check --offline
projscan start --intent "add billing webhook support" --format json
projscan preflight --mode before_edit --format json
projscan workplan --mode before_edit --format json
projscan agent-brief --intent "handoff billing webhook work" --format json
```

Decision loop:

| Persona | Reads | Decision |
| --- | --- | --- |
| Product engineer | `start.missionControl.readyActions` | What can I run now? |
| Platform lead | `preflight.verdict`, coordination hints | Is parallel work safe? |
| Senior reviewer | proof commands and done criteria | Is the handoff reviewable? |

If the repo uses AgentLoopKit or AgentFlight, `projscan start` surfaces the
local harness proof commands when their config files exist. Run those commands
as part of the handoff proof:

```bash
npm exec agentloop -- status
npm exec agentflight -- verify
```

## 2. Package Ownership

Use this when a monorepo or platform team needs to know who owns a dependency,
route review, or plan an upgrade.

```bash
projscan dependencies --format json
projscan semantic-graph --query package_importers --symbol fastapi --format json
projscan upgrade fastapi --format json
projscan agent-brief --intent "handoff package ownership for fastapi" --format json
```

For Node packages, `upgrade` reads local `package.json`, `node_modules`, local
CHANGELOG files, and importer evidence. For Python packages, it reads
`pyproject.toml`, `setup.cfg`, `setup.py`, root `requirements*.txt` files,
common `requirements/*.txt` / `requirements/*.in` manifests,
Poetry/Pipfile/uv/PDM/Conda lockfiles, and pinned root or recognized nested
requirements/constraints, then
returns declared scope, current-version source, drift, and Python importers.

Decision loop:

| Persona | Reads | Decision |
| --- | --- | --- |
| Package owner | importer list | Which app or package needs review? |
| Release owner | drift and importer count | Is this safe for the current train? |
| Security reviewer | audit/dependencies plus importer evidence | Is a forced update justified? |

## 3. Custom Policy Plugin

Use this when team-specific rules matter more than generic static analysis,
such as service ownership, route policy, or security-sensitive directories.

```bash
projscan plugin init --kind analyzer --name team-policy
projscan plugin validate .projscan-plugins/team-policy.projscan-plugin.json
projscan plugin test .projscan-plugins/team-policy.projscan-plugin.json
PROJSCAN_PLUGINS_PREVIEW=1 projscan doctor --format json
```

Start from packaged examples:

- `docs/examples/plugins/policy.projscan-plugin.json`
- `docs/examples/plugins/api-route-ownership.projscan-plugin.json`
- `docs/examples/plugins/security-sensitive-files.projscan-plugin.json`
- `docs/examples/plugins/team-radar.projscan-plugin.json`

Decision loop:

| Persona | Reads | Decision |
| --- | --- | --- |
| Platform lead | plugin diagnostics | Is the rule trusted enough for CI? |
| Security reviewer | emitted issues | Does the policy catch the right risky paths? |
| Product engineer | suggested action | Can this be fixed without tribal context? |

## 4. Shareable Evidence With Path Controls

Use this when a team wants to share a health or CI artifact without exposing
repo layout or sensitive paths.

Start from Mission Control when the reviewer asks in plain language:

```bash
projscan start --intent "share redacted evidence for src/api with a partner" --format json
```

The routed start output returns the three artifact commands below as ready
actions, using the requested scope when one is present in the intent.

For a partner review that spans more than one area, name both scopes in the
intent:

```bash
projscan start --intent "share redacted evidence for src/api and packages/backend with a partner" --format json
```

```bash
projscan analyze --report-scope src/api --redact-paths --format json > reports/api-analysis.json
projscan analyze --report-scope "src/api,packages/backend" --redact-paths --format json > reports/api-backend-analysis.json
projscan doctor --report-scope src/api --redact-paths --format markdown > reports/api-health.md
projscan ci --report-scope src/api --redact-paths --format sarif > reports/api.sarif
```

`--report-scope` keeps only issues and files under the listed repo-relative
paths. `--redact-paths` replaces file paths with stable labels such as
`redacted-path-1`, so reviewers can correlate evidence without seeing the
original repo structure.

When the same evidence shape is reused by a partner review, security check, or
release train, put it in config and select it by name:

```json
{
  "reportPolicies": {
    "apiEvidence": {
      "reportScope": ["src/api"],
      "redactPaths": true
    }
  }
}
```

```bash
projscan analyze --report-policy apiEvidence --format json > reports/api-analysis.json
projscan doctor --report-policy apiEvidence --format markdown > reports/api-health.md
projscan ci --report-policy apiEvidence --format sarif > reports/api.sarif
```

Use direct `--report-scope` or `--redact-paths` flags with `--report-policy` for
one-off overrides without changing the shared config preset.
