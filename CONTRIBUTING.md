# Contributing to projscan

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/abhiyoheswaran1/projscan.git
cd projscan
npm install
npm run build
```

### Running locally

```bash
# Run the CLI directly from source
node dist/cli/index.js doctor

# Watch mode for development
npm run dev
```

### Running tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

### Linting and formatting

```bash
npm run lint          # ESLint
npm run format        # Prettier
```

## How to Contribute

### Reporting Bugs

Open an [issue](https://github.com/abhiyoheswaran1/projscan/issues/new?template=bug_report.md) with:
- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS

### Suggesting Features

Open an [issue](https://github.com/abhiyoheswaran1/projscan/issues/new?template=feature_request.md) describing:
- The problem you're trying to solve
- Your proposed solution
- Alternative approaches you've considered

### Submitting Pull Requests

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add or update tests as needed
4. Run `npm test` and `npm run lint` to verify
5. Write a clear PR description explaining the change

## Project Structure

```
src/
├── cli/          # Command definitions (Commander.js)
├── core/         # Scanners, detectors, issue engine, hotspots, file inspector
├── analyzers/    # Issue checkers (eslint, prettier, test, architecture, deps, security)
├── fixes/        # Auto-fix implementations (ESLint, Prettier, Vitest, EditorConfig)
├── reporters/    # Output formatters (console, JSON, markdown, SARIF)
├── mcp/          # MCP server — tools, prompts, resources for AI agents
└── utils/        # Shared utilities (config loader, changed-files, baseline, banner, logger)
```

## Code Style

- TypeScript with strict mode
- ESLint + Prettier for formatting
- Keep dependencies minimal — avoid adding new runtime dependencies unless necessary
- Write tests for new analyzers and fixers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
