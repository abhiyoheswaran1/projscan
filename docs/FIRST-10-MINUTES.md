# First 10 Minutes With projscan

Use this flow when adding projscan to a team repo for the first time. `projscan start --format json` and `projscan first-run --format json` both expose this path as `firstTenMinutes`, so humans and MCP agents see the same command order. When someone already has a goal, add `--intent "<goal>"` to `projscan start`; the `missionControl` block returns an inferred workflow mode when no explicit `--mode` is supplied, route confidence metadata, an action plan, immediately runnable `readyActions`, primary action, unresolved inputs for placeholder follow-ups, alternative routes for mixed intents, guardrails, success criteria, and proof commands.

## 1. Install

```sh
npm i -D projscan
```

For an agent or MCP-only setup, you can also run through npx without committing the dependency:

```sh
npx -y projscan first-run --format json
npx -y projscan start --mode before_edit
npx -y projscan start --intent "what can projscan read?" # routes to local privacy/trust boundary
npx -y projscan start --intent "does projscan read .env values?" # routes to .env content policy check
npx -y projscan start --intent "is it safe to commit this change?" # infers before_commit unless --mode is explicit
npx -y projscan start --intent "is my branch ready to merge?" # routes to before-merge preflight readiness
npx -y projscan start --intent "rebase went wrong" # routes to before-merge preflight recovery
npx -y projscan start --intent "resolve merge conflicts" # routes to before-merge preflight recovery
npx -y projscan start --intent "what is blocking this PR?" # routes to before-commit preflight blockers
npx -y projscan start --intent "summarize this repo" # routes to cited repo map + orientation summary
npx -y projscan start --intent "what files should I read first?" # routes to cited repo map + read-first files
npx -y projscan start --intent "where do I start in this codebase?" # routes to cited repo map + read-first files
npx -y projscan start --intent "give me a tour of the repo" # routes to cited repo map + entrypoints
npx -y projscan start --intent "explain the architecture" # routes to cited repo map + boundaries
npx -y projscan start --intent "show me the main entrypoints" # routes to cited repo map + entrypoints
npx -y projscan start --intent "how do I run this project?" # routes to cited repo map + entrypoints
npx -y projscan start --intent "what command starts the dev server?" # routes to cited repo map + entrypoints
npx -y projscan start --intent "what npm scripts exist?" # routes to package/config contract discovery
npx -y projscan start --intent "which script runs e2e tests?" # routes to package/config contract discovery
npx -y projscan start --intent "what command runs lint?" # routes to package/config contract discovery
npx -y projscan start --intent "how do I run typecheck?" # routes to package/config contract discovery
npx -y projscan start --intent "how do I seed the database?" # routes to package/config contract discovery
npx -y projscan start --intent "what command runs migrations?" # routes to package/config contract discovery
npx -y projscan start --intent "where should I put this new feature?" # routes to change-readiness map
npx -y projscan start --intent "implement OAuth login" # routes to change-readiness map
npx -y projscan start --intent "add billing webhook support" # routes to change-readiness map
npx -y projscan start --intent "build a settings page" # routes to change-readiness map
npx -y projscan start --intent "where should I add a new endpoint?" # routes to change-readiness map
npx -y projscan start --intent "what files do I need to change for auth?" # routes to change-readiness map
npx -y projscan start --intent "what docs should I update for this change?" # routes to change-readiness map
npx -y projscan start --intent "where should I add this database migration?" # routes to change-readiness map
npx -y projscan start --intent "which migrations exist?" # routes to focused code search
npx -y projscan start --intent "show me generated files" # routes to focused code search
npx -y projscan start --intent "can I drop this column?" # routes to impact target search
npx -y projscan start --intent "what are the public contracts?" # routes to public exports/config contracts
npx -y projscan start --intent "how do I safely deprecate this API?" # routes to public exports/config contracts
npx -y projscan start --intent "what will this API change break?" # routes to impact target search
npx -y projscan start --intent "what env vars does this repo need?" # routes to config contract discovery
npx -y projscan start --intent "environment variables missing" # routes to config contract discovery
npx -y projscan start --intent "where is NEXT_PUBLIC_API_URL used?" # routes to focused code search
npx -y projscan start --intent "which env var controls auth?" # routes to focused code search
npx -y projscan start --intent "where is \"Invalid token\" thrown?" # routes to focused code search
npx -y projscan start --intent "find error message \"Payment failed\"" # routes to focused code search
npx -y projscan start --intent "where is eslint config?" # routes to focused code search
npx -y projscan start --intent "which config file defines aliases?" # routes to focused code search
npx -y projscan start --intent "where is tsconfig path aliases configured?" # routes to focused code search
npx -y projscan start --intent "where is Vitest config?" # routes to focused code search
npx -y projscan start --intent "find Babel config" # routes to focused code search
npx -y projscan start --intent "where is package manager configured?" # routes to focused code search
npx -y projscan start --intent "where is pnpm workspace file?" # routes to focused code search
npx -y projscan start --intent "what is risky in this repo?" # routes to quality dimensions + top risks
npx -y projscan start --intent "what files are risky to touch?" # routes to hotspot files
npx -y projscan start --intent "which files are too complex?" # routes to hotspot files
npx -y projscan start --intent "what file should I refactor first?" # routes to hotspot files
npx -y projscan start --intent "what tech debt should I pay down?" # routes to hotspot files
npx -y projscan start --intent "what code should I simplify?" # routes to hotspot files
npx -y projscan start --intent "find performance bottlenecks" # routes to hotspot files
npx -y projscan start --intent "where are the slow files?" # routes to hotspot files
npx -y projscan start --intent "find dead code" # routes to doctor cleanup issues
npx -y projscan start --intent "find dead code and unused exports I can delete" # routes to doctor cleanup issues
npx -y projscan start --intent "what can I safely delete?" # routes to doctor cleanup discovery
npx -y projscan start --intent "what can I remove safely?" # routes to doctor cleanup discovery
npx -y projscan start --intent "port 3000 already in use" # routes to focused regression planning
npx -y projscan start --intent "peer dependency conflict after npm install" # routes to focused regression planning
npx -y projscan start --intent "where is runAudit used?" # routes to symbol impact/caller analysis
npx -y projscan start --intent "what code handles billing?" # routes to focused code search
npx -y projscan start --intent "which file contains checkout logic?" # routes to focused code search
npx -y projscan start --intent "find the Stripe webhook handler" # routes to focused code search
npx -y projscan start --intent "find the handler for POST /api/users" # routes to focused code search
npx -y projscan start --intent "where is the /checkout route handled?" # routes to focused code search
npx -y projscan start --intent "where is /settings page rendered?" # routes to focused code search
npx -y projscan start --intent "which page renders /billing?" # routes to focused code search
npx -y projscan start --intent "where is route segment for dashboard?" # routes to focused code search
npx -y projscan start --intent "where is not-found page handled?" # routes to focused code search
npx -y projscan start --intent "which feature flags exist?" # routes to focused code search
npx -y projscan start --intent "what background jobs exist?" # routes to focused code search
npx -y projscan start --intent "find the email queue processor" # routes to focused code search
npx -y projscan start --intent "where are metrics emitted?" # routes to focused code search
npx -y projscan start --intent "where do we initialize Sentry?" # routes to focused code search
npx -y projscan start --intent "what logs should I check for checkout?" # routes to focused code search
npx -y projscan start --intent "find the dashboard for payments" # routes to focused code search
npx -y projscan start --intent "where is seed data defined?" # routes to focused code search
npx -y projscan start --intent "find fixtures for checkout" # routes to focused code search
npx -y projscan start --intent "which mocks are used for payments?" # routes to focused code search
npx -y projscan start --intent "where are Storybook stories for Button?" # routes to focused code search
npx -y projscan start --intent "where are permissions checked for checkout?" # routes to focused code search
npx -y projscan start --intent "which role can access admin?" # routes to focused code search
npx -y projscan start --intent "what routes require login?" # routes to focused code search
npx -y projscan start --intent "where is rate limiting configured?" # routes to focused code search
npx -y projscan start --intent "where is cache invalidated for products?" # routes to focused code search
npx -y projscan start --intent "find retry logic for payments" # routes to focused code search
npx -y projscan start --intent "what sets request timeout?" # routes to focused code search
npx -y projscan start --intent "find idempotency key handling" # routes to focused code search
npx -y projscan start --intent "where is webhook signature verified?" # routes to focused code search
npx -y projscan start --intent "where is input validation for signup?" # routes to focused code search
npx -y projscan start --intent "which schema validates checkout?" # routes to focused code search
npx -y projscan start --intent "where are request params parsed?" # routes to focused code search
npx -y projscan start --intent "where is database transaction started?" # routes to focused code search
npx -y projscan start --intent "where do we lock the order row?" # routes to focused code search
npx -y projscan start --intent "what validates email uniqueness?" # routes to focused code search
npx -y projscan start --intent "where is Prisma model for User?" # routes to focused code search
npx -y projscan start --intent "find Drizzle schema for invoices" # routes to focused code search
npx -y projscan start --intent "where is SQL query for invoices?" # routes to focused code search
npx -y projscan start --intent "which repository saves orders?" # routes to focused code search
npx -y projscan start --intent "find DAO for payments" # routes to focused code search
npx -y projscan start --intent "where is loading state for dashboard?" # routes to focused code search
npx -y projscan start --intent "where is error boundary for settings?" # routes to focused code search
npx -y projscan start --intent "find command palette actions" # routes to focused code search
npx -y projscan start --intent "where are i18n translations for checkout?" # routes to focused code search
npx -y projscan start --intent "where are design tokens defined?" # routes to focused code search
npx -y projscan start --intent "where is Tailwind theme configured?" # routes to focused code search
npx -y projscan start --intent "where is global CSS imported?" # routes to focused code search
npx -y projscan start --intent "which CSS module styles Button?" # routes to focused code search
npx -y projscan start --intent "where is dark mode configured?" # routes to focused code search
npx -y projscan start --intent "what breakpoints are defined?" # routes to focused code search
npx -y projscan start --intent "where is sidebar nav item for billing?" # routes to focused code search
npx -y projscan start --intent "which breadcrumb renders settings?" # routes to focused code search
npx -y projscan start --intent "where is page title set for checkout?" # routes to focused code search
npx -y projscan start --intent "where is Next.js layout for dashboard?" # routes to focused code search
npx -y projscan start --intent "where is auth state stored?" # routes to focused code search
npx -y projscan start --intent "find Redux slice for cart" # routes to focused code search
npx -y projscan start --intent "where is Zustand store for user settings?" # routes to focused code search
npx -y projscan start --intent "which context provider supplies theme?" # routes to focused code search
npx -y projscan start --intent "which hook fetches invoices?" # routes to focused code search
npx -y projscan start --intent "where is React Query mutation for checkout?" # routes to focused code search
npx -y projscan start --intent "where do we call Stripe?" # routes to focused code search
npx -y projscan start --intent "which code sends email through SendGrid?" # routes to focused code search
npx -y projscan start --intent "where is S3 upload implemented?" # routes to focused code search
npx -y projscan start --intent "find GitHub API client" # routes to focused code search
npx -y projscan start --intent "where is GraphQL query for invoices?" # routes to focused code search
npx -y projscan start --intent "where is websocket connection opened?" # routes to focused code search
npx -y projscan start --intent "where is OpenAPI spec defined?" # routes to focused code search
npx -y projscan start --intent "where is Swagger docs configured?" # routes to focused code search
npx -y projscan start --intent "where is tRPC router for billing?" # routes to focused code search
npx -y projscan start --intent "which GraphQL resolver handles invoices?" # routes to focused code search
npx -y projscan start --intent "which protobuf defines user service?" # routes to focused code search
npx -y projscan start --intent "where is gRPC client for payments?" # routes to focused code search
npx -y projscan start --intent "where is the Dockerfile?" # routes to focused code search
npx -y projscan start --intent "where is docker compose for local dev?" # routes to focused code search
npx -y projscan start --intent "where are Kubernetes manifests?" # routes to focused code search
npx -y projscan start --intent "find Helm chart for payments" # routes to focused code search
npx -y projscan start --intent "where is Terraform module for S3?" # routes to focused code search
npx -y projscan start --intent "which GitHub workflow deploys staging?" # routes to focused code search
npx -y projscan start --intent "where is Vercel config?" # routes to focused code search
npx -y projscan start --intent "where is password reset handled?" # routes to focused code search
npx -y projscan start --intent "where is team invite flow?" # routes to focused code search
npx -y projscan start --intent "where is onboarding flow implemented?" # routes to focused code search
npx -y projscan start --intent "find CSV export for users" # routes to focused code search
npx -y projscan start --intent "what creates audit log entries?" # routes to focused code search
npx -y projscan start --intent "where is refund handling for payments?" # routes to focused code search
npx -y projscan start --intent "where is subscription renewal handled?" # routes to focused code search
npx -y projscan start --intent "where is welcome email template?" # routes to focused code search
npx -y projscan start --intent "find password reset email copy" # routes to focused code search
npx -y projscan start --intent "where is push notification copy for invites?" # routes to focused code search
npx -y projscan start --intent "where is SMS verification template?" # routes to focused code search
npx -y projscan start --intent "which template sends receipt email?" # routes to focused code search
npx -y projscan start --intent "where is invoice PDF generated?" # routes to focused code search
npx -y projscan start --intent "find documentation for auth" # routes to focused docs search
npx -y projscan start --intent "what depends on src/core/start.ts?" # routes to file impact/dependency analysis
npx -y projscan start --intent "can I delete src/core/start.ts?" # routes to file impact/dependency analysis
npx -y projscan start --intent "revert src/core/start.ts safely" # routes to file impact/dependency analysis
npx -y projscan start --intent "how do I revert this change safely?" # routes to impact target search
npx -y projscan start --intent "what dependencies does this repo use?" # routes to dependency inventory
npx -y projscan start --intent "why is the bundle so large?" # routes to dependency size inventory
npx -y projscan start --intent "find package bloat" # routes to dependency size inventory
npx -y projscan start --intent "what licenses do our dependencies use?" # routes to dependency license inventory
npx -y projscan start --intent "who uses lodash?" # routes to package importer graph query
npx -y projscan start --intent "why do we depend on lodash?" # routes to package importer graph query
npx -y projscan start --intent "third party notices" # routes to dependency license inventory
npx -y projscan start --intent "open source compliance check" # routes to dependency license inventory
npx -y projscan start --intent "show circular dependencies" # routes to cycles-only coupling analysis
npx -y projscan start --intent "what modules are tightly coupled?" # routes to coupling + instability analysis
npx -y projscan start --intent "what workspaces are in this repo?" # routes to monorepo workspace map
npx -y projscan start --intent "which workspace owns auth?" # routes to monorepo workspace map
npx -y projscan start --intent "where should I put this in the monorepo?" # routes to monorepo workspace map
npx -y projscan start --intent "does lodash have a CVE?" # routes to scoped npm audit
npx -y projscan start --intent "what CVEs affect this repo?" # routes to npm audit
npx -y projscan start --intent "find vulnerable packages" # routes to npm audit
npx -y projscan start --intent "who owns auth?" # routes to focused ownership search
npx -y projscan start --intent "which team owns payments?" # routes to focused ownership search
npx -y projscan start --intent "who should I ask about auth?" # routes to focused ownership search
npx -y projscan start --intent "what should I read before changing src/core/start.ts?" # routes to exact-file orientation
npx -y projscan start --intent "explain src/core/start.ts" # routes to per-file purpose/risk/ownership inspection
npx -y projscan start --intent "who owns src/core/start.ts?" # routes to file ownership/risk context
npx -y projscan start --intent "who should review src/core/start.ts?" # routes to file ownership/reviewer context
npx -y projscan start --intent "who last touched src/core/start.ts?" # routes to file ownership/history context
npx -y projscan start --intent "why is src/core/start.ts risky?" # routes to exact-file risk context
npx -y projscan start --intent "who imports src/core/start.ts?" # routes to a targeted semantic graph query
npx -y projscan start --intent "which files import package chalk?" # routes to a targeted package-importer query
npx -y projscan start --intent "where are the tests for src/core/start.ts?" # routes to focused test-file search
npx -y projscan start --intent "where are tests for auth?" # routes to focused test-topic search
npx -y projscan start --intent "which tests cover auth?" # routes to focused existing-test search
npx -y projscan start --intent "locate specs for checkout" # routes to focused test-topic search
npx -y projscan start --intent "which tests should I run for src/core/start.ts?" # routes to verification proof planning
npx -y projscan start --intent "what should I test before pushing?" # routes to verification proof planning
npx -y projscan start --intent "is src/core/start.ts covered by tests?" # routes to file coverage/risk context
npx -y projscan start --intent "what tests should I add for src/core/start.ts?" # routes to file test-design context
npx -y projscan start --intent "what changed in this PR?" # routes to structural PR diff
npx -y projscan start --intent "is this PR too large?" # routes to structural PR diff
npx -y projscan start --intent "what did I change since main?" # routes to structural branch diff
npx -y projscan start --intent "is my branch stale?" # routes to structural branch diff
npx -y projscan start --intent "compare my branch with main" # routes to structural branch diff
npx -y projscan start --intent "write a commit message for these changes" # routes to structural diff evidence
npx -y projscan start --intent "summarize my changes for a commit" # routes to structural diff evidence
npx -y projscan start --intent "how risky is this PR?" # routes to structural PR review
npx -y projscan start --intent "what are the risks in my PR?" # routes to structural PR review
npx -y projscan start --intent "what are the top risks before merge?" # routes to before-merge preflight readiness
npx -y projscan start --intent "am I ready to open a PR?" # routes to PR-readiness evidence pack
npx -y projscan start --intent "who should review this PR?" # routes to owner-routing evidence pack
npx -y projscan start --intent "who owns the changed files?" # routes to changed-file owner routing
npx -y projscan start --intent "write a PR comment for reviewers" # routes to approval-ready evidence pack
npx -y projscan start --intent "write a PR description" # routes to approval-ready evidence pack
npx -y projscan start --intent "what should my PR say?" # routes to approval-ready evidence pack
npx -y projscan start --intent "make a PR checklist" # routes to approval-ready evidence pack
npx -y projscan start --intent "what should I tell my team about this change?" # routes to approval-ready evidence pack
npx -y projscan start --intent "what should I fix first?" # routes to bug-hunt prioritization
npx -y projscan start --intent "explain issue missing-test-framework" # routes to deep issue context
npx -y projscan start --intent "fix issue missing-test-framework" # routes to a concrete fix suggestion
npx -y projscan start --intent "is user input reaching SQL sinks?" # routes to hardening dataflow analysis
npx -y projscan start --intent "does this endpoint expose secrets?" # routes to hardening dataflow analysis
npx -y projscan start --intent "where is PII handled?" # routes to hardening dataflow analysis
npx -y projscan start --intent "GDPR compliance check" # routes to hardening dataflow analysis
npx -y projscan start --intent "where do we store access tokens?" # routes to hardening dataflow analysis
npx -y projscan start --intent "is this change secure?" # routes to structural PR review
npx -y projscan start --intent "check this PR for security issues" # routes to structural PR review
npx -y projscan start --intent "what are the scariest untested files?" # routes to coverage × hotspot test targets
npx -y projscan start --intent "which files have no tests?" # routes to coverage × hotspot test targets
npx -y projscan start --intent "what breaks if I bump chalk to 6?" # routes to offline package upgrade impact
npx -y projscan start --intent "what breaks if I update react?" # routes to offline package upgrade impact
npx -y projscan start --intent "can I remove lodash?" # routes to offline package removal impact
npx -y projscan start --intent "is lodash safe to remove?" # routes to offline package removal impact
npx -y projscan start --intent "what is the fastest safe fix?" # routes to bug-hunt prioritization before generic safety
npx -y projscan start --intent "find a quick win" # routes to bug-hunt prioritization
npx -y projscan start --intent "what can I do in five minutes?" # routes to bug-hunt prioritization
npx -y projscan start --intent "pick an easy task for me" # routes to bug-hunt prioritization
npx -y projscan start --intent "what should an intern work on?" # routes to bug-hunt prioritization
npx -y projscan start --intent "what is a low risk improvement?" # routes to bug-hunt prioritization
npx -y projscan start --intent "pick a small safe task" # routes to bug-hunt prioritization
npx -y projscan start --intent "what should I do next?" # routes to an ordered before-edit workplan
npx -y projscan start --intent "what tests should I run for my changes?" # routes to a focused regression plan
npx -y projscan start --intent "what commands prove this works?" # routes to focused proof commands
npx -y projscan start --intent "give me proof commands" # routes to focused proof commands
npx -y projscan start --intent "what commands should I run before pushing?" # routes to focused pre-push proof
npx -y projscan start --intent "what smoke checks should I run before commit?" # routes to a smoke regression plan
npx -y projscan start --intent "what full regression should I run before merge?" # routes to a full regression plan
npx -y projscan start --intent "what should I check before release?" # routes to release readiness
npx -y projscan start --intent "can I deploy this?" # routes to release readiness
npx -y projscan start --intent "what changed since last release?" # routes to release readiness
npx -y projscan start --intent "write a release note for this change" # routes to release readiness and changelog evidence
npx -y projscan start --intent "draft changelog entry" # routes to release readiness and changelog evidence
npx -y projscan start --intent "show coordination status for parallel agents" # routes to one-call swarm readiness
npx -y projscan start --intent "who else is working on this?" # routes to one-call swarm readiness
npx -y projscan start --intent "am I going to collide with another agent?" # routes to one-call swarm readiness
npx -y projscan start --intent "what worktrees are active?" # routes to one-call swarm readiness
npx -y projscan start --intent "what should merge first?" # routes to merge-risk ordering
npx -y projscan start --intent "show me overlapping changes" # routes to collision detection
npx -y projscan start --intent "show active claims" # routes to advisory claim listing
npx -y projscan start --intent "claim src/core/start.ts for me" # routes to active-claim review + file claim action
npx -y projscan start --intent "where did I leave off?" # routes to touched-file session context
npx -y projscan start --intent "what changed while I was away?" # routes to touched-file session context
npx -y projscan start --intent "what changed while I was offline?" # routes to touched-file session context
npx -y projscan start --intent "what changed while I was asleep?" # routes to touched-file session context
npx -y projscan start --intent "what did the last agent touch?" # routes to remembered touched-file session context
npx -y projscan start --intent "what did the last agent do?" # routes to remembered touched-file session context
npx -y projscan start --intent "give the next agent a handoff" # routes to a compact agent brief
npx -y projscan start --intent "CI is failing after this PR" # routes to a focused regression plan
npx -y projscan start --intent "CI is flaky" # routes to a focused regression plan
npx -y projscan start --intent "production is down" # routes to a focused regression plan
npx -y projscan start --intent "why is the login endpoint returning 500?" # routes to a focused regression plan
npx -y projscan start --intent "why did CI fail?" # routes to a focused regression plan
npx -y projscan start --intent "why is GitHub Actions failing?" # routes to a focused regression plan
npx -y projscan start --intent "which GitHub Actions job failed?" # routes to a focused regression plan
npx -y projscan start --intent "why is CI slow?" # routes to a focused regression plan
npx -y projscan start --intent "why did the build fail?" # routes to a focused regression plan
npx -y projscan start --intent "what is making builds slow?" # routes to a focused regression plan
npx -y projscan start --intent "lint is failing" # routes to a focused regression plan
npx -y projscan start --intent "typecheck is failing" # routes to a focused regression plan
npx -y projscan start --intent "npm install is failing" # routes to a focused regression plan
npx -y projscan start --intent "debug this stack trace" # routes to a focused regression plan
npx -y projscan start --intent "where is this stack trace from?" # routes to a focused regression plan
npx -y projscan start --intent "database connection refused locally" # routes to a focused regression plan
npx -y projscan start --intent "what command reproduces the flake?" # routes to a focused regression plan
npx -y projscan start --intent "quarantine flaky test" # routes to a focused regression plan
npx -y projscan start --intent "how can I speed up tests?" # routes to a focused regression plan
npx -y projscan start --intent "what commands benchmark this repo?" # routes to focused proof commands
```

