# projscan Privacy Notice

projscan is a local, open-source developer tool. This notice applies to the projscan CLI, MCP server, package contents, generated local artifacts, and repository docs.

projscan is part of the Baseframe Labs family of products (https://www.baseframelabs.com). Baseframe Labs is an umbrella brand, not the legal subject of this notice. This notice applies to projscan only.

## Local-first behavior

By default, projscan runs on your machine and reads files in the repository where you run it. It does not upload source code, dependency data, scan results, telemetry, or usage analytics to a projscan service.

Inside a Git repository, projscan uses Git's own visible-file boundary by default: tracked files plus untracked files that are not excluded by `.gitignore`, `.git/info/exclude`, or global Git excludes. Files hidden by Git ignore rules are not scanned unless you explicitly opt in with `--include-ignored` or `scan.includeIgnored: true`. Non-Git folders fall back to projscan's built-in local noise ignores.

projscan may write local files when you ask it to, such as `.projscan-cache/`, `.projscan-feedback.json`, baselines, handoff files, generated policies, generated GitHub Actions, or reports.

Run `projscan privacy-check` to see the current telemetry status, offline status, scan root, ignore boundary, ignored-file count, `.env` content-scanning status, plugin execution status, local write surfaces, report-export sensitivity, and network-capable endpoints.

## Commands that can involve network access

Some workflows can involve network access because they call external tooling or package managers:

- installing projscan with npm or running it through npx contacts the npm registry before projscan starts
- `projscan audit` shells out to npm audit behavior for the current project
- commands or modes that explicitly ask for registry checks may contact the configured package registry
- semantic search can download an optional local embedding model when the optional `@xenova/transformers` peer is installed and the user opts into semantic mode

Set `PROJSCAN_OFFLINE=1`, pass `--offline`, or set `scan.offline: true` to block projscan's known network-capable features: telemetry sending, `projscan audit`, registry checks, and optional semantic model loading. This does not prevent npm or npx from contacting the registry before projscan starts.

- local analyzer or reporter plugins can do anything their code does; only enable plugins you trust

## Environment variables and secrets

projscan may pass `process.env` to child processes such as Git or npm so those tools work normally. projscan does not intentionally inspect `.env` values, API keys, session tokens, or private credentials for telemetry or product analytics.

`.env*` files are path-only by default. If a `.env` file is tracked by Git, projscan can flag that filename as risky, but it does not read the `.env` file contents for secret-pattern detection unless you explicitly opt in with `--scan-env-values` or `scan.scanEnvValues: true`.

Security analyzers may flag committed secret-looking strings in repository files. Those findings stay in local output unless you choose to copy, save, or publish them.

## Optional telemetry

Telemetry is off by default. Users can opt in with `projscan telemetry enable` or through the interactive `projscan init team` prompt. When enabled, projscan sends only anonymous product-health events: command category, success/failure, duration bucket, version/platform, setup booleans, repeat-use buckets, and optional feedback buckets. It does not send source code, file paths, repository names, branch names, package names, usernames, email addresses, raw findings, secrets, environment values, or scan reports.

See `TELEMETRY.md` for the full allowlist, controls, endpoint, and environment variables.

## Feedback artifacts

`projscan feedback` creates local JSON evidence about reviewer usefulness, minutes saved, prevented bad edits, false positives, owner clarity, next-command clarity, and repeat PR use. Treat that artifact as team data. Do not commit it if it contains private PR URLs, reviewer handles, or internal notes you do not want public.

## Contact

For privacy or security questions about projscan, contact support@baseframelabs.com.
