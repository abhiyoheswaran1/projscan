# ProjScan - Full Guide

A deep dive into everything ProjScan can do. For a quick overview, see the [README](../README.md).

**ProjScan is agent-first**: the MCP server is the primary interface, and the CLI is a consumer of the same primitives. This guide covers both, but if you're integrating with Claude Code / Cursor / Windsurf / Codex, start with [MCP Server for AI Agents](#mcp-server-for-ai-agents).

---

## Table of Contents

- [Installation](#installation)
- [Your First Scan](#your-first-scan)
- [The agent journey](#the-agent-journey)
- [Commands In Depth](#commands-in-depth)
  - [analyze](#analyze)
  - [doctor](#doctor)
  - [hotspots](#hotspots)
  - [semantic-graph](#semantic-graph)
  - [dataflow](#dataflow)
  - [search](#search)
  - [file](#file)
  - [ci](#ci)
  - [diff](#diff)
  - [fix](#fix)
  - [explain](#explain)
  - [diagram](#diagram)
  - [structure](#structure)
  - [dependencies](#dependencies)
  - [outdated](#outdated)
  - [audit](#audit)
  - [upgrade](#upgrade)
  - [coverage](#coverage)
  - [badge](#badge)
  - [mcp](#mcp)
  - [dogfood](#dogfood)
- [Health Score](#health-score)
- [Output Formats](#output-formats)
  - [Console](#console-default)
  - [JSON](#json)
  - [Markdown](#markdown)
  - [HTML](#html)
  - [SARIF](#sarif)
- [Configuration (`.projscanrc`)](#configuration-projscanrc)
- [PR-Diff Mode (`--changed-only`)](#pr-diff-mode---changed-only)
- [Global Options](#global-options)
- [What ProjScan Detects](#what-projscan-detects)
  - [Languages](#languages)
  - [Frameworks and Libraries](#frameworks-and-libraries)
  - [Issues and Health Checks](#issues-and-health-checks)
- [Auto-Fix System](#auto-fix-system)
- [Architecture Diagrams](#architecture-diagrams)
- [File Explanation Engine](#file-explanation-engine)
- [Hotspots & Ownership](#hotspots--ownership)
- [MCP Server for AI Agents](#mcp-server-for-ai-agents)
- [Performance](#performance)
- [Common Workflows](#common-workflows)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)
- [Project Internals](#project-internals)

---

## Installation

### Global install (recommended)

```bash
npm install -g projscan
```

After installing, the `projscan` command is available everywhere.

### Run without installing

```bash
npx projscan
```

### Requirements

- Node.js >= 18
- npm, yarn, or pnpm
- Git (optional - unlocks `hotspots` and `--changed-only`)
- VHS (optional - regenerates checked-in terminal demos with `npm run docs:demos`)

---

## Your First Scan

Navigate into any repository and run:

```bash
cd your-project
projscan
```

This runs the default `analyze` command. Within a second or two you'll see a full report covering:

<img src="https://abhiyoheswaran.com/images/projscan/hero-poster.png" alt="npx projscan: banner, scan progress, full project report" width="700">

1. **Project overview** - name, total files, total directories, scan time
2. **Language breakdown** - primary language, percentages per language
3. **Frameworks detected** - with confidence levels and categories
4. **Dependency summary** - production vs. dev count, package manager, lock file status
5. **Issues found** - grouped by severity (error, warning, info)

---

## The agent journey

projscan is structured around the four questions an AI coding agent (or a careful human reviewer) asks at every code-change moment. Each phase has a small set of tools that compose well; the deeper reference for each tool is in the [Commands In Depth](#commands-in-depth) section below. Mapping the question to the tool is what this section is for.

### 1. Diagnose — "what's wrong here?"

When the agent first opens a repo, or before starting a refactor, the question is: _is anything obviously broken or risky?_

- **`projscan privacy-check`** — trust boundary report. Shows telemetry/offline status, scan root, Git ignore handling, `.env` content handling, plugin execution status, local write surfaces, report-export sensitivity, and network-capable endpoints.
- **`projscan_start` / `projscan start`** — first-60-seconds workflow orientation. Composes setup diagnostics, Mission Control, the recommended workflow recipe, `firstTenMinutes`, workplan, quality scorecard, top risks, adoption gaps, repeat-use metrics, next commands, optional handoff payload, and a split between current Git/worktree evidence and remembered session context. Pass `intent` / `--intent "<goal>"` when the developer or agent wants one routed action plan with route confidence, immediately callable `readyActions`, and proof commands, such as `projscan start --intent "what breaks if I rename this API?"`. For fuzzy impact targets, Mission Control searches first, then gives symbol and file impact follow-ups for the search result. For exact symbols or paths, such as `projscan start --intent "what breaks if I change src/core/start.ts?"`, `projscan start --intent "where is runAudit used?"`, `projscan start --intent "what depends on src/core/start.ts?"`, or `projscan start --intent "can I delete src/core/start.ts?"`, it runs impact directly. For repo-orientation questions, such as `projscan start --intent "summarize this repo"`, `projscan start --intent "what files should I read first?"`, `projscan start --intent "where do I start in this codebase?"`, `projscan start --intent "give me a tour of the repo"`, or `projscan start --intent "explain the architecture"`, it routes to `projscan_understand --view map` so the developer gets cited read-first files, entrypoints, boundaries, risks, and unknowns. For public surface questions, such as `projscan start --intent "what are the public contracts?"` or `projscan start --intent "how do I safely deprecate this API?"`, it routes to `projscan_understand --view contracts` so public exports, config contracts, and likely breaking-change risks are reviewed before touching API surfaces. For API breakage questions, such as `projscan start --intent "what will this API change break?"`, it searches for the exact public symbol or file before continuing to impact analysis. For broad quality/risk questions, such as `projscan start --intent "what is risky in this repo?"`, it routes to `projscan_quality_scorecard` so health, security, tests, maintainability, coordination, and top risks are reviewed before choosing work. For file-orientation questions, such as `projscan start --intent "what should I read before changing src/core/start.ts?"`, `projscan start --intent "explain src/core/start.ts"`, `projscan start --intent "who owns src/core/start.ts?"`, `projscan start --intent "who should review src/core/start.ts?"`, or `projscan start --intent "who last touched src/core/start.ts?"`, it routes to `projscan_file` so the developer sees purpose, imports, exports, ownership, history, reviewer context, and risk before editing. For targeted graph questions, such as `projscan start --intent "who imports src/core/start.ts?"`, it routes to `projscan_semantic_graph` query mode instead of dumping the full graph. For security source-to-sink questions, such as `projscan start --intent "is user input reaching SQL sinks?"`, it routes to `projscan_dataflow` and infers the `hardening` workflow. For coverage-gap questions, such as `projscan start --intent "what are the scariest untested files?"`, it routes to `projscan_coverage` so the next test target is chosen by risk. For dependency inventory questions, such as `projscan start --intent "what dependencies does this repo use?"`, it routes to `projscan_dependencies` instead of an upgrade preview. For dependency vulnerability questions, such as `projscan start --intent "does lodash have a CVE?"`, `projscan start --intent "what CVEs affect this repo?"`, or `projscan start --intent "find vulnerable packages"`, it routes to `projscan_audit`, scoped with `--package` when the package can be inferred. For package-bump or package-update questions, such as `projscan start --intent "what breaks if I bump chalk to 6?"` or `projscan start --intent "what breaks if I update react?"`, it routes to `projscan_upgrade`; if no package is named, Mission Control runs `projscan outdated --format json` first and marks the package name as `Needs Input`. For "what changed in this PR?", it routes to `projscan_pr_diff` before full review. For "what should I fix first?" or "what is the fastest safe fix?", it routes to `projscan_bug_hunt` instead of issue-specific fix-suggest or generic preflight. For open-ended next-step questions, such as `projscan start --intent "what should I do next?"`, it routes to `projscan_workplan --mode before_edit` so the developer gets an ordered plan with verification before editing. For "give the next agent a handoff", it routes to `projscan_agent_brief` with `intent: "next_agent"`. For issue context, such as `projscan start --intent "explain issue missing-test-framework"`, it routes to `projscan_explain_issue`; if no issue id is named, Mission Control runs `projscan doctor --format json` first and marks the issue id as `Needs Input`. For direct issue repair, such as `projscan start --intent "fix issue missing-test-framework"`, it routes to `projscan_fix_suggest`; if no issue id is named, Mission Control runs `projscan doctor --format json` first and marks the fix-suggest issue id as `Needs Input`. For failing CI or tests, such as `projscan start --intent "CI is failing after this PR"`, it routes to `projscan_regression_plan` with a focused verification plan. For right-sized verification questions, such as `projscan start --intent "what smoke checks should I run before commit?"` or `projscan start --intent "what full regression should I run before merge?"`, Mission Control preserves the requested `smoke` or `full` regression depth.
  For rollback and revert questions, such as `projscan start --intent "revert src/core/start.ts safely"` or `projscan start --intent "how do I revert this change safely?"`, it routes to `projscan_impact`; exact files run impact directly, while vague rollback phrasing searches for the target before impact continues.
  For package usage questions, such as `projscan start --intent "who uses lodash?"`, `projscan start --intent "what depends on lodash?"`, or `projscan start --intent "why do we depend on lodash?"`, it routes to `projscan_semantic_graph --query package_importers` so importers are known before removal or upgrade work starts.
  For bundle-size and dependency-bloat questions, such as `projscan start --intent "why is the bundle so large?"`, `projscan start --intent "reduce bundle size"`, or `projscan start --intent "find package bloat"`, it routes to `projscan_dependencies`, whose report includes installed package-size totals and largest local packages when `node_modules` metadata is available.
  For dependency license and compliance questions, such as `projscan start --intent "what licenses do our dependencies use?"`, `projscan start --intent "third party notices"`, or `projscan start --intent "open source compliance check"`, it routes to `projscan_dependencies`, whose report includes local `node_modules` license counts, unknown licenses, notice candidates, and copyleft risks when installed package metadata is available.
  For monorepo workspace questions, such as `projscan start --intent "what workspaces are in this repo?"`, `projscan start --intent "which workspace owns auth?"`, or `projscan start --intent "where should I put this in the monorepo?"`, it routes to `projscan_workspaces` so package names and paths are known before package-scoped work begins.
  For trust-boundary questions, such as `projscan start --intent "what can projscan read?"`, `projscan start --intent "does projscan read .env values?"`, or `projscan start --intent "will projscan upload my code?"`, it routes to `projscan privacy-check --offline` so telemetry, offline mode, scan root, ignored-file handling, `.env` content policy, plugin execution, local writes, and network-capable endpoints are reviewed before broader analysis.
  For project-run and setup questions, such as `projscan start --intent "how do I run this project?"`, `projscan start --intent "what command starts the dev server?"`, or `projscan start --intent "how do I set up this repo locally?"`, it routes to `projscan_understand --view map` so entrypoints, read-first files, boundaries, risks, and unknowns guide first local execution. Package script discovery such as `projscan start --intent "what npm scripts exist?"`, `projscan start --intent "which script runs e2e tests?"`, `projscan start --intent "what command runs lint?"`, or `projscan start --intent "how do I run typecheck?"` routes to `projscan_understand --view contracts` instead of dependency freshness or regression debugging. Failure wording such as `projscan start --intent "e2e tests are failing"` or `projscan start --intent "lint is failing"` still routes to focused regression planning.
  For local database setup commands, such as `projscan start --intent "how do I seed the database?"`, `projscan start --intent "what command resets the database?"`, or `projscan start --intent "what command runs migrations?"`, it routes to `projscan_understand --view contracts` so package scripts and config contracts are reviewed before guessing shell commands.
  For feature-placement and change-planning questions, such as `projscan start --intent "where should I put this new feature?"`, `projscan start --intent "implement OAuth login"`, `projscan start --intent "add billing webhook support"`, `projscan start --intent "where should I add a new endpoint?"`, or `projscan start --intent "what files do I need to change for auth?"`, it routes to `projscan_understand --view change` so change-readiness risks, likely touched files, blast radius, and verification tiers are reviewed before editing.
  For documentation-change questions, such as `projscan start --intent "what docs should I update for this change?"` or `projscan start --intent "does this change need docs?"`, it also routes to `projscan_understand --view change` instead of package upgrade.
  For database migration and schema-planning questions, such as `projscan start --intent "where should I add this database migration?"` or `projscan start --intent "does this change need a migration?"`, it routes to `projscan_understand --view change`; migration inventory wording such as `projscan start --intent "which migrations exist?"` or `projscan start --intent "what migration files exist?"` routes to focused search; destructive schema wording such as `projscan start --intent "what breaks if I change the schema?"` or `projscan start --intent "can I drop this column?"` routes to impact analysis and searches first when no exact target is named.
  For API deprecation and breakage questions, such as `projscan start --intent "how do I safely deprecate this API?"` or `projscan start --intent "what will this API change break?"`, it separates contract discovery from blast-radius analysis: deprecation starts with `projscan_understand --view contracts`, while broad breakage searches for the exact API target before impact continues.
  For repo env-var requirement questions, such as `projscan start --intent "what env vars does this repo need?"`, it routes to `projscan_understand --view contracts` so environment/config reads are treated as repo contracts instead of trust-boundary questions about projscan itself.
  For exact env-var lookup questions, such as `projscan start --intent "where is NEXT_PUBLIC_API_URL used?"`, `projscan start --intent "find process.env.NODE_ENV"`, or `projscan start --intent "which env var controls auth?"`, it routes to `projscan_search` with a focused env query before broader impact or dataflow tools run.
  For missing setup/config wording, such as `projscan start --intent "environment variables missing"`, it also routes to `projscan_understand --view contracts`.
  For local setup blockers, such as `projscan start --intent "port 3000 already in use"`, `projscan start --intent "EADDRINUSE on startup"`, `projscan start --intent "permission denied when running dev server"`, `projscan start --intent "ENOENT package.json missing"`, or `projscan start --intent "peer dependency conflict after npm install"`, it routes to `projscan_regression_plan --level focused` so the failing local command and smallest rerun proof are chosen before package or config rabbit holes.
  For config-file lookup questions, such as `projscan start --intent "where is eslint config?"`, `projscan start --intent "find vite config"`, or `projscan start --intent "which config file defines aliases?"`, it routes to `projscan_search` with a focused config query. For build/tooling config lookup, such as `projscan start --intent "where is tsconfig path aliases configured?"`, `projscan start --intent "where is Vitest config?"`, `projscan start --intent "find Babel config"`, `projscan start --intent "where is package manager configured?"`, or `projscan start --intent "where is pnpm workspace file?"`, it routes to `projscan_search` with focused tsconfig-alias, test-runner/Babel/Webpack config, package-manager, and workspace-file queries instead of treating `file`, `workspace`, `package`, or `vitest` as file inspection, workspace inventory, dependency inventory, or issue explanation. Failure wording such as `projscan start --intent "why is vitest failing"` still routes to regression planning, and script inventory such as `projscan start --intent "what npm scripts exist"` still routes to contract orientation.
  For blocker-discovery questions, such as `projscan start --intent "what is blocking this PR?"`, it routes to `projscan_preflight --mode before_commit` so blockers, owners, and follow-up commands are surfaced before review continues.
  For code-location questions, such as `projscan start --intent "what code handles billing?"`, `projscan start --intent "which file contains checkout logic?"`, `projscan start --intent "find the Stripe webhook handler"`, `projscan start --intent "find the handler for POST /api/users"`, `projscan start --intent "where is the /checkout route handled?"`, `projscan start --intent "which feature flags exist?"`, or `projscan start --intent "show me generated files"`, it routes to `projscan_search` with a focused code query before deeper inspection.
  For frontend page-route lookup, such as `projscan start --intent "where is /settings page rendered?"`, `projscan start --intent "which page renders /billing?"`, `projscan start --intent "where is route segment for dashboard?"`, or `projscan start --intent "where is not-found page handled?"`, it routes to `projscan_search` with focused URL page, route-segment, and not-found-page queries instead of losing page context to a generic route-path search. Runtime troubleshooting wording such as `projscan start --intent "why is /settings returning 404?"` still routes to regression planning.
  For authorization lookup, such as `projscan start --intent "where are permissions checked for checkout?"`, `projscan start --intent "which role can access admin?"`, `projscan start --intent "where is RBAC defined?"`, or `projscan start --intent "what routes require login?"`, it routes to `projscan_search` with a focused permissions, role, RBAC, or login query instead of treating `defined`, `routes`, or `login` as graph, planning, or incident signals.
  For reliability-control lookup, such as `projscan start --intent "where is rate limiting configured?"`, `projscan start --intent "where is cache invalidated for products?"`, `projscan start --intent "find retry logic for payments"`, `projscan start --intent "what sets request timeout?"`, `projscan start --intent "find idempotency key handling"`, or `projscan start --intent "where is webhook signature verified?"`, it routes to `projscan_search` with focused rate-limit, cache-invalidation, retry, timeout, idempotency, or signature-verification queries instead of treating words like `request`, `failed`, or `used` as dataflow, regression, or impact signals.
  For data-contract and persistence-invariant lookup, such as `projscan start --intent "where is input validation for signup?"`, `projscan start --intent "which schema validates checkout?"`, `projscan start --intent "where are request params parsed?"`, `projscan start --intent "what serializes API response?"`, `projscan start --intent "where is database transaction started?"`, `projscan start --intent "where do we lock the order row?"`, `projscan start --intent "what validates email uniqueness?"`, or `projscan start --intent "what builds pagination cursors?"`, it routes to `projscan_search` with focused validation, parsing, serialization, transaction, locking, uniqueness, or pagination queries instead of treating `schema`, `database`, `request`, `email`, or `lock` as impact, broad understand, dataflow, or claim signals.
  For ORM and data-access lookup, such as `projscan start --intent "where is Prisma model for User?"`, `projscan start --intent "find Drizzle schema for invoices"`, `projscan start --intent "where is SQL query for invoices?"`, `projscan start --intent "which repository saves orders?"`, or `projscan start --intent "find DAO for payments"`, it routes to `projscan_search` with focused Prisma/Drizzle, SQL-query, repository, and DAO queries instead of treating `sql`, `schema`, or `query` as dataflow, validation-contract, or API-query signals. Security wording such as `projscan start --intent "is user input reaching SQL sinks?"` still routes to dataflow, and destructive schema wording such as `projscan start --intent "can I drop this column?"` still routes to impact analysis.
  For UI interaction lookup, such as `projscan start --intent "where is the signup form submitted?"`, `projscan start --intent "where is loading state for dashboard?"`, `projscan start --intent "where is error boundary for settings?"`, `projscan start --intent "find command palette actions"`, `projscan start --intent "what component renders the billing page?"`, `projscan start --intent "where are i18n translations for checkout?"`, or `projscan start --intent "where is aria label for submit button?"`, it routes to `projscan_search` with focused form-submit, loading-state, empty-state, error-boundary, toast, shortcut, command-palette, component, translation, and accessibility queries instead of treating UI vocabulary as privacy, regression, hotspot, or planning signals.
  For styling and design-system lookup, such as `projscan start --intent "where are design tokens defined?"`, `projscan start --intent "where is Tailwind theme configured?"`, `projscan start --intent "where is global CSS imported?"`, `projscan start --intent "which CSS module styles Button?"`, `projscan start --intent "where is dark mode configured?"`, or `projscan start --intent "what breakpoints are defined?"`, it routes to `projscan_search` with focused design-token, Tailwind-theme, global-CSS, CSS-module, dark-mode, and breakpoint queries instead of treating `tokens`, `defined`, `module`, `button`, or `theme` as dataflow, semantic-graph, infra, generic UI, or state-provider signals. Implementation wording such as `projscan start --intent "add dark mode"` still routes to change planning, and failure wording such as `projscan start --intent "why is dark mode failing"` still routes to regression planning.
  For navigation and layout lookup, such as `projscan start --intent "where is sidebar nav item for billing?"`, `projscan start --intent "which breadcrumb renders settings?"`, `projscan start --intent "where is page title set for checkout?"`, or `projscan start --intent "where is Next.js layout for dashboard?"`, it routes to `projscan_search` with focused sidebar/nav, breadcrumb, page-title/metadata, and Next.js-layout queries instead of treating `route`, `page`, `set`, `dashboard`, or `next` as API-route, UI-component, reliability, observability, or planning signals. Implementation wording such as `projscan start --intent "add sidebar nav item"` still routes to change planning.
  For state management and data-fetching lookup, such as `projscan start --intent "where is auth state stored?"`, `projscan start --intent "find Redux slice for cart"`, `projscan start --intent "where is Zustand store for user settings?"`, `projscan start --intent "which context provider supplies theme?"`, `projscan start --intent "which hook fetches invoices?"`, or `projscan start --intent "where is React Query mutation for checkout?"`, it routes to `projscan_search` with focused state-store, Redux/Zustand, provider, hook, and React Query queries instead of treating `store`, `state`, `query`, or `fetch` as dataflow, generic UI state, data-contract, or integration signals. Implementation wording such as `projscan start --intent "implement Redux store"` still routes to change planning, and sensitive storage wording such as `projscan start --intent "where do we store access tokens?"` still routes to dataflow.
  For integration touchpoint lookup, such as `projscan start --intent "where do we call Stripe?"`, `projscan start --intent "which code sends email through SendGrid?"`, `projscan start --intent "where is S3 upload implemented?"`, `projscan start --intent "find GitHub API client"`, `projscan start --intent "where is GraphQL query for invoices?"`, or `projscan start --intent "where is websocket connection opened?"`, it routes to `projscan_search` with focused service/API/client/email/storage/query/socket queries instead of treating words like `github`, `email`, `upload`, `query`, or `connection` as CI, privacy, data-contract, or regression signals.
  For API contract artifact lookup, such as `projscan start --intent "where is OpenAPI spec defined?"`, `projscan start --intent "where is Swagger docs configured?"`, `projscan start --intent "where is tRPC router for billing?"`, `projscan start --intent "which GraphQL resolver handles invoices?"`, `projscan start --intent "which protobuf defines user service?"`, or `projscan start --intent "where is gRPC client for payments?"`, it routes to `projscan_search` with focused OpenAPI, Swagger, tRPC, GraphQL resolver/schema, protobuf/proto, and gRPC queries while broad `public contracts` wording still routes to cited contract orientation.
  For infrastructure and deployment artifact lookup, such as `projscan start --intent "where is the Dockerfile?"`, `projscan start --intent "where is docker compose for local dev?"`, `projscan start --intent "where are Kubernetes manifests?"`, `projscan start --intent "find Helm chart for payments"`, `projscan start --intent "where is Terraform module for S3?"`, `projscan start --intent "which GitHub workflow deploys staging?"`, or `projscan start --intent "where is Vercel config?"`, it routes to `projscan_search` with focused Docker, Compose, Kubernetes, Helm, Terraform, deployment-workflow, and hosted-config queries while readiness wording such as `can I deploy this?` still routes to release readiness and failing workflow wording still routes to regression planning.
  For domain workflow lookup, such as `projscan start --intent "where is password reset handled?"`, `projscan start --intent "where is team invite flow?"`, `projscan start --intent "where is onboarding flow implemented?"`, `projscan start --intent "find CSV export for users"`, `projscan start --intent "what creates audit log entries?"`, `projscan start --intent "where is refund handling for payments?"`, or `projscan start --intent "where is subscription renewal handled?"`, it routes to `projscan_search` with focused product-workflow queries instead of treating words like `password`, `team`, `onboarding`, `log`, or `payments` as dataflow, ownership, orientation, regression, or release signals. Implementation wording such as `projscan start --intent "implement password reset"` still routes to change planning.
  For communication and content artifact lookup, such as `projscan start --intent "where is welcome email template?"`, `projscan start --intent "find password reset email copy"`, `projscan start --intent "where is push notification copy for invites?"`, `projscan start --intent "where is SMS verification template?"`, `projscan start --intent "which template sends receipt email?"`, or `projscan start --intent "where is invoice PDF generated?"`, it routes to `projscan_search` with focused email-template, email-copy, push/SMS notification, receipt, and invoice-PDF queries instead of treating words like `email`, `notification`, `generated`, or `sends` as dataflow, UI, build-artifact, observability, or regression signals. Explicit leakage/security wording such as `projscan start --intent "is customer email leaking to logs?"` still routes to dataflow.
  For background-work discovery, such as `projscan start --intent "what background jobs exist?"`, `projscan start --intent "which cron jobs exist?"`, `projscan start --intent "find the email queue processor"`, or `projscan start --intent "where are scheduled tasks defined"`, it routes to `projscan_search` with a focused operational-code query instead of treating words like `email`, `processes`, or `tasks` as dataflow or workplan signals.
  For observability lookup, such as `projscan start --intent "where are metrics emitted?"`, `projscan start --intent "find prometheus metrics"`, `projscan start --intent "where do we initialize Sentry?"`, `projscan start --intent "what logs should I check for checkout?"`, or `projscan start --intent "find the dashboard for payments"`, it routes to `projscan_search` with a focused monitoring query before broader debugging or dataflow tools run.
  For test-data and UI-story lookup, such as `projscan start --intent "where is seed data defined?"`, `projscan start --intent "find fixtures for checkout"`, `projscan start --intent "which mocks are used for payments?"`, `projscan start --intent "find factory for users"`, or `projscan start --intent "where are Storybook stories for Button?"`, it routes to `projscan_search` with a focused fixture/mock/story query instead of treating `data`, `defined`, or `used` as dataflow, graph, or impact signals.
  For pasted error/log string lookup, such as `projscan start --intent "where is \"Invalid token\" thrown?"`, `projscan start --intent "find error message \"Payment failed\""`, or `projscan start --intent "where do we log \"could not connect\""`, it routes to `projscan_search` with the quoted text as the query instead of treating words like `token`, `log`, or `failed` as broader dataflow/regression signals.
  For area ownership and human-routing lookup, such as `projscan start --intent "who owns auth?"`, `projscan start --intent "which team owns payments?"`, `projscan start --intent "who should I ask about auth?"`, `projscan start --intent "find expert for billing"`, or `projscan start --intent "who owns this area?"`, it routes to `projscan_search` before deeper file ownership inspection; advisory claims are reserved for explicit claim, reserve, lock, or active-claim wording.
  For documentation lookup questions, such as `projscan start --intent "find documentation for auth"` or `projscan start --intent "where is the API documented?"`, it routes to `projscan_search` with a focused docs query.
  For test-location and existing-test lookup questions, such as `projscan start --intent "where are the tests for src/core/start.ts?"`, `projscan start --intent "where are tests for auth?"`, `projscan start --intent "which tests cover auth?"`, or `projscan start --intent "locate specs for checkout"`, it routes to `projscan_search` with a focused test query before suggesting broader regression planning.
  For proactive proof-selection questions, such as `projscan start --intent "which tests should I run for src/core/start.ts?"` or `projscan start --intent "what should I test before pushing?"`, it routes to `projscan_understand --view verify` so the developer gets verification tiers, direct-test gaps, and the smallest rerunnable proof command before review.
  For exact-file coverage questions, such as `projscan start --intent "is src/core/start.ts covered by tests?"`, it routes to `projscan_file` so coverage, hotspot risk, ownership, and follow-up test evidence are reviewed for that file before editing.
  For broad coverage-gap questions, such as `projscan start --intent "which files have no tests?"`, it routes to `projscan_coverage` so missing-test work is ranked by hotspot risk instead of becoming a generic regression plan.
  For exact-file test-design questions, such as `projscan start --intent "what tests should I add for src/core/start.ts?"`, it routes to `projscan_file` so purpose, risky functions, existing coverage, and related test evidence shape the test before code is written.
  For package-removal questions, such as `projscan start --intent "can I remove lodash?"` or `projscan start --intent "is lodash safe to remove?"`, it routes to `projscan_upgrade` so importer and package-impact evidence are checked before removing the dependency.
  For merge-readiness questions, such as `projscan start --intent "is my branch ready to merge?"`, it routes to `projscan_preflight --mode before_merge` so the branch gets the merge gate instead of the PR-opening evidence pack.
  For PR-risk questions, such as `projscan start --intent "how risky is this PR?"`, `projscan start --intent "what are the risks in my PR?"`, or `projscan start --intent "what are the risky changes in this PR?"`, it routes to `projscan_review` so structural risk, verdict, and owner follow-up are checked before reviewers are asked to approve.
  For merge-risk summary questions, such as `projscan start --intent "what are the top risks before merge?"`, it routes to `projscan_preflight --mode before_merge` so merge blockers and manual-review items are surfaced before integration.
  For risky-file, complexity, refactor-priority, and codebase-performance questions, such as `projscan start --intent "what files are risky to touch?"`, `projscan start --intent "which files are too complex?"`, `projscan start --intent "what file should I refactor first?"`, `projscan start --intent "find performance bottlenecks"`, or `projscan start --intent "where are the slow files?"`, it routes to `projscan_hotspots` so the developer sees the highest-risk files before editing. For exact-file risk questions, such as `projscan start --intent "why is src/core/start.ts risky?"`, it routes to `projscan_file` so the file's hotspot, ownership, issue, import, and export context explains the risk. For cleanup questions, such as `projscan start --intent "find dead code"`, `projscan start --intent "find dead code and unused exports I can delete"`, `projscan start --intent "what can I safely delete?"`, or `projscan start --intent "what can I remove safely?"`, it routes to `projscan_doctor` so dead code, unused exports, and adjacent health issues are reviewed before files are removed.
  For tech-debt and simplification questions, such as `projscan start --intent "what tech debt should I pay down?"` or `projscan start --intent "what code should I simplify?"`, it routes to `projscan_hotspots` instead of incident handling for the word `down`.
  For reviewer-proof requests, such as `projscan start --intent "write a PR comment for reviewers"`, `projscan start --intent "write a PR description"`, `projscan start --intent "what should my PR say?"`, `projscan start --intent "make a PR checklist"`, `projscan start --intent "summarize my changes for reviewers"`, or `projscan start --intent "what should I tell my team about this change?"`, it routes to `projscan_evidence_pack` with `pr_comment: true` so the developer gets a paste-ready verdict, top risks, owner routing, and next commands.
  For reviewer-routing questions, such as `projscan start --intent "who should review this PR?"`, it routes to `projscan_evidence_pack` so likely owners and reviewer-facing context are prepared before a full review.
  For PR-readiness questions, such as `projscan start --intent "am I ready to open a PR?"`, it routes to `projscan_evidence_pack` so preflight, owner routing, top risks, and reviewer-facing proof are prepared before review starts.
  For changed-file owner questions, such as `projscan start --intent "who owns the changed files?"`, it routes to `projscan_evidence_pack` so changed-file owner routing is prepared without confusing it with single-file ownership inspection.
  For direct security-flow questions, such as `projscan start --intent "is user input reaching SQL sinks?"`, `projscan start --intent "does this endpoint expose secrets?"`, or `projscan start --intent "is user input sanitized?"`, it routes to `projscan_dataflow` and infers the `hardening` workflow. For current-change security review questions, such as `projscan start --intent "is this change secure?"` or `projscan start --intent "check this PR for security issues"`, it routes to `projscan_review` so the whole changed surface is reviewed before approval.
  For PII, privacy, and data-handling questions, such as `projscan start --intent "where is PII handled?"`, `projscan start --intent "does this endpoint leak PII?"`, `projscan start --intent "GDPR compliance check"`, or `projscan start --intent "where do we store access tokens?"`, it routes to `projscan_dataflow` instead of dependency compliance or generic search.
  For direct failure-debugging, flaky-test, and verification-speed questions, such as `projscan start --intent "why did CI fail?"`, `projscan start --intent "why is GitHub Actions failing?"`, `projscan start --intent "which GitHub Actions job failed?"`, `projscan start --intent "CI is flaky"`, `projscan start --intent "what command reproduces the flake?"`, `projscan start --intent "quarantine flaky test"`, `projscan start --intent "why is CI slow?"`, `projscan start --intent "why did the build fail?"`, `projscan start --intent "what is making builds slow?"`, `projscan start --intent "lint is failing"`, `projscan start --intent "typecheck is failing"`, `projscan start --intent "npm install is failing"`, or `projscan start --intent "debug this stack trace"`, it routes to `projscan_regression_plan --level focused` before generic issue explanation or broad health checks.
  For incident and runtime-failure questions, such as `projscan start --intent "production is down"`, `projscan start --intent "triage this incident"`, `projscan start --intent "why is the login endpoint returning 500?"`, or `projscan start --intent "where is this stack trace from?"`, it also routes to `projscan_regression_plan --level focused`; explicit code-location wording such as `projscan start --intent "what code handles this error message?"` still routes to search first.
  For local service failures, such as `projscan start --intent "database connection refused locally"`, it routes to `projscan_regression_plan --level focused` instead of schema-impact analysis.
  For test-plan questions, such as `projscan start --intent "what tests should I run for my changes?"` or `projscan start --intent "how can I speed up tests?"`, it routes to `projscan_regression_plan --level focused` so the developer gets the smallest useful verification loop before commit.
  For proof-command questions, such as `projscan start --intent "what commands prove this works?"` or `projscan start --intent "what commands benchmark this repo?"`, it routes to `projscan_regression_plan --level focused` so runnable proof is chosen before claims are made.
  For short proof-command phrasing, such as `projscan start --intent "give me proof commands"`, it also routes to `projscan_regression_plan --level focused`; reviewer-proof wording with PR comments still routes to `projscan_evidence_pack`.
  For pre-push command questions, such as `projscan start --intent "what commands should I run before pushing?"`, it routes to `projscan_regression_plan --level focused` so the branch has a small verification loop before it leaves the workstation.
  For release-readiness wording, such as `projscan start --intent "what should I check before release?"`, `projscan start --intent "can I deploy this?"`, `projscan start --intent "prepare this branch for deployment"`, `projscan start --intent "what changed since last release?"`, `projscan start --intent "write a release note for this change"`, or `projscan start --intent "draft changelog entry"`, it routes to `projscan_release_train` so changelog, package, SBOM, provenance, and blockers are reviewed before deploying or publishing.
  For product-planning questions, such as `projscan start --intent "what should we build next?"` or `projscan start --intent "plan the product roadmap"`, it routes to `projscan_workplan --mode bug_hunt` so broad product direction becomes an ordered, verifiable product-planning workplan with explicit accept, defer, or split criteria instead of a generic before-edit orientation.
  For broad improvement-planning questions, such as `projscan start --intent "what should we improve next?"`, it routes to `projscan_bug_hunt` so the agent gets an actionable ranked queue; technical variants such as tests, performance, release, dependencies, or safety keep their specialized routes.
  For quick-win and low-risk improvement wording, such as `projscan start --intent "find a quick win"`, `projscan start --intent "what is a low risk improvement?"`, or `projscan start --intent "pick a small safe task"`, it routes to `projscan_bug_hunt` so a ranked, verifiable action queue is selected instead of a generic quality readout.
  For tiny-task and beginner-safe wording, such as `projscan start --intent "what can I do in five minutes?"`, `projscan start --intent "pick an easy task for me"`, or `projscan start --intent "what should an intern work on?"`, it also routes to `projscan_bug_hunt`.
  For branch-diff, PR-size, and commit-message questions, such as `projscan start --intent "what did I change since main?"`, `projscan start --intent "is this PR too large?"`, `projscan start --intent "how big is this change?"`, `projscan start --intent "write a commit message for these changes"`, or `projscan start --intent "summarize my changes for a commit"`, it routes to `projscan_pr_diff` so changed exports, imports, call sites, complexity, and fan-in are reviewed before full review.
  For branch freshness and comparison questions, such as `projscan start --intent "is my branch stale?"` or `projscan start --intent "compare my branch with main"`, it also routes to `projscan_pr_diff` so the developer checks the structural diff before rebasing or asking for review. For rebase and merge-conflict recovery, such as `projscan start --intent "rebase went wrong"` or `projscan start --intent "resolve merge conflicts"`, it routes to `projscan_preflight --mode before_merge`; post-conflict test-plan wording such as `projscan start --intent "what should I test after resolving conflicts?"` stays on `projscan_regression_plan`.
  For resume questions, such as `projscan start --intent "where did I leave off?"`, `projscan start --intent "what changed while I was away?"`, `projscan start --intent "what changed while I was offline?"`, `projscan start --intent "what changed while I was asleep?"`, `projscan start --intent "what did the last agent touch?"`, or `projscan start --intent "what did the last agent do?"`, it routes to `projscan_session { action: "touched" }` so remembered touched files are reviewed before live preflight evidence gates the next edit.
  For parallel-agent coordination questions, such as `projscan start --intent "show coordination status for parallel agents"`, `projscan start --intent "who else is working on this?"`, `projscan start --intent "am I going to collide with another agent?"`, or `projscan start --intent "what worktrees are active?"`, it routes to `projscan_coordinate` so collisions, claims, merge order, and the current-worktree-versus-remembered-session evidence boundary are reviewed through one readiness verdict before editing continues. For merge-order wording, such as `projscan start --intent "what should merge first?"`, it routes to `projscan_merge_risk`; for overlap wording, such as `projscan start --intent "show me overlapping changes"`, it routes to `projscan_collision`.
  For active-claim questions, such as `projscan start --intent "show active claims"`, it routes to `projscan_claim { action: "list" }` so owners, leases, and contention warnings are reviewed before parallel work continues.
  For file-claim requests, such as `projscan start --intent "claim src/core/start.ts for me"`, it routes to `projscan_claim`, lists active claims first, then adds the requested target only after a real agent name replaces `Needs Input`.
  For architecture-coupling questions, such as `projscan start --intent "show circular dependencies"` or `projscan start --intent "find dependency cycles"`, it routes to `projscan_coupling` with `direction: "cycles_only"` / `projscan coupling --cycles-only --format json`; broader wording such as `projscan start --intent "what modules are tightly coupled"` routes to the full fan-in, fan-out, instability, cross-package-edge, and cycle report.
- **`projscan_workplan` / `projscan workplan`** — agent mission control. Composes preflight, review, session, hotspot, plugin-policy, and supply-chain evidence into prioritized tasks with suggested tools, exact verification commands, and short handoff text. Modes: `before_edit`, `before_commit`, `before_merge`, `refactor`, `release`, `bug_hunt`, and `hardening`.
- **`projscan_bug_hunt` / `projscan bug-hunt`** — bug-hunt action queue. Combines doctor issues, preflight, hotspots, and session coordination into ranked actions with verification commands; release-scale findings can be manual sign-off actions, while pure hotspot churn stays as watchlist/top-suspect evidence when health and gates are clean.
- **`projscan_agent_brief` / `projscan agent-brief`** — compact next-agent context packet with focus items, repo context, coordination hints, guardrails, and suggested next actions.
- **`projscan_quality_scorecard` / `projscan quality-scorecard`** — dimensioned quality view across health, security, tests, maintainability, coordination, top risks, and verification commands.
- **`projscan_understand` / `projscan understand`** — cited repo-comprehension surface. Returns repo maps, runtime flow maps, contract maps, change-readiness guidance, verification tiers, unknowns, read-first files, and exact next commands.
- **`projscan_adoption` / `projscan init team` / `projscan init mcp` / `projscan mcp doctor` / `projscan init policy` / `projscan init github-action` / `projscan recipes` / `projscan first-run` / `projscan telemetry` / `projscan dogfood`** — adoption layer. Returns MCP client config snippets, setup verification, policy starters, PR workflow scaffolding with validated PR comments and block-only enforcement, baseline memory, ownership routing, first-PR onboarding steps, repeatable team-bootstrap and PR-automation recipes, multi-repo dogfood evidence, measured reviewer feedback, default-off telemetry controls, adoption trial reports, and setup diagnostics.
- **`projscan_release_train` / `projscan release-train`** — product-line readiness planner. Plans upcoming product lines with version, scope, readiness, and next-action evidence.
- **`projscan_evidence_pack` / `projscan evidence-pack`** — approval packet. Combines planning, bug-hunt, workplan, preflight, trust calibration, owner routing, baseline trend, changelog, suggested next actions, and optional website prompt or validated PR-comment evidence in one response.
- **`projscan_regression_plan` / `projscan regression-plan`** — regression matrix. Builds smoke, focused, or full verification plans from bug-hunt, preflight, and product risk.
- **`projscan_doctor` / `projscan doctor`** — single 0–100 health score plus a list of issues across linting, formatting, tests, security, supply-chain trust, dependencies, dead code, and circular imports. Each issue carries a `suggestedAction` hint pointing at the fix-suggest pipeline (0.14+).
- **`projscan_preflight` / `projscan preflight`** — agent safety gate. Returns `proceed`, `caution`, or `block` with health, changed-file, review, remembered session, hotspot, plugin-policy, supply-chain, and release-scale evidence. `evidence.riskSources.currentWorktree` is current Git/worktree evidence; `evidence.riskSources.sessionMemory` is remembered handoff context. Use `--mode before_edit` at the start of work and `--mode before_commit` / `--mode before_merge` before handing off or merging; scale-only commit blocks are cautions, while merge gates still require manual release sign-off.
- **`projscan_hotspots` / `projscan hotspots`** — files ranked by `git churn × AST cyclomatic complexity × open issues × ownership × coverage`. Pass `view: "functions"` for top-N risky individual functions across the repo (0.13+).
- **`projscan_semantic_graph` / `projscan semantic-graph`** — stable v3 graph contract with file, function, package, and symbol nodes plus imports, exports, definitions, and calls edges. Use it when an agent needs one normalized graph shape instead of several targeted queries.
- **`projscan_dataflow` / `projscan dataflow`** — direct, propagated, and bridge source-to-sink dataflow risks, including framework-aware Next.js route request body and URL sources. Use it for a focused safety pass before touching command execution, raw SQL, filesystem writes, or DOM sinks.
- **`projscan_coupling` / `projscan coupling`** — per-file fan-in / fan-out / instability plus circular-import cycles (Tarjan SCC). Use `direction: cycles_only` or `projscan coupling --cycles-only` to surface architectural debt directly.
- **`projscan_analyze` / `projscan analyze`** — the everything report; useful at session start but verbose.

**Typical agent flow:** start with `projscan privacy-check`, then `projscan_start` with an optional plain-language intent. If no explicit mode is supplied, start infers the workflow mode from the intent, such as `before_commit` for commit-safety checks; read `modeSource` and `modeReason` to see whether the mode was explicit, inferred, or defaulted. `modeReason` distinguishes workflow-mode defaulting from action routing, so an impact intent can still route through Mission Control while the workflow stays `before_edit`. The `firstTenMinutes` path and current-worktree coordination hint follow that resolved mode, so a commit-safety start does not send the developer back through a before-edit gate. Follow `missionControl.actionPlan`, call `missionControl.readyActions` immediately, use `missionControl.executionPlan.currentPhase` as the cursor-aligned phase pointer, and use `missionControl.executionPlan.cursor.tool` / `args` when the cursor is directly MCP-callable. Use routed-intent weighted `confidence`, `score`, and `matchedKeywords` to judge weak or ambiguous matches, and read the same confidence line in console output when working manually. Fill any `missionControl.unresolvedInputs` before running placeholder follow-ups, inspect `missionControl.alternatives` when the intent mixes goals, stop only when `missionControl.successCriteria` is satisfied, and hand off with `missionControl.handoff`, `missionControl.runbook`, or the concise `missionControl.handoffPrompt`. Use `missionControl.reviewGate` as the autonomous-work stop boundary: finish the current checklist and proof, capture `git status --short` and `git diff --stat`, then wait for approval before another slice, release, publish, or deploy. Read `missionControl.reviewGate.worktree` for current worktree availability, changed-file count, base ref, and visible changed files. Use `missionControl.reviewGate.proof` when the reviewer needs the remaining proof queue without reading the full resume object. Read `missionControl.reviewGate.doneWhen` for the success criteria the reviewer must confirm before approving more work. Read `missionControl.reviewGate.policy` before continuing from a review handoff; it lists the actions blocked until explicit reviewer approval: another slice, release, publish, deploy, push, merge, and version bump. Use `projscan start --review-gate-json --intent "<goal>"` or saved `review-gate.json` when a script needs proof, worktree evidence, done criteria, decisions, and policy in one review object. Use `projscan start --review-policy --intent "<goal>"` or saved `review-policy.json` when a script only needs that approval boundary. Use `missionControl.reviewGate.decisions` as the approval menu in review gates, task cards, and runbooks; each decision includes copyable reviewer reply text so agents do not infer permission to continue, release, or publish. The default console review gate, saved mission bundle README, concise handoff prompt, `--review-replies`, and saved `review-replies.txt` show those replies for first-open review. `missionControl.handoff.reviewGate`, `--handoff-json`, and saved `handoff.json` carry that same gate for transfer-only flows. The handoff prompt starts with `missionControl.resume.prompt`, so it carries the current cursor, runnable command or blocked input instruction, labeled unlocks or blockers, done criteria, ready proof, review stop condition, and reviewer replies in one copyable sentence; the normal console prints that same value as `Handoff Prompt` without requiring JSON or `--include-handoff`, `projscan start --handoff-prompt --intent "<goal>"` prints only that prompt for piping or copy/paste, and the Markdown runbook renders it as `## Handoff Prompt` so copied runbooks carry the same next-agent prompt. When a human just needs the runnable shell step, `projscan start --next-command --intent "<goal>"` prints only the current cursor command; when an MCP agent needs the callable equivalent, `projscan start --next-tool-call --intent "<goal>"` prints the current cursor tool call as compact JSON. Cite `missionControl.proofSummary` plus the runnable-only `missionControl.proofCommands` in broad handoff notes, and use `missionControl.handoff.readyProof.items` when resuming because it is the complete ordered remaining-proof queue; each item carries its CLI command and an optional MCP `toolCall`. `missionControl.handoff.readyProof.commands` and `toolCalls` remain convenient command-only and MCP-callable views. If the repo has `AGENTLOOP.md` or `agentloop.config.json`, start adds `npm exec agentloop -- status` to the coordination/proof queue; if `.agentflight/config.json` exists, it adds `npm exec agentflight -- verify`. These harness commands are emitted for agents, scripts, saved mission bundles, and `--proof-commands`; start reports them but does not execute them. MCP agents should use `missionControl.resume.toolCall` when present, use `missionControl.resume.inputBindings` to map unlocked placeholders to input steps, then call `missionControl.resume.followUps` as the next template calls; when they need one ordered sequence, follow `missionControl.resume.checklist`, whose `run_proof` rows include `tool` and `args` for MCP-callable proof steps. The normal console `Resume Checklist` and Markdown runbook checklist print callable rows inline as `(MCP: ...)` and mark unmapped proof rows as `(CLI only)`, so a copied runbook or default terminal run remains self-contained even outside the JSON payload. After the current action, prefer `missionControl.resume.remainingProofItems` for complete proof, using `remainingProofToolCalls` for the callable MCP subset without rerunning the current command. Humans can run the matching `command`; the normal console `Ready Proof` command list, normal console `Proof Queue`, and runbook `Proof queue` all use remaining proof so the current cursor command is not repeated, and each queued item shows either its MCP call or `CLI only`. Use `projscan_understand` and `projscan_preflight` when you need broader context or a safety gate. Use `projscan_workplan` when you need an ordered execution plan, `projscan_agent_brief` for a compact handoff, and `projscan_evidence_pack --pr-comment` when you need reviewer-facing proof. Deeper tools such as `doctor`, `hotspots`, `dataflow`, `review`, `bug-hunt`, `quality-scorecard`, `dogfood`, and `trial` are follow-up tools.

For shortcut discovery, `projscan start --shortcuts --intent "<goal>"` prints the copyable command menu for the current mission, and `projscan start --shortcuts-json --intent "<goal>"` prints the same menu as JSON for agents and scripts. For shell copy/paste, `projscan start --mission-script --intent "<goal>"` prints a POSIX script that runs the current cursor command, then the remaining proof queue, then prints the review evidence commands. For MCP queue copy/paste, `projscan start --ready-tool-calls --intent "<goal>"` prints the current cursor call followed by remaining MCP-callable proof as compact JSON. For structured resume handoff, `projscan start --resume-json --intent "<goal>"` prints only `missionControl.resume`. For the complete transfer object, `projscan start --handoff-json --intent "<goal>"` prints only `missionControl.handoff`. For a file bundle, `projscan start --save-mission .projscan/mission --intent "<goal>"` writes `README.md`, `next-command.txt`, `next-tool-call.json`, `handoff-prompt.txt`, `resume-prompt.txt`, `task-card.md`, `review-gate.md`, `review-gate.json`, `review-policy.json`, `review-replies.txt`, the runbook, handoff JSON, resume JSON, `ready-tool-calls.json`, `shortcuts.json`, `mission.sh`, `status.sh`, `proof-logs/README.md`, `proof-logs/status.jsonl`, `proof-logs/run-report.md`, `proof-logs/summary.json`, proof commands, and manifest. Saved `mission.sh` writes current-command and proof-command output under `proof-logs/`, appends exit-code rows to `status.jsonl`, refreshes `run-report.md`, and writes `summary.json`, so reviewers and wrappers can scan pass/fail proof before opening raw logs. Bundle `status.sh` reads `summary.json` and uses exit codes `0`, `1`, and `2` for passed, failed, and not-ready states. For verification-only copy/paste, `projscan start --proof-commands --intent "<goal>"` prints the remaining ready proof commands one per line without the rest of the start report. For an ordered checklist without the full report, `projscan start --checklist --intent "<goal>"` prints only the resume checklist rows. For paste-ready PR, issue, or handoff notes, `projscan start --task-card --intent "<goal>"` prints the Markdown task card. MCP agents can read `missionControl.taskCard.markdown` when they need the same checklist without rendering it from `resume.checklist`. For stop-and-review notes, `projscan start --review-gate --intent "<goal>"` prints only `missionControl.reviewGate.markdown`, `projscan start --review-gate-json --intent "<goal>"` prints only the review gate JSON, `projscan start --review-policy --intent "<goal>"` prints only the review policy JSON, and `projscan start --review-replies --intent "<goal>"` prints only the copyable reviewer replies. For a full Markdown artifact, `projscan start --runbook --intent "<goal>"` prints the mission runbook. For post-run proof, `projscan mission-proof --mission .projscan/mission --format markdown` prints a paste-ready evidence report, while `--format json` keeps the same data machine-readable. Add `--list` to show saved mission bundles, status, update time, totals, and copyable resume/proof commands before choosing a target; add `--needs-attention` or `--mission-status failed` to focus that list. Add `--latest` to select the saved mission bundle with the newest `proof-logs/summary.json`. Add `--all` to include `.projscan/mission` and direct child bundles under `.projscan/missions/`. Add `--summary` when logs need one pass/fail line. Add `--require-passed` when a local script should fail unless every selected bundle passed. Add `--write reports/mission-proof.md` or `--write reports/mission-proof.json` when a reviewer, CI job, or next agent needs a saved local artifact. Run `projscan mission-proof --init-baseline manual-runs.json` before manual comparison if the team has not created the baseline file yet; use `--add-baseline-run manual-runs.json --id manual-1 --status passed --minutes-spent 25` to append measured manual runs without editing JSON. Run `--check-baseline manual-runs.json` before comparison when you want to validate the file without scanning mission bundles. Add `--format json` to baseline init, append, or check commands when a wrapper needs the written path, run count, added run, or totals. Baseline run IDs must be non-empty and unique; statuses must be `passed`, `failed`, `running`, `not_run`, or `unknown`; metric fields must be non-negative numbers.

#### Mission Control demos

The checked-in VHS demos show the current terminal flow without manual screen recording.

<img src="projscan-mission-control.gif" alt="projscan Mission Control shortcut menu for a plain-language goal" width="760">

```bash
npx projscan start --save-mission .projscan/mission --intent "what breaks if I rename the auth token loader?"
cd .projscan/mission && ./mission.sh && ./status.sh && ./review.sh
npx projscan start --mission .projscan/mission
npx projscan mission-proof --mission .projscan/mission --format markdown
```

<img src="projscan-mission-proof.gif" alt="projscan Mission Proof report and resume command reading a saved Mission Control bundle" width="760">

Regenerate the demos with:

```bash
npm run docs:demos
```

### 2. Review — "is this PR safe to merge?"

When the agent has changes in flight (or is asked to review someone else's), the question shifts from "what's wrong globally" to "what changed, and does the change introduce risk?"

- **`projscan_pr_diff` / `projscan pr-diff`** _(0.11+)_ — structural (AST) diff between two refs. Returns added / removed / modified files with explicit lists of exports, imports, call sites, and ΔCC / Δfan-in. Not a text diff: surfaces the symbols that moved, not the whitespace.
- **`projscan_review` / `projscan review`** _(0.13+)_ — **the headline tool for this phase**. Composes `pr_diff` + per-file risk + new/expanded import cycles + risky function additions + dependency changes + optional `contractChanges` for export and package-entrypoint changes + `newTaintFlows`, hardened `newDataflowRisks`, compact `graphEvidence`, and a verdict (`ok` / `review` / `block`). One tool call answers the whole question.
- **`projscan_preflight --mode before_merge` / `projscan_preflight { mode: "before_merge" }`** — smaller merge gate over review, changed-file health, taint, dataflow, session, hotspot, plugin, supply-chain, and release-scale signals. `evidence.releaseScale` marks large platform-release sign-off when review blocks on scale/complexity rather than a concrete defect. Use it when the agent needs the decision before reading the full review payload.

**Typical agent flow:** start with `projscan_review` for the verdict + summary; if it returns `review` or `block`, drill into the `riskyFunctions` and `newCycles` arrays for specifics.

### 3. Fix — "what should I do about it?"

projscan diagnoses but does not run an LLM. The agent (the LLM) is what writes the fix. projscan's job in this phase is to package the issue context into something the agent can act on.

- **`projscan_fix_suggest` / `projscan fix-suggest`** _(0.14+)_ — given an issue id (or a `file` + `rule` pair), return a structured action prompt: headline, why it matters, where to change, one-paragraph instruction, optional suggested test. Hand-tuned templates for ~12 common issue families plus a severity-anchored generic fallback.
- **`projscan_explain_issue` / `projscan explain-issue`** _(0.14+)_ — deep dive: code excerpt around the location, related issues touching the same file, similar past commits via `git log --grep=<rule>`. Use when an agent wants more context than `doctor` gave.
- **`projscan fix`** — rule-based auto-fix (ESLint, Prettier, Vitest scaffolding, EditorConfig). Pre-dates the `fix_suggest` flow; useful for the no-LLM-required class of fixes.

**Typical agent flow:** read an issue from `projscan_doctor`, call `projscan_fix_suggest` with its id, paste the `instruction` field into the agent's plan.

### 4. Reach — "what breaks if I change this?"

Before the agent commits to a refactor (or accepts a name-rename suggestion), the question is: _who depends on this thing, transitively?_

- **`projscan_impact` / `projscan impact`** _(0.15+)_ — transitive blast-radius. File mode returns every file that transitively imports the target, ranked by BFS distance. Symbol mode returns the symbol's definition file(s), the files that directly call it (their callSites match), and the transitive importers of those callers. Cycle-safe; depth-bounded.
- **`projscan_semantic_graph` (`query` mode) / `projscan semantic-graph`** — direct one-hop queries via `query: { direction, file?, symbol? }`: `imports`, `exports`, `importers`, `symbol_defs`, `package_importers`. Use when impact is overkill and you want a pin-point answer. Package wording such as `which files import package chalk`, `who uses lodash`, or `why do we depend on lodash` maps to `package_importers`. With no `query`, returns the full graph projection (file, function, package, and symbol context in one contract). _(Subsumes the former `projscan_graph`, removed in 4.0.)_

**Typical agent flow:** before renaming or deleting an export, call `projscan_impact --symbol <name>` to see the dependent set; before deleting a file, call `projscan_impact <path>`. The truncated flag tells you whether the actual blast radius extends beyond what you saw.

### 5. Live — "keep the index fresh while I work"

Long agent sessions edit files repeatedly. Each edit could otherwise cost a full repo re-scan. The watch infrastructure keeps the graph current at low cost.

- **`projscan watch`** _(0.16+)_ — long-running CLI command. On file change, debounces 200ms then runs the incremental graph update + re-runs `doctor`, printing a one-line status. Uses `node:fs.watch`, no new runtime dep. Filters out `node_modules`, `.git`, build dirs, etc.
- **`incrementallyUpdateGraph(graph, rootPath, changedPaths[])`** — the public API the watcher uses; exported so callers maintaining their own state can patch the graph in place after handling their own change events.
- **`--format html`** _(0.16+, expanded in 2.x)_ — for sharing review snapshots: `projscan analyze --format html > report.html` produces a self-contained HTML page suitable for posting as a PR comment or saving as a CI artifact. Renderers exist for `analyze`, `doctor`, `hotspots`, `coupling`, `pr-diff`, `review`, `impact`, and `coverage`.
- **`projscan mcp --watch`** _(1.3+)_ — when projscan runs as an MCP server with this flag, it pushes JSON-RPC `notifications/file_changed` events to the connected agent on every debounced batch. Long-session agents stop polling. The capability is advertised under `experimental.fileChanged` on the `initialize` response so clients can detect support.
- **`projscan_session` MCP tool + `projscan session` CLI** _(1.4+)_ — durable cross-invocation session. Auto-records every file path that any tool returned (`tool-result` source) and every fs-watch batch (`fs-watch` source), so multiple agent invocations against the same project share a "what's been touched here" view without re-running git. Idle window 1 hour by default; subactions: `current` / `touched` / `events` / `reset`. State lives at `.projscan-cache/session.json`.
- **MCP resources** _(2.1+)_ — `projscan://session/summary`, `projscan://handoff`, and `projscan://risk-now` expose the shared session as resource reads. Agents can pick up touched files, coordination conflicts, remaining risks, `coordinationHints`, and recommended next tool calls without spending a tool call on discovery. The hints separate current worktree checks from remembered session context and conflict resolution.

**Typical workflow:** start `projscan watch` in a side terminal at the start of a long session; subsequent agent tool calls hit a warm graph cache. With multi-agent setups, every MCP tool call additionally records into the session, so a coordinator agent can ask `projscan_session { action: "touched" }` to see what its peers have touched.

---

## Commands In Depth

### analyze

```bash
projscan analyze
```

The flagship command. Runs every detection module and produces the full project report.

**What it does internally:**

1. Builds the scan file set. In Git repos, projscan uses `git ls-files --cached --others --exclude-standard` by default, then applies built-in noise ignores and `.projscanrc` `ignore` globs. Non-Git folders fall back to the local file walker.
2. Builds a language breakdown by mapping file extensions to language names
3. Detects frameworks by inspecting `package.json` dependencies and config file presence
4. Analyzes dependencies from `package.json`
5. Runs all issue analyzers (ESLint, Prettier, tests, architecture, dependency risk, security)
6. Applies `.projscanrc` rules (disabled rules, severity overrides)
7. Renders the combined report

**Options:**

| Flag               | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `--changed-only`   | Only report issues on files changed vs base ref          |
| `--base-ref <ref>` | Git base ref for `--changed-only` (default: origin/main) |

<img src="https://abhiyoheswaran.com/images/projscan/hero-poster.png" alt="npx projscan analyze: banner, scan progress, full project report" width="700">

### doctor

```bash
projscan doctor
```

A focused health check. Runs only the issue detection pipeline and presents results as a health report with a health score and letter grade.

Use this when you want a quick "is this project in good shape?" answer without the full language/framework breakdown.

**Options:**

| Flag               | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `--changed-only`   | Only report issues on files changed vs base ref          |
| `--base-ref <ref>` | Git base ref for `--changed-only` (default: origin/main) |

<img src="npx%20projscan%20doctor.gif" alt="npx projscan doctor" width="700">

**Severity levels:**

- **error** (✖) - Problems that should be addressed immediately
- **warning** (⚠) - Issues that affect code quality or maintainability
- **info** (ℹ) - Suggestions for best practices

### hotspots

```bash
projscan hotspots
```

<img src="https://abhiyoheswaran.com/images/projscan/hotspots-poster.png" alt="projscan hotspots output ranking files by composite risk score" width="700">

Ranks files by **risk** - a combination of git churn, complexity (lines of code), open issues, recency, and ownership (bus-factor). Turns a flat health score into a prioritized "fix these first" list.

**Options:**

| Flag             | Description                                                | Default                                     |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------- |
| `--limit <n>`    | Number of hotspots to show                                 | 10 (or `hotspots.limit` from `.projscanrc`) |
| `--since <when>` | Git history window (e.g. `"6 months ago"`, `"2024-01-01"`) | `12 months ago`                             |

**What you get per file:**

- `riskScore` - combined score (0–100)
- `churn` - number of commits touching the file in the window
- `distinctAuthors` - how many people have touched it
- `primaryAuthor` / `primaryAuthorShare` - who owns most of the history
- `busFactorOne` - **true** if a single author dominates AND churn is high (organizational risk)
- `issueIds` - open issues that reference the file
- `reasons` - human-readable tags explaining the score

**Fallback:** If the project isn't a git repository, hotspots returns `available: false` with a friendly reason - it does not crash.

### semantic-graph

```bash
projscan semantic-graph --format json
projscan semantic-graph --query importers --file src/auth.ts --format json
projscan semantic-graph --query exports --file src/auth.ts --format json
projscan semantic-graph --query symbol_defs --symbol authenticate --format json
projscan semantic-graph --query package_importers --symbol chalk --format json
```

Returns the stable semantic graph contract: `schemaVersion: 3`, `nodes`, `edges`,
`metrics`, `truncated`, and `limits`. Nodes use stable prefixes (`file:`,
`function:`, `package:`, `symbol:`); edges use `defines`, `imports`,
`imports_package`, `exports`, and `calls`.

Use this when an agent needs one graph-shaped payload for planning, ownership
analysis, plugin logic, or custom visualization instead of making several
targeted `projscan_semantic_graph` queries.
Use `--query` when the agent needs one pin-point answer from the CLI: who imports
a file, what a file imports or exports, where a symbol is defined, or which files
import a package.

**Options:**

| Flag                  | Description                                                                              | Default    |
| --------------------- | ---------------------------------------------------------------------------------------- | ---------- |
| `--max-nodes <n>`     | Maximum nodes to return                                                                  | 10000      |
| `--max-edges <n>`     | Maximum edges to return                                                                  | 25000      |
| `--query <direction>` | Targeted query: `imports`, `exports`, `importers`, `symbol_defs`, or `package_importers` | full graph |
| `--file <path>`       | Repo-relative file for `imports`, `exports`, or `importers`                              | -          |
| `--symbol <name>`     | Symbol/package for `symbol_defs` or `package_importers`                                  | -          |
| `--limit <n>`         | Maximum targeted query entries                                                           | 50         |

### understand

```bash
projscan understand --view map --format json
projscan understand --view flow --format json
projscan understand --view contracts --format json
projscan understand --view change --intent "rename auth token loader" --format json
projscan understand --view verify --format json
```

Repo understanding for engineers before they edit. The command returns a cited report with `claims`, `readFirst`, `entrypoints`, `boundaries`, `flows`, `contracts`, `changeReadiness`, `verification`, `risks`, `unknowns`, and exact next commands.

Views:

| View        | Use it for                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------ |
| `map`       | Orient around entrypoints, package boundaries, read-first files, risks, and unknowns             |
| `flow`      | Trace runtime paths and side-effect sinks through graph-backed evidence                          |
| `contracts` | Inspect public exports, config/env contracts, and likely breaking-change risks                   |
| `change`    | Tie an intent to blast radius, first safe edit, owner state, rollback, and verification commands |
| `verify`    | Build minimal, focused, and full proof tiers plus direct-test gap evidence                       |

**Options:**

| Flag              | Description                                            | Default |
| ----------------- | ------------------------------------------------------ | ------- |
| `--view <view>`   | `map`, `flow`, `contracts`, `change`, or `verify`      | `map`   |
| `--intent <text>` | Planned change or question for change-readiness output | none    |
| `--max-items <n>` | Maximum items per section                              | 8       |

### dataflow

```bash
projscan dataflow --format json
```

Reports focused direct, propagated, and bridge source-to-sink risks over the function
graph. Bridge risks are graph-backed dataflow additions: a wrapper that calls a source reader
and a sink wrapper is surfaced even when legacy taint reachability cannot see a
downstream call path from source to sink. By default, dataflow suppresses test-file paths,
broad readFile/writeFile-style noise, and JavaScript RegExp.exec false positives.
Framework request-source detection covers narrow tested patterns for Next.js, Hono,
Express, Fastify, and Koa handlers, including Hono validator output,
Express/Fastify/Koa request IP metadata, Fastify host/hostname and raw
URL/header evidence, and Express/Koa header accessors plus Express
`req.param(...)` and `req.originalUrl`, while
keeping lookalike helpers quiet.

For release hardening, `npm run check:graph-corpus` compares bundled fixture metrics against `docs/graph-corpus-baseline.json`. The gate fails only when graph coverage drops below the baseline or dataflow risks rise above it.

**Options:**

| Flag                      | Description                                          | Default            |
| ------------------------- | ---------------------------------------------------- | ------------------ |
| `--source <name...>`      | Add custom source identifiers                        | Built-ins + config |
| `--sink <name...>`        | Add custom sink identifiers                          | Built-ins + config |
| `--max-risks <n>`         | Maximum risks to return                              | 50                 |
| `--include-tests`         | Include risks that touch test files                  | false              |
| `--include-broad-file-io` | Include broad default readFile/writeFile-style risks | false              |

### search

```bash
projscan search <query>
projscan search "npm audit" --scope auto
projscan search authenticate --scope symbols
projscan search stripe --scope files
```

<img src="https://abhiyoheswaran.com/images/projscan/search-poster.png" alt="projscan search output showing ranked results for the query ContactForm" width="700">

BM25-ranked search across content, symbol names, and path tokens. No embeddings, no model download - just a solid classical IR implementation that beats substring matching for typical code queries.

**Scopes:**

| Scope            | What it matches                                | Ranking                                      |
| ---------------- | ---------------------------------------------- | -------------------------------------------- |
| `auto` (default) | Content, with symbol + path boost              | BM25 + symbol boost × 2.0 + path boost × 0.5 |
| `content`        | Same as `auto`                                 | BM25                                         |
| `symbols`        | Names of exported functions/classes/types/etc. | Exact → prefix → substring                   |
| `files`          | Relative path substring                        | Path order                                   |

**Query handling:**

- Tokens are split on camelCase, snake_case, and digits. `userAuthToken` indexes as `user`, `auth`, `token`.
- Light stemming (trailing `-s`, `-ing`, `-ed` stripped).
- Stopwords and TypeScript keywords filtered (`the`, `function`, `class`, `export`, …).
- Multi-word queries are OR across tokens, ranked by sum of BM25 scores.

**Output includes:** file path, line number, a one-line excerpt centered on the first matching line, the match score, and which tokens matched.

**Limitations:**

- No real semantic understanding by default. Searching for _"payment processing"_ won't find a file that implements Stripe under the name `charge()`. True semantic search (local embeddings) shipped in 0.9.0 as an opt-in peer dep - install `@xenova/transformers` and pass `--mode semantic` (or `--mode hybrid` for BM25 + semantic via reciprocal rank fusion).
- Index is rebuilt on every run (fast - the AST is already parsed from the code-graph cache).

### file

```bash
projscan file src/cli/index.ts
```

Per-file drill-down. Combines everything ProjScan knows about a file into one view:

- **Purpose** - inferred from name and directory
- **Imports** / **exports** - from regex-based static analysis
- **Hotspot risk** - the file's entry from `hotspots` (churn, score, owner, bus factor)
- **Related issues** - every open issue whose `locations` reference the file
- **Inline smells** - large files, `console.log`, TODO/FIXME, `any` types

Natural follow-up to `projscan hotspots` - once hotspots tells you _which_ file to look at, `file` tells you _what_ to do about it.

### ci

```bash
projscan ci
```

A CI-pipeline-friendly health gate. Runs the full health check and exits with code 1 if the score falls below a threshold. No spinners or banners - clean output for CI logs.

**Options:**

| Flag               | Description                                      | Default                                                     |
| ------------------ | ------------------------------------------------ | ----------------------------------------------------------- |
| `--min-score <n>`  | Minimum passing score (0–100)                    | `minScore` from `.projscanrc`, else 70                      |
| `--changed-only`   | Gate only on issues in files changed vs base ref | off                                                         |
| `--base-ref <ref>` | Git base ref for `--changed-only`                | auto (origin/main → origin/master → main → master → HEAD~1) |

**Example:**

```bash
$ projscan ci --min-score 80

projscan: B (82/100) - 0 errors, 2 warnings, 1 info - PASS (threshold: 80)
```

<img src="npx%20projscan%20ci%20--min-score%2070.gif" alt="npx projscan ci" width="700">

**Exit codes:**

- `0` - Score meets or exceeds the threshold
- `1` - Score is below the threshold

**JSON output** (useful for scripts):

```bash
projscan ci --min-score 70 --format json
```

**SARIF output** (for GitHub Code Scanning or any SARIF consumer):

```bash
projscan ci --format sarif > projscan.sarif
```

**PR-diff mode** (only gate on issues in changed files):

```bash
projscan ci --changed-only
projscan ci --changed-only --base-ref origin/develop
```

See [PR-Diff Mode](#pr-diff-mode---changed-only) for details.

### diff

```bash
projscan diff
```

Compare your project's current health and hotspots against a saved baseline. Useful for tracking whether a codebase is improving or degrading over time.

**Options:**

| Flag                | Description                                                |
| ------------------- | ---------------------------------------------------------- |
| `--save-baseline`   | Save current health + top hotspots as the baseline         |
| `--baseline <path>` | Path to baseline file (default: `.projscan-baseline.json`) |

**Workflow:**

```bash
# Step 1: Save current state as baseline
$ projscan diff --save-baseline

  Baseline saved to /path/to/project/.projscan-baseline.json
  Score: D (60/100)
  Issues: 2
  Hotspots snapshotted: 14

# Step 2: Make changes, then compare
$ projscan diff
```

The diff reports four hotspot movements: files that **rose**, **fell**, **appeared**, or were **resolved** since the baseline - alongside the usual new/resolved issue lists.

<img src="npx%20projscan%20diff%20--save-baseline.gif" alt="npx projscan diff --save-baseline" width="700">

### fix

```bash
projscan fix
```

Detects fixable issues and offers to auto-remediate them. Shows you exactly what will change before applying anything.

**Non-interactive mode:**

```bash
projscan fix -y
```

**Available fixes:**

| Fix            | What it creates                                                           | What it installs                                       |
| -------------- | ------------------------------------------------------------------------- | ------------------------------------------------------ |
| ESLint         | `eslint.config.js` (with TypeScript support if TS is detected)            | `eslint`, `@eslint/js`, optionally `typescript-eslint` |
| Prettier       | `.prettierrc` with sensible defaults                                      | `prettier`                                             |
| Test framework | `vitest.config.ts` + sample test file, adds `test` script to package.json | `vitest`                                               |
| EditorConfig   | `.editorconfig` (UTF-8, LF, 2-space indent, trim trailing whitespace)     | Nothing                                                |

### diagram

```bash
projscan diagram
```

Generates an ASCII architecture diagram. Scans your directory structure and framework detection results to identify architectural layers.

<img src="npx%20projscan%20diagram.gif" alt="npx projscan diagram" width="700">

### structure

```bash
projscan structure
```

Renders a tree view of the project directory with file counts per directory.

<img src="npx%20projscan%20structure.gif" alt="npx projscan structure" width="700">

### dependencies

```bash
projscan dependencies
```

Deep dive into your project's dependency graph - production/dev counts, package manager, lock file presence, and risk analysis (wildcard versions, `latest` tags, excessive counts).

<img src="npx%20projscan%20dependencies.gif" alt="npx projscan dependencies" width="700">

### outdated

```bash
projscan outdated
```

Offline drift check - compares the version declared in `package.json` against the version installed under `node_modules/<pkg>/package.json`. Classifies each package as `patch`, `minor`, `major`, `same`, or `unknown` drift. Does **not** hit the npm registry.

**Output fields per package:**

- `declared` - the range in `package.json` (e.g., `^1.2.3`)
- `installed` - the concrete version in `node_modules`, or `null` if not installed
- `latest` - same as `installed` in this offline drift check
- `drift` - classification
- `scope` - `dependency` or `devDependency`

JSON, Markdown, and SARIF formats are supported.

### audit

```bash
projscan audit
```

Wraps `npm audit --json` and normalizes the output. Requires a `package-lock.json`. Graceful error for `yarn.lock` / `pnpm-lock.yaml` projects (suggests the right native command).

**Per-finding fields:** `name`, `severity` (`critical` / `high` / `moderate` / `low` / `info`), `title`, `url`, `cve`, `via`, `range`, `fixAvailable`.

**Summary:** counts per severity.

**SARIF output:**

```bash
projscan audit --format sarif > audit.sarif
```

Each finding becomes a SARIF result with `ruleId: audit-<pkg>`, severity mapped to `error` / `warning` / `note`, anchored to `package.json`. Pipe into `github/codeql-action/upload-sarif` or the first-party projscan Action and vulnerabilities show up in the Security → Code scanning tab.

**Options:**

| Flag             | Description                | Default |
| ---------------- | -------------------------- | ------- |
| `--timeout <ms>` | Override npm audit timeout | 60000   |

### upgrade

```bash
projscan upgrade <package>
```

Preview the impact of upgrading a package. The default path is fully offline; pass `--check-registry` when you explicitly want npm registry lookup for the current latest npm version.

**What you get:**

- Drift classification (`patch` / `minor` / `major`)
- Breaking-change markers found in the CHANGELOG: scans for `BREAKING CHANGE`, `deprecated`, `removed support`, `no longer supported`, and section headers containing "breaking"
- CHANGELOG excerpt sliced to the relevant version range (read from `node_modules/<pkg>/CHANGELOG.md`)
- Importer list - every file in your source tree that imports the package (direct or sub-path)
- Python manifest evidence for packages declared in `pyproject.toml` (including PEP 735 `dependency-groups`, Poetry dependency groups, and legacy `tool.poetry.dev-dependencies`), `setup.cfg`, `setup.py`, or root `requirements*.txt`. Root Python manifests are sufficient local evidence even before `.py` files exist.
- Python current-version evidence from `poetry.lock` / `uv.lock` / `pdm.lock` package blocks, `conda-lock.yml` / `conda-lock.yaml` package entries, `Pipfile.lock` exact versions, pinned root `requirements*.txt`, or pinned root `constraints*.txt` entries

**Example:**

```bash
$ projscan upgrade react --format markdown

# Upgrade Preview - `react`
- Declared: `^18.2.0`
- Installed: `18.3.1`
- Drift: **minor**

## Importers (14)
- `src/App.tsx`
- `src/components/Button.tsx`
- ...
```

**Limitations:**

- Reads the CHANGELOG that npm already placed in `node_modules/`. If the package author doesn't ship one, you'll see "No local CHANGELOG found."
- Without `--check-registry`, works with what's **installed** and reports `latestSource: "installed"`. With `--check-registry`, npm registry lookup is attempted and failures fall back to the installed version with `registryError`.
- Python previews stay offline. They do not query PyPI; current-version evidence comes from supported local lockfiles, pinned root requirements, or pinned root constraints.

### coverage

```bash
projscan coverage
```

Joins test coverage with the hotspot ranking and produces a list sorted by "risk × uncovered fraction" - the files that most deserve tests.

**Supported formats** (auto-detected in this order):

- `coverage/lcov.info` - lcov format (Vitest, Jest, c8)
- `coverage/coverage-final.json` - Istanbul per-file detail
- `coverage/coverage-summary.json` - Istanbul summary

**Output fields per entry:**

- `relativePath` - file path
- `riskScore` - the file's hotspot risk
- `coverage` - line coverage %, or `null` if the file isn't in the coverage report
- `priority` - `riskScore × (0.3 + 0.7 × uncoveredFraction)`; files without coverage data treat `uncovered = 1`
- `reasons` - inherited from the hotspot entry, including any `low coverage (X%)` or `moderate coverage (X%)` tags

**Options:**

| Flag          | Description                 | Default      |
| ------------- | --------------------------- | ------------ |
| `--limit <n>` | Number of entries to return | 30 (max 200) |

**How it feeds into `hotspots`:** when any coverage file exists, `projscan hotspots` automatically passes it into the risk calculator. Uncovered churning files get a score bump and a `low coverage (X%)` reason tag. No coverage file? Hotspots behaves exactly as before.

### badge

```bash
projscan badge
```

Calculates the project health score and generates a [shields.io](https://shields.io) badge you can add to your README.

<img src="npx%20projscan%20badge.gif" alt="npx projscan badge" width="700">

### mcp

```bash
projscan mcp
projscan mcp --watch    # 1.3+: also push notifications/file_changed on every batch
```

Runs ProjScan as an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server over stdio. AI coding agents (Claude Code, Cursor, Windsurf, any MCP client) can call ProjScan during a session to ground their suggestions in live project state.

With `--watch`, the server starts an in-process file watcher and emits a JSON-RPC `notifications/file_changed` notification on every debounced batch (paths + post-update graph size + timestamp). The capability is advertised under `experimental.fileChanged` on the `initialize` response so clients can detect support before subscribing. Off by default — agents that don't need push updates pay nothing for it.

See [MCP Server for AI Agents](#mcp-server-for-ai-agents).

### session _(1.4+)_

```bash
projscan session                        # current session summary
projscan session touched                # files touched this session, newest-first
projscan session touched --source fs-watch
projscan session events                 # event log, newest-first
projscan session reset                  # discard the current session
```

Inspects the durable cross-invocation session that the MCP server populates as agents work. State lives at `.projscan-cache/session.json` and is shared by every agent invocation against the same project. A new session starts when no previous session exists or when the previous one has been idle for more than an hour.

Touches come from three sources:

- **`tool-result`** — every MCP `tools/call` result is scanned for repo-relative file paths under known fields (`file`, `relativePath`, `paths`, `definitions`, `importers`, `reachable`, etc.) and each is auto-recorded.
- **`fs-watch`** — when `projscan mcp --watch` is on, every debounced file-change batch also records each changed path.
- **`explicit`** — reserved for future "agent says it edited X" hooks.

`projscan_session { action: "current" | "touched" | "events" | "reset" }` is the MCP-side mirror. Session resources and `projscan_agent_brief` include `coordinationHints` such as `current-worktree-check`, `remembered-session-context`, and `resolve-conflicts`, each with an exact follow-up command.

---

### trial

`projscan trial` is the top-level local adoption-readiness report. It wraps first-run activation, multi-repo dogfood, reviewer feedback summary, market validation, trust signals, and website proof into one verdict: `adopt`, `pilot`, `tune`, or `setup`.

```bash
projscan trial --repo ../api --repo ../web --repo ../worker --feedback .projscan-feedback.json --format json
```

Use it when deciding whether projscan is useful enough for a team to run on every PR.

### telemetry

`projscan telemetry` exposes explicit default-off telemetry controls. It is for anonymous product-health metrics only; it never sends source code, file paths, repo names, branch names, package names, usernames, emails, raw findings, secrets, environment values, or scan reports.

```bash
projscan telemetry status
projscan telemetry explain
projscan telemetry enable
projscan telemetry disable
```

Use it alongside `projscan feedback`: telemetry can show whether teams finish setup and come back next week, while explicit feedback is still the evidence for minutes saved, prevented bad edits, and false positives.

### dogfood

`projscan dogfood` is the adoption proof loop. It evaluates one or more real repositories and reports whether each repo can produce a validated PR comment, expose the repeat-use loop in `projscan start`, and pass basic MCP/setup readiness.

```bash
projscan dogfood --repo ../api --repo ../web --repo ../worker --format json
```

For market validation, capture structured reviewer feedback first:

```bash
projscan feedback init --output .projscan-feedback.json
projscan feedback add --file .projscan-feedback.json --repo api --pr https://github.com/acme/api/pull/42 --reviewer @alice --useful true --minutes-saved 10
projscan feedback summary --file .projscan-feedback.json --format json
projscan dogfood --repo ../api --repo ../web --repo ../worker --feedback .projscan-feedback.json --format json
```

Use it before broader rollout. The report includes feedback questions for the first real PR: did the comment save 10-20 minutes, what was missing or noisy, and which owner or command should have been clearer. With `--feedback`, the report also includes `marketValidation`: useful response count, total minutes saved, risky edits prevented, repeat PR use, false-positive reports, and website-ready proof markdown.

## Health Score

Every `projscan doctor` and `projscan badge` run calculates a health score from 0 to 100 based on detected issues.

**Scoring:**

| Severity | Deduction per issue |
| -------- | ------------------- |
| Error    | -20 points          |
| Warning  | -10 points          |
| Info     | -3 points           |

**Grade thresholds:**

| Grade | Score Range | Meaning                                    |
| ----- | ----------- | ------------------------------------------ |
| A     | 90–100      | Excellent - project follows best practices |
| B     | 80–89       | Good - minor improvements possible         |
| C     | 70–79       | Fair - several issues to address           |
| D     | 60–69       | Poor - significant issues found            |
| F     | < 60        | Critical - major issues need attention     |

The score appears in all output formats:

- **Console**: Shown at the top of the doctor report
- **JSON**: Included as `health.score` and `health.grade` fields
- **Markdown**: Shown as a heading with an auto-generated shields.io badge
- **HTML**: Shown in the health summary card
- **SARIF**: Not surfaced directly - SARIF is per-issue, not per-project. The score still drives `ci`'s exit code.

---

## Output Formats

Every command accepts the `--format` flag, but supported formats are command-dependent. Unsupported combinations fail with a clear message instead of falling back to console output.

### Console (default)

Rich, colored terminal output with Unicode box-drawing characters and status icons. Best for interactive use.

### JSON

Machine-readable output. Useful for piping into other tools, storing results, or building dashboards.

```bash
projscan analyze --format json | jq '.issues[] | select(.severity == "error")'
projscan analyze --format json > analysis.json
projscan analyze --report-scope src/api --redact-paths --format json > scoped-analysis.json
projscan analyze --report-policy apiEvidence --format json > scoped-analysis.json
```

### Markdown

Formatted Markdown suitable for saving as documentation or pasting into a PR description.

```bash
projscan doctor --format markdown > HEALTH.md
```

### HTML

Self-contained HTML output for sharing scan, health, review, and risk snapshots.

```bash
projscan analyze --format html > analysis.html
projscan doctor --format html > HEALTH.html
```

Supported on `analyze`, `doctor`, `hotspots`, `coupling`, `pr-diff`, `review`, `impact`, and `coverage`.
For `analyze` and `doctor`, scoped/redacted report controls also appear as a
path-safe controls card when active.
Path redaction keeps HTTP(S) documentation links readable while redacting
standalone file-like path tokens from issue text.

### SARIF

[SARIF 2.1.0](https://sarifweb.azurewebsites.net/) output - the industry standard for static analysis results. GitHub Code Scanning, Azure DevOps, GitLab, and many other systems consume SARIF natively.

```bash
projscan ci --format sarif > projscan.sarif
```

Supported on `analyze`, `audit`, `ci`, `doctor`, and `outdated`. Each issue is emitted as a SARIF `result` with:

- `ruleId` - stable rule identifier (e.g., `hardcoded-secret`, `missing-prettier`)
- `level` - `error`, `warning`, or `note` (mapped from projscan severity)
- `message.text` - the issue description
- `locations` - real file + line/column when the analyzer can supply them (security findings include line numbers); project-level issues anchor to repo root
- `properties.category` - the analyzer category (`security`, `formatting`, `architecture`, …)

For shareable evidence artifacts, `analyze`, `doctor`, and `ci` accept
`--report-policy <name>`, `--report-scope <paths>`, and `--redact-paths`. Scope
is comma-separated and repo-relative. Redaction replaces file paths with stable
labels while preserving correlation across issues and files in the same report,
including file-like path tokens in issue text that has no location anchor.
JSON/SARIF include path-safe `reportControls` metadata, and Markdown/HTML print
path-safe controls banners. Direct `--report-scope` and `--redact-paths` flags
override the selected preset for a single run.
- `properties.fixAvailable` - whether `projscan fix` can remediate it

When uploaded to GitHub Code Scanning, findings appear in the **Security → Code scanning** tab and (for PRs) as inline annotations on changed lines.

---

## Configuration (`.projscanrc`)

ProjScan loads a project-wide config from one of:

1. A path passed via `--config <path>`
2. `.projscanrc.json` at the repository root
3. `.projscanrc` at the repository root (JSON format)
4. A `"projscan"` key in `package.json`

**CLI flags always win over config.** The config provides defaults; flags override on a per-run basis.

### Example `.projscanrc.json`

```json
{
  "minScore": 80,
  "baseRef": "origin/main",
  "ignore": ["**/fixtures/**", "**/generated/**"],
  "scan": {
    "includeIgnored": false,
    "scanEnvValues": false,
    "offline": false
  },
  "disableRules": ["missing-editorconfig", "large-*"],
  "severityOverrides": {
    "missing-prettier": "info"
  },
  "reportPolicies": {
    "apiEvidence": {
      "reportScope": ["src/api", "packages/backend"],
      "redactPaths": true
    }
  },
  "hotspots": {
    "limit": 20,
    "since": "6 months ago"
  }
}
```

### Fields

| Field                 | Type                                             | Effect                                                                                                                                                        |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minScore`            | number (0–100)                                   | Default threshold for `projscan ci`. Clamped to 0–100.                                                                                                        |
| `baseRef`             | string                                           | Default base ref for `--changed-only`.                                                                                                                        |
| `ignore`              | string[]                                         | Extra glob patterns added to the built-in ignore list (`node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `.nuxt`, `.cache`, `.turbo`, `.output`). |
| `scan.includeIgnored` | boolean                                          | Explicitly include files hidden by Git ignore rules. Default `false`.                                                                                         |
| `scan.scanEnvValues`  | boolean                                          | Explicitly read `.env*` contents during secret-pattern checks. Default `false`; `.env` files are path-only.                                                   |
| `scan.offline`        | boolean                                          | Block projscan network-capable features: telemetry sending, `audit`, registry checks, and optional semantic model loading. Default `false`.                   |
| `disableRules`        | string[]                                         | Silence rules by id. Exact match (`missing-prettier`) or wildcard prefix (`large-*`).                                                                         |
| `severityOverrides`   | `Record<string, 'info' \| 'warning' \| 'error'>` | Remap a rule's severity. Useful for downgrading project-specific false positives without disabling them.                                                      |
| `reportPolicies`      | `Record<string, { reportScope?: string[]; redactPaths?: boolean }>` | Named evidence export presets selected with `--report-policy <name>` on `analyze`, `doctor`, and `ci`.                                      |
| `hotspots.limit`      | number (1–100)                                   | Default limit for `projscan hotspots`.                                                                                                                        |
| `hotspots.since`      | string                                           | Default git history window for `projscan hotspots`.                                                                                                           |

Invalid JSON in a discovered config file is a hard error - projscan exits rather than silently ignoring it.

### Embedded config in `package.json`

If you prefer to keep everything in `package.json`:

```json
{
  "name": "my-app",
  "projscan": {
    "minScore": 80,
    "disableRules": ["missing-editorconfig"]
  }
}
```

### Monorepo: cross-package import policy _(0.14+)_

In a monorepo, you can declare which packages may import which. Violations surface as `cross-package-violation-N` issues in `projscan_doctor` and on the CLI. The analyzer is **off by default**; adding any rule turns it on for the matching `from` package.

```json
{
  "monorepo": {
    "importPolicy": [
      { "from": "web", "allow": ["shared", "ui-kit"] },
      { "from": "shared", "deny": ["web", "api"] },
      { "from": "scripts", "allow": ["*"] }
    ]
  }
}
```

Each rule has a `from` (source package name, matches `WorkspacePackage.name`) plus exactly one of `allow` or `deny`:

- **`allow`** is allow-list semantics: edges out of `from` are only permitted to packages in the list. Anything else is denied.
- **`deny`** is deny-list semantics: edges out of `from` are permitted unless the target is in the list.

Patterns support `*` (wildcard), `pkg/*` (suffix glob), `*/sub` (prefix glob), and exact package names. The check runs once per `buildCodeGraph` call; capped at 50 reported violations per run to keep doctor output bounded.

**Why use it:** to keep refactoring options open inside a package. If `web` is only allowed to import from `shared` and `ui-kit`, then changes inside `api`'s internals can't break `web` no matter how aggressive. The rules document the intended layering and the CI guard enforces it.

---

## PR-Diff Mode (`--changed-only`)

For CI on pull requests, you usually only care about issues that **this PR introduced** - not the long tail of legacy warnings elsewhere in the repo. `--changed-only` scopes the report to files changed vs a base ref.

**How it decides what's "changed":**

1. If `--base-ref <ref>` is passed explicitly, use that.
2. Otherwise, try in order: `origin/main`, `origin/master`, `main`, `master`, `HEAD~1`.
3. If none of those refs exist, fall back to uncommitted working-tree changes (`git status --porcelain`).
4. If the project isn't a git repository, skip the filter and report everything, with a warning on stderr.

**How it filters:**

Issues that carry a `location` (file path) are kept only if that file appears in the changed set. **Project-level issues without a location are dropped** in `--changed-only` mode - that's intentional: "No ESLint config" is a real issue, but it shouldn't block every PR that doesn't touch ESLint.

**When to use it:**

- `projscan ci --changed-only` on every PR
- Skip it on pushes to `main` (you want to see all project-level issues there)
- Combine with a looser `--min-score` on PRs and a stricter one on `main`

Example GitHub Actions snippet:

```yaml
- uses: abhiyoheswaran1/projscan@v1
  with:
    min-score: ${{ github.event_name == 'pull_request' && '60' || '70' }}
    changed-only: ${{ github.event_name == 'pull_request' }}
```

---

## Global Options

| Option              | Description                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `--format <type>`   | Output format: `console` (default), `json`, `markdown`, `sarif`, `html` (command-dependent) |
| `--config <path>`   | Path to a `.projscanrc` config file                                                         |
| `--include-ignored` | Explicitly include files hidden by Git ignore rules                                         |
| `--scan-env-values` | Explicitly read `.env*` contents during secret checks                                       |
| `--offline`         | Block projscan network-capable features for this run                                        |
| `--changed-only`    | Scope to files changed vs base ref (applies to `analyze`, `doctor`, `ci`)                   |
| `--base-ref <ref>`  | Git base ref for `--changed-only` (default: origin/main)                                    |
| `--report-policy <name>` | Use a named report policy preset from config (`analyze`, `doctor`, `ci`)              |
| `--report-scope <paths>` | Comma-separated repo-relative paths to include in exported evidence (`analyze`, `doctor`, `ci`) |
| `--redact-paths`    | Replace file paths in exported evidence with stable labels (`analyze`, `doctor`, `ci`)      |
| `--verbose`         | Show debug-level logging - useful for diagnosing scan issues                                |
| `--quiet`           | Suppress all non-essential output (spinners, status messages)                               |
| `-V, --version`     | Print the version number                                                                    |
| `-h, --help`        | Print help for any command                                                                  |

**Per-command help:**

```bash
projscan fix --help
projscan ci --help
```

---

## What ProjScan Detects

### Languages

ProjScan maps file extensions to language names. Supported languages include TypeScript, JavaScript, Python, Go, Rust, Java, C#, C++, C, Ruby, PHP, Swift, Kotlin, Dart, Lua, Scala, R, Shell, CSS, SCSS/Sass, HTML, JSON, YAML, Markdown, SQL, and more.

The **primary language** is the one with the most files.

### Frameworks and Libraries

Detection uses two strategies:

**1. Dependency scanning** - checks `package.json` for known framework packages:

React, Next.js, Vue.js, Nuxt.js, Svelte, SvelteKit, Angular, Solid.js, Express, Fastify, NestJS, Hono, Koa, Apollo Server, tRPC, Prisma, Drizzle ORM, Mongoose, TypeORM, Sequelize, Tailwind CSS, Vite, Webpack, Rollup, esbuild, Vitest, Jest, Mocha, Cypress, Playwright, Storybook, and more.

**2. Config file presence** - checks for known configuration files:

`next.config.js`, `nuxt.config.ts`, `svelte.config.js`, `angular.json`, `vite.config.ts`, `webpack.config.js`, `tailwind.config.js`, `prisma/schema.prisma`, `docker-compose.yml`, `Dockerfile`, and more.

Each detection has a **confidence level** (high, medium, low) and a **category** (frontend, backend, testing, bundler, css, other).

### Issues and Health Checks

ProjScan ships with six analyzer modules:

#### 1. ESLint Check

- Looks for `.eslintrc.*`, `eslint.config.*`, or `eslintConfig` in package.json
- If missing: warning with auto-fix available

#### 2. Prettier Check

- Looks for `.prettierrc`, `.prettierrc.*`, `prettier.config.*`, or `prettier` in package.json
- If missing: warning with auto-fix available

#### 3. Test Check

- Looks for test frameworks in devDependencies (vitest, jest, mocha, etc.)
- Looks for test files (`*.test.*`, `*.spec.*`, `__tests__/`)
- If no framework: warning with auto-fix available
- If framework exists but zero test files: separate warning

#### 4. Architecture Check

- **Large utility directories**: warns if `utils/`, `helpers/`, or `lib/` contains 10+ files (issue anchored to the directory path)
- **Missing .editorconfig**: info with auto-fix available
- **Missing/empty README**: warning / info

#### 5. Dependency Risk Check

- Warns if production dependencies exceed 50
- Errors if total dependencies exceed 100
- Flags `*` or `latest` version ranges
- Warns if no lock file is present

#### 6. Security Check

- **Committed `.env` files**: Flags `.env`, `.env.local`, `.env.production`, etc. (but not `.env.example`, `.env.sample`, `.env.template`) - location anchored to the file
- **Private key files**: Detects `.pem`, `.key`, `id_rsa`, `id_ed25519`, `.p12`, `.pfx` files
- **Hardcoded secrets**: Scans file contents (files under 512KB) for:
  - AWS Access Keys (`AKIA...`)
  - GitHub tokens (`ghp_...`, `ghs_...`)
  - Slack tokens (`xoxb-...`, `xoxp-...`)
  - Generic patterns (`password=`, `secret=`, `api_key=` with quoted values)
  - PEM private key headers
    Each finding carries the exact **line number** of the match, which SARIF and GitHub Code Scanning use for inline PR annotations.
- **Missing `.gitignore` entries**: Warns if `.env` is not in `.gitignore`
- **Path-only `.env` handling**: Tracked `.env*` files are flagged by filename, but their values are not read unless `--scan-env-values` or `scan.scanEnvValues: true` is set

Every issue carries an optional `locations: IssueLocation[]` field. Analyzers populate it when the finding is tied to a specific file (and sometimes a specific line). This field powers SARIF output and `--changed-only` filtering.

---

## Auto-Fix System

The fix system is intentionally conservative. It only creates configuration files and installs well-known packages. It never modifies your source code.

### How fixes work

1. `projscan fix` runs the issue detection pipeline
2. Filters to issues where `fixAvailable: true`
3. Shows you exactly what each fix will do
4. Prompts for confirmation (unless `-y` is passed)
5. Applies fixes sequentially, showing progress
6. Reports success/failure for each fix

### Fix details

**ESLint fix:**

- Creates `eslint.config.js` using the flat config format (ESLint v9+)
- If TypeScript files are detected, includes `typescript-eslint` plugin
- Installs `eslint` and `@eslint/js` via the detected package manager

**Prettier fix:**

- Creates `.prettierrc` with these defaults:
  ```json
  {
    "semi": true,
    "singleQuote": true,
    "trailingComma": "all",
    "printWidth": 100,
    "tabWidth": 2
  }
  ```
- Installs `prettier`

**Test framework fix:**

- Creates `vitest.config.ts`
- Creates a sample test file at `tests/example.test.ts`
- Adds `"test": "vitest run"` to package.json scripts (if not already present)
- Installs `vitest`

**EditorConfig fix:**

- Creates `.editorconfig`
- Installs nothing - EditorConfig is handled by editor plugins

---

## Architecture Diagrams

The `diagram` command builds a layered view of your application. It works by:

1. Scanning the top-level directory names in your project
2. Matching them against known patterns (e.g., `components/` -> Frontend, `routes/` -> API)
3. Cross-referencing with detected frameworks
4. Rendering only the layers that are present

This is heuristic-based and works best with conventional project structures. Projects with unconventional layouts will get a generic "Application" layer.

---

## File Explanation Engine

The `explain` command performs regex-based static analysis. It does not execute your code or make network calls.

**Import detection** handles:

- ES modules: `import { foo } from 'bar'`
- Default imports: `import foo from 'bar'`
- Namespace imports: `import * as foo from 'bar'`
- Side-effect imports: `import 'bar'`
- CommonJS: `const foo = require('bar')`

**Export detection** handles:

- Named exports: `export function`, `export class`, `export const`
- Type exports: `export interface`, `export type`
- Default exports: `export default`

**Purpose inference** is based on file name and directory conventions. For example:

- Files named `*.test.*` or `*.spec.*` → "Test file"
- Files in `routes/` → "Route definitions"
- Files named `index.ts` → "Module entry point"
- Files in `components/` → "UI component"

---

## Hotspots & Ownership

The `hotspots` command reads `git log` to build a per-file risk picture. The risk score combines five signals:

| Signal              | Weight      | Intuition                                                                                                                                                                                               |
| ------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Churn               | 0.40        | Files that change often are more likely to harbor bugs                                                                                                                                                  |
| Complexity (AST CC) | 0.30        | Files with more decision points are harder to reason about. **AST-derived McCabe cyclomatic complexity for JS/TS, Python, Go, Java, Ruby, Rust, PHP, and C#; falls back to LOC for non-AST languages.** |
| Issue density       | 0.20        | Files that already have open issues need help                                                                                                                                                           |
| Recency             | 0.10        | Recently touched hot files deserve attention first                                                                                                                                                      |
| Bus factor          | penalty tag | Single-author + high churn = organizational risk                                                                                                                                                        |

**Ownership signals:**

- `primaryAuthor` - the top committer by share
- `primaryAuthorShare` - fraction of commits (0–1)
- `topAuthors` - ranked list
- `busFactorOne` - `true` if the primary author owns > 80% of commits **and** churn is above the median

**Bus-factor-one files get a score penalty and a `bus-factor-one` reason tag** - they show up higher in the ranking because if that one author leaves, the knowledge is gone.

**What "hotspots" can't do:**

- It's a heuristic, not a proof. Low-risk files may still have bugs.
- It weights LOC as a proxy for complexity; a clean 1,000-line file may rank higher than it deserves.
- It has no visibility into logical coupling - two small files that change together still look independent.

`projscan diff` snapshots the top 20 hotspots and tracks which ones **rose** / **fell** / **appeared** / **resolved** over time.

---

## MCP Server for AI Agents

`projscan mcp` runs ProjScan as an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server over stdio. AI coding agents can query ProjScan during a session to ground their suggestions in live project state.

**Core tools include:**

_Structural / agent-native:_

- `projscan_start` — first-60-seconds repo orientation with setup diagnostics, recommended workflow, top risks, adoption gaps, and next commands.
- `projscan_semantic_graph` — the code graph, two ways. With no `query`: the stable v3 semantic graph (file/function/package/symbol nodes and normalized structural edges). With `query: { direction, file?, symbol? }`: a targeted structural query (`imports`, `exports`, `importers`, `symbol_defs`, `package_importers`) in milliseconds on a warm cache. _(Subsumes the former `projscan_graph`, removed in 4.0.)_
- `projscan_dataflow` — direct, propagated, and bridge source-to-sink dataflow risks over the function graph.
- `projscan_search` — BM25-ranked search. Scopes: `auto` / `content` (ranked content + symbol + path boosts, line excerpts), `symbols` (exported names), `files` (path substring). Optional semantic mode + sub-file chunking with the `@xenova/transformers` peer dep.
- `projscan_coupling` — per-file fan-in / fan-out / instability + Tarjan circular-import cycles.
- `projscan_pr_diff` — structural (AST) diff between two refs. Returns added / removed / modified files with explicit lists of exports, imports, call sites, and ΔCC / Δfan-in.
- `projscan_review` — one-call PR review composing `pr_diff` + per-changed-file risk + new/expanded cycles + risky function additions + dependency changes + a verdict (`ok` / `review` / `block`).
- `projscan_workplan` — prioritized agent execution plan with evidence, suggested tools, verification commands, coordination context, and handoff text.
- `projscan_bug_hunt` — prioritized bug-hunt action queue with per-action verification.
- `projscan_agent_brief` — compact next-agent context packet with focus items, guardrails, repo context, and suggested next actions.
- `projscan_quality_scorecard` — dimensioned quality view with top risks and verification commands.
- `projscan_adoption` — adoption helper for MCP client snippets, MCP setup doctor, agent workflow recipes, and first-run diagnostics.
- `projscan_release_train` — product-line readiness plan with scope and next-action evidence.
- `projscan_evidence_pack` — approval packet with planning, bug-hunt, workplan, preflight, changelog, and website prompt evidence.
- `projscan_regression_plan` — smoke/focused/full regression matrix with deduplicated verification commands.
- `projscan_fix_suggest` — rule-driven action prompt for any open issue: headline, why, where, instruction, optional suggested test.
- `projscan_explain_issue` — deep dive on one issue: code excerpt, related issues, similar past commits via `git log --grep`, plus the structured FixSuggestion.
- `projscan_impact` — transitive blast-radius for a file or symbol. BFS over reverse imports + symbol callsites. Cycle-safe; depth-bounded.

_Analysis:_

- `projscan_analyze` — full project snapshot.
- `projscan_doctor` — health score + issues with inline `suggestedAction` hints.
- `projscan_preflight` — compact `proceed` / `caution` / `block` gate with health, changed-file, review, session, plugin, and supply-chain evidence.
- `projscan_hotspots` — ranked file risk (or top-N risky functions with `view: "functions"`).
- `projscan_file` — per-file inspection (purpose, imports, exports, smells, risk, ownership, related issues, CC, fan-in/out, per-function CC table).
- `projscan_structure` — directory tree.
- `projscan_coverage` — coverage × hotspots, ranked by "risk × uncovered fraction".

_Dependencies (workspace-aware in monorepos):_

- `projscan_dependencies` — declared deps + risks, with a `byWorkspace` breakdown.
- `projscan_outdated` — declared-vs-installed drift (offline), per-package.
- `projscan_audit` — npm audit, normalized; `package` arg scopes findings to one workspace's direct deps.
- `projscan_upgrade` — upgrade preview: drift + local CHANGELOG + importers.

_Workspace:_

- `projscan_workspaces` — list monorepo packages (npm/yarn/pnpm/Nx/Turbo/Lerna).

_Session (1.4+):_

- `projscan_session` — durable cross-invocation session. Subactions: `current`, `touched`, `events`, `reset`. Auto-populated from every tool result and from `notifications/file_changed` push events when `--watch` is on.

**Every tool accepts `max_tokens` (optional).** projscan estimates serialized output and truncates the largest array field until it fits. Over-budget responses include a `_budget: { truncated: true, estimatedTokens, maxTokens }` field. Tools that return arrays also support cursor pagination via `cursor` + `page_size`.

**Every tool result also carries a `_cost` sidecar (1.5+).** `_cost: { estimatedTokens: N }` lets agents see what they paid for a call without counting tokens themselves — useful for budgeting tool sequences. Cost is the chars-divided-by-4 approximation of the serialized payload (within ~±15% of GPT/Claude tokenizers for code-shaped output).

**`projscan_review` accepts `max_cost_tokens` (1.5+).** Adaptive shape budget. The tool picks a tier based on the value and reshapes the response _before_ serializing — different from `max_tokens` (post-hoc truncation):

- **full** (no budget, or ≥ 7000): everything — full structural diff + per-changed-file lists + all cycles + risky functions + dependency changes.
- **summary** (3000–6999): verdict + summary + top-5 changed files + top-3 of each list, with the heavy per-file expansion arrays stripped.
- **verdict-only** (<3000): verdict + summary + base/head + aggregate `totals`. Roughly 500 tokens.

The chosen tier is surfaced as a top-level `tier` field on the response and lifted into `_cost.tier` so an agent sees it in one place. Both `_cost` and `_budget` can appear on the same response when both `max_cost_tokens` and `max_tokens` are passed.

**Incremental cache:** projscan caches parsed ASTs at `.projscan-cache/graph.json`. First run populates, subsequent runs re-parse only files whose `mtime` changed. Auto-gitignored. Delete the directory to force a rebuild.

For the analyzer and reporter plugin platform, including minimal manifests, analyzer modules, and `--reporter <name>`, see [Plugin Authoring](PLUGIN-AUTHORING.md). Reporter plugins are the supported boundary for custom presentation, white-label reports, and team-branded CLI summaries; the built-in HTML reporter remains the default core renderer.

**Prompts (6, parameterized with live project data):**

- `prioritize_refactoring` — ranked plan grounded in current hotspots
- `investigate_file` — senior-engineer brief for a specific file
- `refactor_hotspot` _(1.5+)_ — step-by-step refactor plan for one hotspot file
- `triage_doctor_issues` _(1.5+)_ — critical / important / backlog ordering of open issues
- `review_this_pr` _(1.5+)_ — PR-comment-ready review primed with the structural diff and verdict
- `safely_rename_symbol` _(1.5+)_ — ordered rename + verification checklist via `projscan_impact` blast radius

**Resources (3, readable on demand):**

- `projscan://health`
- `projscan://hotspots`
- `projscan://structure`

### Setup: Claude Code

```bash
claude mcp add projscan -- npx projscan mcp
```

### Setup: Cursor / Windsurf / any MCP client

```json
{
  "mcpServers": {
    "projscan": {
      "command": "npx",
      "args": ["projscan", "mcp"]
    }
  }
}
```

Once connected, your agent can ask _"what are the riskiest files in this repo?"_ or _"run projscan_doctor before proposing an edit"_ and get grounded answers.

---

## Performance

ProjScan is designed to be fast enough to run on every save or as a pre-commit hook.

| Metric               | Target        |
| -------------------- | ------------- |
| 5,000 files          | < 1.5 seconds |
| 20,000 files         | < 3 seconds   |
| Network requests     | Zero          |
| Runtime dependencies | 4 packages    |

**How it stays fast:**

- Uses `fast-glob` for file walking
- Language detection is a pure function - no I/O, just extension mapping
- Framework detection reads at most one file (`package.json`) plus checks file names already in memory
- Hotspots is the only command that shells out to `git`; that's ~1s on a 5k-commit repo
- `--changed-only` mode scopes reporting (not scanning), so scan time is unchanged - but CI jobs with heavy parsing can pair it with a smaller file set if you want faster runs

---

## Common Workflows

### Onboarding to a new codebase

```bash
cd new-project
projscan                      # Full overview
projscan structure            # Understand the layout
projscan diagram              # See the architecture
projscan hotspots             # Which files are risky?
projscan file <path>          # Drill into a hotspot
```

### Pre-commit health check

```bash
projscan doctor
```

### Setting up a new project

```bash
mkdir my-project && cd my-project
npm init -y
projscan fix -y   # Set up ESLint, Prettier, Vitest, EditorConfig
```

### Generating a project report for a PR

```bash
projscan analyze --format markdown > ANALYSIS.md
```

### Tech-debt prioritization

```bash
projscan hotspots --format markdown > HOTSPOTS.md
# Paste into a tech-debt ticket
```

### Extracting data for a dashboard

```bash
projscan analyze --format json > /tmp/projscan-report.json
```

---

## CI/CD Integration

ProjScan has three first-class CI integration paths:

### 1. First-party GitHub Action (recommended)

The easiest path - installs projscan, runs the health gate, uploads SARIF to GitHub Code Scanning.

```yaml
name: ProjScan
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

permissions:
  contents: read
  security-events: write # required for SARIF upload

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 } # needed for --changed-only
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - uses: abhiyoheswaran1/projscan@v1
        with:
          min-score: '70'
          changed-only: 'true'
```

**Inputs:** `min-score`, `changed-only`, `base-ref`, `config`, `sarif-file`, `upload-sarif`, `working-directory`, `version`.

**Outputs:** `score`, `grade`.

Findings show up in **Security → Code scanning**; PR annotations are automatic.

### 2. Plain workflow (no SARIF upload)

If you'd rather skip Code Scanning, `projscan init github-action` writes a pull-request workflow that builds a projscan evidence comment, validates required review sections before posting, and fails only on concrete preflight blocks. The repo also ships `.github/projscan-ci.yml` as a lower-level health-report workflow.

### 3. Any CI - raw `projscan ci`

The `ci` command is purpose-built for pipelines:

```bash
projscan ci                                 # Fail if score < 70 (default)
projscan ci --min-score 80                  # Custom threshold
projscan ci --changed-only                  # Gate only on PR diff
projscan ci --format json                   # JSON output for scripts
projscan ci --format sarif > projscan.sarif # SARIF for any consumer
```

**JSON output in a script:**

```bash
result=$(projscan ci --min-score 0 --format json)
pass=$(echo "$result" | jq '.ci.pass')
score=$(echo "$result" | jq '.ci.score')
echo "Score: $score, Pass: $pass"
```

### Tracking health over time in CI

Combine `ci` with `diff` to track regressions:

```bash
projscan diff --save-baseline        # Run once to create baseline
# Commit .projscan-baseline.json to your repo

# In CI, compare against baseline:
projscan diff --format json          # Shows new/resolved issues + hotspot movements
```

---

## Troubleshooting

### "No package.json found"

The `dependencies` and `fix` commands require a `package.json` in the current directory. Other commands (`analyze`, `structure`, `diagram`, `explain`) work without one.

### Scan is slow

If scanning takes more than a few seconds, check whether you have large unignored directories. ProjScan ignores `node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `.nuxt`, `.cache`, `.turbo`, and `.output` by default. Add your own patterns via `.projscanrc` → `ignore`.

### Hotspots shows "not a git repository"

`hotspots` needs git history to compute churn and ownership. Either run it inside a git repo, or skip the command.

### `--changed-only` reports everything

Check stderr for a warning. Most common causes:

- Running outside a git repository
- The base ref doesn't exist (e.g., `origin/main` isn't fetched in a shallow CI clone - set `fetch-depth: 0` in checkout)
- Fresh commit with no parent (no `HEAD~1`)

### SARIF upload fails with "permission denied"

The workflow needs `permissions: security-events: write`. The first-party Action sets this implicitly; plain workflows need to add it explicitly.

### Fix command fails to install packages

The fix system uses `npm install` by default. If you use yarn or pnpm, the install step may behave differently. Check your package manager's output for errors.

---

## Project Internals

For contributors and the curious - here's how ProjScan is structured:

```
src/
├── cli/
│   └── index.ts                 # CLI entry point; all commands defined here
├── core/
│   ├── repositoryScanner.ts     # File tree walking, directory tree building
│   ├── languageDetector.ts      # Extension -> language mapping
│   ├── frameworkDetector.ts     # Framework detection from deps + config files
│   ├── dependencyAnalyzer.ts    # package.json parsing, risk detection
│   ├── issueEngine.ts           # Runs all analyzers, aggregates issues
│   ├── hotspotAnalyzer.ts       # git churn × complexity × issues × ownership
│   ├── fileInspector.ts         # Per-file inspection (purpose, imports, exports, risk)
│   ├── importGraph.ts           # Source-wide import graph for unused-dep / dead-code
│   ├── outdatedDetector.ts      # Declared-vs-installed drift check (offline)
│   ├── auditRunner.ts           # npm audit wrapper + SARIF normalization
│   ├── upgradePreview.ts        # Offline upgrade preview (CHANGELOG + importers)
│   ├── coverageParser.ts        # lcov / coverage-final / coverage-summary parser
│   ├── coverageJoin.ts          # Join hotspots × coverage - "scariest untested files"
│   ├── ast.ts                   # @babel/parser wrapper → imports + exports + call sites
│   ├── codeGraph.ts             # Bidirectional file×symbol graph built from AST
│   ├── indexCache.ts            # mtime-keyed .projscan-cache/graph.json
│   └── searchIndex.ts           # BM25-ranked inverted index (content + symbols + path)
├── analyzers/
│   ├── eslintCheck.ts
│   ├── prettierCheck.ts
│   ├── testCheck.ts
│   ├── architectureCheck.ts
│   ├── dependencyRiskCheck.ts
│   ├── securityCheck.ts
│   ├── unusedDependencyCheck.ts
│   └── deadCodeCheck.ts
├── fixes/
│   ├── eslintFix.ts
│   ├── prettierFix.ts
│   ├── testFix.ts
│   ├── editorconfigFix.ts
│   └── fixRegistry.ts
├── reporters/
│   ├── consoleReporter.ts       # Rich terminal output with chalk
│   ├── jsonReporter.ts          # JSON output
│   ├── markdownReporter.ts      # Markdown output
│   └── sarifReporter.ts         # SARIF 2.1.0 output
├── mcp/
│   ├── server.ts                # JSON-RPC 2.0 dispatcher, stdio transport, negotiation
│   ├── tools.ts                 # 41 MCP tools (barrel; per-tool files under tools/)
│   ├── tokenBudget.ts           # Record-aware response truncator
│   ├── pagination.ts            # Cursor-based pagination (opaque base64 + checksum)
│   ├── progress.ts              # notifications/progress plumbing
│   ├── chunker.ts               # Opt-in response chunking (stream: true)
│   ├── prompts.ts               # 2 parameterized prompts
│   └── resources.ts             # 3 on-demand resources
├── utils/
│   ├── fileWalker.ts            # fast-glob wrapper with ignore patterns
│   ├── logger.ts                # Structured logger with levels
│   ├── scoreCalculator.ts       # Health score + shields.io badge
│   ├── baseline.ts              # Baseline save/load/diff (issues + hotspots)
│   ├── config.ts                # .projscanrc loader + rule application
│   ├── changedFiles.ts          # git-based changed-files detector
│   ├── packageJsonLocator.ts    # Line-number lookup for package.json deps
│   ├── semver.ts                # Tiny semver parser/compare/drift
│   ├── banner.ts                # CLI banner + help rendering
│   └── cache.ts                 # Small LRU for hot paths
└── types.ts                     # All shared TypeScript interfaces
```

**Key design decisions:**

- **Single `types.ts`** - avoids circular dependencies between modules
- **ESM-only** - required by chalk v5 and ora v8; all imports use `.js` extensions
- **Pure functions where possible** - `detectLanguages` is pure (no I/O), trivially testable
- **No class hierarchies** - analyzers, fixes, reporters, and MCP tools are plain functions with consistent signatures
- **Opt-in config** - `.projscanrc` is never required, but when present it tunes defaults without needing to change CI scripts