## 2. Verify the trust boundary

```sh
projscan privacy-check --offline
```

Confirm the scan root, Git ignore handling, hidden ignored-file count, `.env` content-scanning status, plugin execution status, local write surfaces, report-export sensitivity, and blocked network-capable endpoints before running broader analysis.

## 3. Orient and gate the first run

```sh
projscan start --mode before_edit
projscan start --intent "what breaks if I rename this API?"
projscan start --intent "how do I revert this change safely?"
projscan start --intent "explain src/core/start.ts"
projscan start --intent "who imports src/core/start.ts?"
projscan start --intent "what changed in this PR?"
projscan start --intent "what should I fix first?"
projscan start --intent "what is the fastest safe fix?"
projscan start --intent "what should I do next?"
projscan start --intent "explain issue missing-test-framework"
projscan start --intent "explain this issue"
projscan start --intent "fix issue missing-test-framework"
projscan start --intent "how do I fix this issue?"
projscan start --intent "is user input reaching SQL sinks?"
projscan start --intent "where are permissions checked for checkout?"
projscan start --intent "where is cache invalidated for products?"
projscan start --intent "where is input validation for signup?"
projscan start --intent "what are the scariest untested files?"
projscan start --intent "which tests cover auth?"
projscan start --intent "which files have no tests?"
projscan start --intent "find performance bottlenecks"
projscan start --intent "what breaks if I bump chalk to 6?"
projscan start --intent "what workspaces are in this repo?"
projscan start --intent "does lodash have a CVE?"
projscan start --intent "what package should I upgrade?"
projscan start --intent "show circular dependencies"
projscan start --intent "what modules are tightly coupled?"
projscan start --intent "CI is failing after this PR"
projscan start --intent "CI is flaky"
projscan start --intent "why is CI slow?"
projscan preflight --mode before_edit --format json
```

