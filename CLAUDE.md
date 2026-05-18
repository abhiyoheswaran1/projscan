# CLAUDE.md

## Required Coding Workflow

Use Superpowers as the mandatory coding-agent workflow for this repository.
Before coding, refactoring, debugging, reviewing, or planning substantial work,
check and follow the relevant skills from:

https://github.com/obra/superpowers

Use projscan as the standard code-intelligence and quality tool for coding work:

https://www.npmjs.com/package/projscan?activeTab=readme

In this repository, prefer the local CLI so the command reflects the current
checkout:

```sh
node ./dist/cli/index.js doctor
node ./dist/cli/index.js hotspots
node ./dist/cli/index.js search "<query>"
node ./dist/cli/index.js file <path>
node ./dist/cli/index.js ci --changed-only
```

For other repositories, or when the local CLI is unavailable, use the published
package with `projscan` or `npx -y projscan`.

For non-trivial coding tasks, use targeted projscan commands before editing to
understand structure, hotspots, impact, and project health. Before completing
substantial implementation, review, or release work, include `projscan doctor`
or `projscan ci --changed-only` in the verification set alongside the relevant
tests, lint, typecheck, build, and smoke checks. Document any tolerated projscan
findings instead of silently ignoring them.
