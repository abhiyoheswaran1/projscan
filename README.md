# devlens

Instant codebase insights — doctor, x-ray, and architecture map for any repository.

Run once, learn something immediately. Run daily, improve your codebase.

## Install

```bash
npm install -g devlens
```

Or run directly:

```bash
npx devlens
```

## Quick Start

Run inside any repository:

```bash
devlens
```

This runs the default `analyze` command and outputs a full project report including language breakdown, frameworks, structure, issues, and suggestions.

For a comprehensive walkthrough of every feature, use case, and output format, see the **[Full Guide](docs/GUIDE.md)**.

## Commands

### `devlens analyze`

Full project analysis — language detection, framework detection, dependency audit, and issue scanning.

```bash
devlens analyze
```

### `devlens doctor`

Health check for your project. Detects missing tooling, architecture smells, and dependency risks.

```bash
devlens doctor
```

Example output:

```
Project Health Report
──────────────────────────────────────────

  Found 3 warnings, 2 info

Issues Detected
──────────────────────────────────────────
  ⚠ No ESLint configuration
  ⚠ No Prettier configuration
  ⚠ No test framework detected
  ℹ Missing .editorconfig
  ℹ README is nearly empty

Recommendations
──────────────────────────────────────────
  1. Fix: No ESLint configuration
  2. Fix: No Prettier configuration
  3. Fix: No test framework detected
  4. Fix: Missing .editorconfig

  Run devlens fix to auto-fix 4 issues.
```

### `devlens fix`

Automatically installs and configures missing developer tools.

```bash
devlens fix
```

Detects issues, proposes fixes, prompts for confirmation, then applies:

- Installs ESLint with TypeScript support
- Installs Prettier with sensible defaults
- Installs Vitest with a sample test
- Creates `.editorconfig`

Use `-y` to skip the prompt:

```bash
devlens fix -y
```

### `devlens explain <file>`

Explains a file — its purpose, imports, exports, and potential issues.

```bash
devlens explain src/services/payment.ts
```

### `devlens diagram`

Generates an ASCII architecture diagram showing project layers and technologies.

```bash
devlens diagram
```

### `devlens structure`

Shows the project directory tree with file counts.

```bash
devlens structure
```

### `devlens dependencies`

Analyzes project dependencies — counts, risks, and recommendations.

```bash
devlens dependencies
```

## Output Formats

All commands support `--format` for different output targets:

```bash
devlens analyze --format json
devlens doctor --format markdown > HEALTH.md
```

Formats: `console` (default), `json`, `markdown`

## Options

| Flag | Description |
|------|-------------|
| `--format <type>` | Output format: console, json, markdown |
| `--verbose` | Enable debug output |
| `--quiet` | Suppress non-essential output |
| `-V, --version` | Show version |
| `-h, --help` | Show help |

## Performance

DevLens is designed for speed:

- 5,000 files analyzed in under 1.5 seconds
- 20,000 files analyzed in under 3 seconds
- Zero network requests — everything runs locally
- Minimal dependencies (4 runtime packages)

## What It Detects

**Languages**: TypeScript, JavaScript, Python, Go, Rust, Java, Ruby, C/C++, PHP, Swift, Kotlin, and 20+ more

**Frameworks**: React, Next.js, Vue, Nuxt, Svelte, Angular, Express, Fastify, NestJS, Vite, Tailwind CSS, Prisma, and more

**Issues**:
- Missing ESLint configuration
- Missing Prettier configuration
- Missing test framework
- Missing `.editorconfig`
- Large utility directories (architecture smell)
- Excessive dependencies
- Deprecated packages
- Wildcard version ranges
- Missing lockfile

## Development

```bash
git clone https://github.com/your-org/devlens.git
cd devlens
npm install
npm run build
npm link
```

Run tests:

```bash
npm test
```

## License

MIT