`start` gives the first workflow, Mission Control, and a split between current Git/worktree context and remembered session context. The top-level `modeSource` and `modeReason` explain whether the workflow mode was explicit, inferred from intent, or defaulted. When `projscan start` resolves a non-default mode, `firstTenMinutes` and the current-worktree coordination hint use that mode's matching preflight gate, such as `before_commit` for commit-safety intents. Mission Control includes route `confidence`, `score`, `rank`, and `matchedKeywords` on routed intents, and the console prints the primary and alternative route confidence so humans can see why a tool was chosen. Mission Control also includes `readyActions` for action-plan steps whose command and MCP args are immediately callable, `unresolvedInputs` for values that must be filled from a previous action, plus `successCriteria`, which is the short "done when" contract for the routed intent. `missionControl.handoff` is the machine-readable packet for the next agent: next action, ready actions, needs-input list, done criteria, and proof commands. `proofSummary` explains that `proofCommands` are ready-to-run commands only; placeholder follow-ups stay in `actionPlan` until their inputs are resolved. `preflight` gives the proceed/caution/block decision before an agent starts editing.

In first-run JSON output, `firstTenMinutes.commands` starts with the same three commands: `projscan privacy-check --offline`, `projscan start --mode before_edit`, and `projscan preflight --mode before_edit --format json`. In `projscan start --intent ...` output, those commands follow the resolved start mode.

