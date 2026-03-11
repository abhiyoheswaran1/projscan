# ProjScan — Full Guide

A deep dive into everything ProjScan can do. For a quick overview, see the [README](../README.md).

---

## Table of Contents

- [Installation](#installation)
- [Your First Scan](#your-first-scan)
- [Commands In Depth](#commands-in-depth)
  - [analyze](#analyze)
  - [doctor](#doctor)
  - [ci](#ci)
  - [diff](#diff)
  - [fix](#fix)
  - [explain](#explain)
  - [diagram](#diagram)
  - [structure](#structure)
  - [dependencies](#dependencies)
  - [badge](#badge)
- [Health Score](#health-score)
- [Output Formats](#output-formats)
  - [Console](#console-default)
  - [JSON](#json)
  - [Markdown](#markdown)
- [Global Options](#global-options)
- [What ProjScan Detects](#what-projscan-detects)
  - [Languages](#languages)
  - [Frameworks and Libraries](#frameworks-and-libraries)
  - [Issues and Health Checks](#issues-and-health-checks)
- [Auto-Fix System](#auto-fix-system)
- [Architecture Diagrams](#architecture-diagrams)
- [File Explanation Engine](#file-explanation-engine)
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

---

## Your First Scan

Navigate into any repository and run:

```bash
cd your-project
projscan
```

This runs the default `analyze` command. Within a second or two you'll see a full report covering:

1. **Project overview** — name, total files, total directories, scan time
2. **Language breakdown** — primary language, percentages per language
3. **Frameworks detected** — with confidence levels and categories
4. **Dependency summary** — production vs. dev count, package manager, lock file status
5. **Issues found** — grouped by severity (error, warning, info)

---

## Commands In Depth

### analyze

```bash
projscan analyze
```

The flagship command. Runs every detection module and produces the full project report.

**What it does internally:**
1. Walks the file tree (respecting ignore patterns for `node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `.nuxt`)
2. Builds a language breakdown by mapping file extensions to language names
3. Detects frameworks by inspecting `package.json` dependencies and config file presence
4. Analyzes dependencies from `package.json`
5. Runs all issue analyzers (ESLint, Prettier, tests, architecture, dependency risk, security)
6. Renders the combined report

**Example:**

```bash
$ projscan analyze

ProjScan Analysis
──────────────────────────────────────────

  Project    my-app
  Files      342 files across 28 directories
  Scanned    127ms

Languages
──────────────────────────────────────────
  TypeScript   78.4%  (268 files)
  JavaScript    8.5%  (29 files)
  CSS           5.6%  (19 files)
  JSON          4.4%  (15 files)
  Markdown      3.2%  (11 files)

Frameworks
──────────────────────────────────────────
  React         frontend    high
  Next.js       fullstack   high
  Tailwind CSS  css         high
  Vitest        testing     high

...
```

### doctor

```bash
projscan doctor
```

A focused health check. Runs only the issue detection pipeline and presents results as a health report with a health score and letter grade.

Use this when you want a quick "is this project in good shape?" answer without the full language/framework breakdown.

**Example:**

```bash
$ projscan doctor

Project Health Report
──────────────────────────────────────────

  Health Score: D (67/100)
  Found 1 error, 2 warnings, 1 info

Issues Detected
──────────────────────────────────────────
  ✖ Excessive dependencies (127 production)
  ⚠ No Prettier configuration
  ⚠ Large utils directory (14 files in src/utils)
  ℹ Missing .editorconfig

Recommendations
──────────────────────────────────────────
  1. Fix: No Prettier configuration
  2. Fix: Missing .editorconfig

  Run projscan fix to auto-fix 2 issues.
```

**Severity levels:**
- **error** (✖) — Problems that should be addressed immediately
- **warning** (⚠) — Issues that affect code quality or maintainability
- **info** (ℹ) — Suggestions for best practices

### ci

```bash
projscan ci
```

A CI-pipeline-friendly health gate. Runs the full health check and exits with code 1 if the score falls below a threshold. No spinners or banners — clean output for CI logs.

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--min-score <n>` | Minimum passing score (0–100) | 70 |

**Example:**

```bash
$ projscan ci --min-score 80

projscan: B (82/100) — 0 errors, 2 warnings, 1 info — PASS (threshold: 80)
```

**Exit codes:**
- `0` — Score meets or exceeds the threshold
- `1` — Score is below the threshold

**JSON output** (useful for CI parsing):

```bash
projscan ci --min-score 70 --format json
```

```json
{
  "ci": {
    "score": 82,
    "grade": "B",
    "pass": true,
    "threshold": 70,
    "totalIssues": 3,
    "errors": 0,
    "warnings": 2,
    "info": 1,
    "issues": [...]
  }
}
```

### diff

```bash
projscan diff
```

Compare your project's current health against a saved baseline. Useful for tracking whether health is improving or degrading over time.

**Options:**

| Flag | Description |
|------|-------------|
| `--save-baseline` | Save current health as the baseline |
| `--baseline <path>` | Path to baseline file (default: `.projscan-baseline.json`) |

**Workflow:**

```bash
# Step 1: Save current state as baseline
$ projscan diff --save-baseline

  Baseline saved to /path/to/project/.projscan-baseline.json
  Score: B (82/100)
  Issues: 3

# Step 2: Make changes, then compare
$ projscan diff

Health Diff
──────────────────────────────────────────

  Score: 82 → 90 (+8)  ↑
  Grade: B → A

  ✓ Resolved (2):
    — No ESLint configuration
    — Missing .editorconfig

  ✗ New (1):
    — Potential AWS Access Key detected in src/config.ts

  Baseline: 2026-03-11T10:30:00.000Z
```

**Markdown output** (paste into PRs):

```bash
projscan diff --format markdown
```

The baseline file (`.projscan-baseline.json`) stores the score, grade, and issue list. Add it to your repo to track health over time, or add it to `.gitignore` if you only want local comparisons.

### fix

```bash
projscan fix
```

Detects fixable issues and offers to auto-remediate them. Shows you exactly what will change before applying anything.

**Interactive mode (default):**

```bash
$ projscan fix

  Detected 3 fixable issues:

  1. No ESLint configuration — will create eslint.config.js and install eslint
  2. No Prettier configuration — will create .prettierrc and install prettier
  3. Missing .editorconfig — will create .editorconfig

  Apply 3 fixes? (y/n) y

  ✓ ESLint configuration created
  ✓ Prettier configuration created
  ✓ .editorconfig created

  ✓ 3 fixes applied successfully
```

**Non-interactive mode:**

```bash
projscan fix -y
```

Skips the confirmation prompt. Useful in scripts or CI.

**Available fixes:**

| Fix | What it creates | What it installs |
|-----|----------------|-----------------|
| ESLint | `eslint.config.js` (with TypeScript support if TS is detected) | `eslint`, `@eslint/js`, optionally `typescript-eslint` |
| Prettier | `.prettierrc` with sensible defaults | `prettier` |
| Test framework | `vitest.config.ts` + sample test file, adds `test` script to package.json | `vitest` |
| EditorConfig | `.editorconfig` (UTF-8, LF, 2-space indent, trim trailing whitespace) | Nothing |

### explain

```bash
projscan explain <file>
```

Analyzes a single file and explains what it does. Uses regex-based static analysis — no AI, no network calls.

**What it detects:**
- **Purpose** — Inferred from the file name and directory (e.g., files in `routes/` are "Route definitions", files named `index.ts` are "Module entry point")
- **Imports** — Both ES module `import` and CommonJS `require` statements
- **Exports** — Functions, classes, variables, types, interfaces, default exports
- **Potential issues** — Files over 500 lines, console.log statements, TODO/FIXME comments, usage of `any` type

**Example:**

```bash
$ projscan explain src/core/repositoryScanner.ts

File Explanation
──────────────────────────────────────────
  File      src/core/repositoryScanner.ts
  Purpose   Source module
  Lines     45

Imports
──────────────────────────────────────────
  fast-glob                    (package)
  node:path                    (package)
  ../types.js                  (relative)
  ../utils/fileWalker.js       (relative)

Exports
──────────────────────────────────────────
  scanRepository               function
```

### diagram

```bash
projscan diagram
```

Generates an ASCII architecture diagram. Scans your directory structure and framework detection results to identify architectural layers.

**Layer detection:**

| Layer | Detected from directories | Detected from frameworks |
|-------|--------------------------|-------------------------|
| Frontend | `pages`, `components`, `views`, `layouts`, `public`, `app`, `styles` | React, Next.js, Vue.js, Svelte, Angular |
| API | `api`, `routes`, `controllers`, `endpoints` | Express, Fastify, NestJS, Hono, Koa |
| Services | `services`, `lib`, `core`, `domain`, `modules` | (inferred from file types) |
| Database | `db`, `database`, `prisma`, `migrations`, `models`, `entities` | Prisma, Drizzle, Mongoose, TypeORM |

**Example:**

```
Architecture Diagram
──────────────────────────────────────────

┌──────────────────────────────────┐
│       Frontend (React)           │
│   components, pages, layouts     │
├──────────────────────────────────┤
│       API Layer (Express)        │
│   routes, controllers            │
├──────────────────────────────────┤
│       Services (TypeScript)      │
│   services, core                 │
├──────────────────────────────────┤
│       Database (Prisma)          │
│   prisma, models                 │
└──────────────────────────────────┘
```

Only layers that actually exist in the project are shown.

### structure

```bash
projscan structure
```

Renders a tree view of the project directory with file counts per directory.

**Example:**

```
my-app/
├── src/                  (142 files)
│   ├── components/       (38 files)
│   ├── pages/            (12 files)
│   ├── services/         (8 files)
│   └── utils/            (6 files)
├── tests/                (38 files)
├── public/               (12 files)
├── package.json
└── tsconfig.json
```

Hidden directories, `node_modules`, and build output directories are excluded automatically.

### dependencies

```bash
projscan dependencies
```

Deep dive into your project's dependency graph. Shows:

- Total production and dev dependency counts
- Package manager detected (npm, yarn, pnpm)
- Lock file presence
- Risk analysis: wildcard versions, `latest` tags, excessive dependency counts

**Example:**

```
Dependency Analysis
──────────────────────────────────────────
  Production       24 packages
  Development      18 packages
  Package Manager  npm
  Lock File        ✓ package-lock.json

Risks
──────────────────────────────────────────
  ⚠ lodash uses wildcard version "*"
  ⚠ No lock file found — builds may not be reproducible
```

### badge

```bash
projscan badge
```

Calculates the project health score and generates a [shields.io](https://shields.io) badge you can add to your README.

**Example:**

```bash
$ projscan badge

  Health Score: A (100/100)

  Badge URL:
  https://img.shields.io/badge/projscan-A-brightgreen

  Markdown:
  [![projscan health](https://img.shields.io/badge/projscan-A-brightgreen)](https://github.com/abhiyoheswaran1/projscan)

  Add this to your README to show your project health score.
```

Use `--markdown` to output only the markdown snippet:

```bash
projscan badge --markdown
```

---

## Health Score

Every `projscan doctor` and `projscan badge` run calculates a health score from 0 to 100 based on detected issues.

**Scoring:**

| Severity | Deduction per issue |
|----------|-------------------|
| Error | -20 points |
| Warning | -10 points |
| Info | -3 points |

**Grade thresholds:**

| Grade | Score Range | Meaning |
|-------|-------------|---------|
| A | 90–100 | Excellent — project follows best practices |
| B | 80–89 | Good — minor improvements possible |
| C | 70–79 | Fair — several issues to address |
| D | 60–69 | Poor — significant issues found |
| F | < 60 | Critical — major issues need attention |

The score appears in all output formats:
- **Console**: Shown at the top of the doctor report
- **JSON**: Included as `health.score` and `health.grade` fields
- **Markdown**: Shown as a heading with an auto-generated shields.io badge

---

## Output Formats

Every command supports the `--format` flag.

### Console (default)

Rich, colored terminal output with Unicode box-drawing characters and status icons. Best for interactive use.

```bash
projscan analyze
```

### JSON

Machine-readable output. Useful for piping into other tools, storing results, or building dashboards.

```bash
projscan analyze --format json
```

The JSON output contains the complete `AnalysisReport` object with all data from every detection module.

```bash
# Pipe into jq for filtering
projscan analyze --format json | jq '.issues[] | select(.severity == "error")'

# Save to file
projscan analyze --format json > analysis.json
```

### Markdown

Formatted Markdown suitable for saving as documentation or pasting into a PR description.

```bash
projscan doctor --format markdown > HEALTH.md
projscan analyze --format markdown > ANALYSIS.md
```

---

## Global Options

| Option | Description |
|--------|-------------|
| `--format <type>` | Output format: `console` (default), `json`, `markdown` |
| `--verbose` | Show debug-level logging — useful for diagnosing scan issues |
| `--quiet` | Suppress all non-essential output (spinners, status messages) |
| `-V, --version` | Print the version number |
| `-h, --help` | Print help for any command |

**Per-command help:**

```bash
projscan fix --help
projscan explain --help
```

---

## What ProjScan Detects

### Languages

ProjScan maps file extensions to language names. Supported languages include:

| Language | Extensions |
|----------|-----------|
| TypeScript | `.ts`, `.tsx` |
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` |
| Python | `.py` |
| Go | `.go` |
| Rust | `.rs` |
| Java | `.java` |
| C# | `.cs` |
| C++ | `.cpp`, `.cc`, `.cxx`, `.hpp` |
| C | `.c`, `.h` |
| Ruby | `.rb` |
| PHP | `.php` |
| Swift | `.swift` |
| Kotlin | `.kt`, `.kts` |
| Dart | `.dart` |
| Lua | `.lua` |
| Scala | `.scala` |
| R | `.r`, `.R` |
| Shell | `.sh`, `.bash`, `.zsh` |
| CSS | `.css` |
| SCSS/Sass | `.scss`, `.sass` |
| HTML | `.html`, `.htm` |
| JSON | `.json` |
| YAML | `.yml`, `.yaml` |
| Markdown | `.md` |
| SQL | `.sql` |
| ...and more | |

The **primary language** is the one with the most files.

### Frameworks and Libraries

Detection uses two strategies:

**1. Dependency scanning** — checks `package.json` for known framework packages:

React, Next.js, Vue.js, Nuxt.js, Svelte, SvelteKit, Angular, Solid.js, Express, Fastify, NestJS, Hono, Koa, Apollo Server, tRPC, Prisma, Drizzle ORM, Mongoose, TypeORM, Sequelize, Tailwind CSS, Vite, Webpack, Rollup, esbuild, Vitest, Jest, Mocha, Cypress, Playwright, Storybook, and more.

**2. Config file presence** — checks for known configuration files:

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
- **Large utility directories**: warns if `utils/`, `helpers/`, or `lib/` contains 10+ files
- **Missing .editorconfig**: info with auto-fix available
- **Heuristic structural analysis**: checks for common anti-patterns

#### 5. Dependency Risk Check
- Warns if production dependencies exceed 50
- Errors if total dependencies exceed 100
- Flags `*` or `latest` version ranges
- Warns if no lock file is present

#### 6. Security Check
- **Committed `.env` files**: Flags `.env`, `.env.local`, `.env.production`, etc. (but not `.env.example`, `.env.sample`, `.env.template`)
- **Private key files**: Detects `.pem`, `.key`, `id_rsa`, `id_ed25519`, `.p12`, `.pfx` files
- **Hardcoded secrets**: Scans file contents (files under 512KB) for:
  - AWS Access Keys (`AKIA...`)
  - GitHub tokens (`ghp_...`, `ghs_...`)
  - Slack tokens (`xoxb-...`, `xoxp-...`)
  - Generic patterns (`password=`, `secret=`, `api_key=` with quoted values)
  - PEM private key headers
- **Missing `.gitignore` entries**: Warns if `.env` is not in `.gitignore`
- Severity: `error` for secrets and private keys, `warning` for .env files and missing .gitignore entries

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
- Creates `.editorconfig`:
  ```ini
  root = true

  [*]
  charset = utf-8
  end_of_line = lf
  indent_style = space
  indent_size = 2
  insert_final_newline = true
  trim_trailing_whitespace = true
  ```
- Installs nothing — EditorConfig is handled by editor plugins

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

## Performance

ProjScan is designed to be fast enough to run on every save or as a pre-commit hook.

| Metric | Target |
|--------|--------|
| 5,000 files | < 1.5 seconds |
| 20,000 files | < 3 seconds |
| Network requests | Zero |
| Runtime dependencies | 4 packages |

**How it stays fast:**
- Uses `fast-glob` for file walking (one of the fastest glob implementations for Node.js)
- Language detection is a pure function — no I/O, just extension mapping
- Framework detection reads at most one file (`package.json`) plus checks file names already in memory
- All detection runs sequentially but each step is O(n) or better

---

## Common Workflows

### Onboarding to a new codebase

```bash
cd new-project
projscan                      # Full overview
projscan structure            # Understand the layout
projscan diagram              # See the architecture
projscan explain src/index.ts # Understand the entry point
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

### Checking dependency health

```bash
projscan dependencies
projscan dependencies --format json | jq '.risks'
```

### Extracting data for a dashboard

```bash
projscan analyze --format json > /tmp/projscan-report.json
```

---

## CI/CD Integration

ProjScan ships with a dedicated `ci` command and a ready-to-use GitHub Actions workflow template.

### Using `projscan ci`

The `ci` command is purpose-built for pipelines — no spinners, no banners, clean exit codes:

```bash
projscan ci                          # Fail if score < 70 (default)
projscan ci --min-score 80           # Fail if score < 80
projscan ci --min-score 70 --format json  # JSON output for parsing
```

### GitHub Actions (copy-paste ready)

ProjScan includes a workflow template at `.github/projscan-ci.yml`. Copy it to your project:

```bash
cp node_modules/projscan/.github/projscan-ci.yml .github/workflows/projscan.yml
```

Or copy from the [template file](../.github/projscan-ci.yml) directly. The workflow:

1. Runs `projscan ci --min-score 70` on every push and PR
2. Posts (or updates) a markdown health report as a PR comment
3. Fails the build if the score is below the threshold

### Using JSON output in scripts

```bash
#!/bin/bash
result=$(projscan ci --min-score 0 --format json)
pass=$(echo "$result" | jq '.ci.pass')
score=$(echo "$result" | jq '.ci.score')

echo "Score: $score, Pass: $pass"

if [ "$pass" = "false" ]; then
  exit 1
fi
```

### Tracking health over time in CI

Combine `ci` with `diff` to track regressions:

```bash
projscan diff --save-baseline        # Run once to create baseline
# Commit .projscan-baseline.json to your repo

# In CI, compare against baseline:
projscan diff --format json          # Shows new/resolved issues
```

---

## Troubleshooting

### "No package.json found"

The `dependencies` and `fix` commands require a `package.json` in the current directory. Other commands (`analyze`, `structure`, `diagram`, `explain`) work without one.

### Scan is slow

If scanning takes more than a few seconds, check whether you have large unignored directories. ProjScan ignores `node_modules`, `.git`, `dist`, `build`, and `coverage` by default, but other large directories (e.g., vendored assets, data files) may slow the scan.

### Fix command fails to install packages

The fix system uses `npm install` by default. If you use yarn or pnpm, the install step may behave differently. Check your package manager's output for errors.

### Explain command shows "Source module"

This is the fallback purpose when ProjScan can't infer a more specific purpose from the file name or directory. It means the file doesn't match any known naming conventions.

---

## Project Internals

For contributors and the curious — here's how ProjScan is structured:

```
src/
├── cli/
│   └── index.ts           # CLI entry point, all commands defined here
├── core/
│   ├── repositoryScanner.ts   # File tree walking, directory tree building
│   ├── languageDetector.ts    # Extension -> language mapping
│   ├── frameworkDetector.ts   # Framework detection from deps + config files
│   ├── dependencyAnalyzer.ts  # package.json parsing, risk detection
│   └── issueEngine.ts        # Runs all analyzers, aggregates issues
├── analyzers/
│   ├── eslintCheck.ts         # ESLint configuration presence
│   ├── prettierCheck.ts       # Prettier configuration presence
│   ├── testCheck.ts           # Test framework + test file presence
│   ├── architectureCheck.ts   # Structural heuristics
│   ├── dependencyRiskCheck.ts # Dependency count + version risks
│   └── securityCheck.ts       # Secrets, .env files, private keys
├── fixes/
│   ├── eslintFix.ts           # Creates eslint config, installs eslint
│   ├── prettierFix.ts         # Creates .prettierrc, installs prettier
│   ├── testFix.ts             # Creates vitest config + sample test
│   ├── editorconfigFix.ts     # Creates .editorconfig
│   └── fixRegistry.ts         # Maps fix IDs to fix implementations
├── reporters/
│   ├── consoleReporter.ts     # Rich terminal output with chalk
│   ├── jsonReporter.ts        # JSON output
│   └── markdownReporter.ts    # Markdown output
├── utils/
│   ├── fileWalker.ts          # fast-glob wrapper with ignore patterns
│   ├── logger.ts              # Structured logger with levels
│   ├── scoreCalculator.ts     # Health score calculation and badge generation
│   └── baseline.ts            # Baseline save/load/diff for health tracking
└── types.ts                   # All shared TypeScript interfaces
```

**Key design decisions:**
- **Single `types.ts`** — Avoids circular dependencies between modules
- **ESM-only** — Required by chalk v5 and ora v8; all imports use `.js` extensions
- **Pure functions where possible** — `detectLanguages` is pure (no I/O), making it trivially testable
- **No class hierarchies** — Analyzers and fixes are plain functions with consistent signatures
- **No runtime config** — Everything is convention-based; no `.projscanrc` file needed