## 4. Bootstrap the team setup

```sh
projscan init team --team platform
```

This writes the starter policy, GitHub Action, CODEOWNERS starter, and local baseline when possible. Review the generated files before committing them.

## 5. Choose telemetry explicitly

```sh
projscan telemetry explain
```

Telemetry is off by default. In an interactive terminal, `projscan init team` asks whether to share anonymous product-health metrics. It never sends source code, paths, repo names, branch names, package names, usernames, raw findings, secrets, or environment values. To opt in later, run `projscan telemetry enable`; to opt out and clear the queue, run `projscan telemetry disable`.

## 6. Verify MCP setup

```sh
projscan mcp doctor --client codex --format json
```

Use the returned config snippet in Codex, Claude, Cursor, or another MCP-aware client. The command explains exactly what to paste.

## 7. Generate the first PR comment locally

```sh
projscan evidence-pack --pr-comment
```

A useful first comment should include a short verdict, top risks, the first fix, owner routing, verification commands, and suggested next actions.

## 8. Open the first PR

Commit the generated setup and open a PR. The GitHub Action generated by `projscan init team` builds the same evidence-pack comment and validates that it has the required sections before posting.

## 9. Capture first-PR feedback

After a reviewer sees the generated PR comment, record whether it was useful:

```sh
projscan feedback init --output .projscan-feedback.json
projscan feedback add --file .projscan-feedback.json --repo api --pr https://github.com/acme/api/pull/42 --reviewer @alice --useful true --minutes-saved 10 --owner-routing-clear true --next-command-clear true
projscan feedback summary --file .projscan-feedback.json --format json
```

Use `--false-positive-rule`, `--missing-signal`, and `--noisy-finding` when the reviewer reports noise. Clean feedback is evidence too.

## 10. Run the adoption proof loop

Before rolling out broadly, run the same checks on three representative repos:

```sh
projscan dogfood --repo ../api --repo ../web --repo ../worker --feedback .projscan-feedback.json --format json
projscan trial --repo ../api --repo ../web --repo ../worker --feedback .projscan-feedback.json --format json
```

Look at `marketValidation.status` and `trial.verdict`. `proven` / `adopt` require repo coverage, at least three useful responses, measured value, false positives under control, and repeat PR feedback.

## 11. Tune after the first baseline

After one clean review, save or refresh the baseline:

```sh
projscan diff --save-baseline
```

Then tune CODEOWNERS and policy rules so projscan routes real risk to the right team and keeps uncertain findings as manual review instead of scary blockers.

For the repeatable rollout loop, see [Adoption Proof Loop](ADOPTION-PROOF.md).
