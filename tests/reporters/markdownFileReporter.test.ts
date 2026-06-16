import { describe, expect, it } from 'vitest';
import { reportFileMarkdown } from '../../src/reporters/markdownFileReporter.js';
import { reportFileMarkdown as reportFileMarkdownFromMarkdownReporter } from '../../src/reporters/markdownReporter.js';
import { captureStdout, makeFileInspection } from './fixtures.js';

describe('markdownFileReporter', () => {
  it('prints unavailable file reasons', async () => {
    const out = await captureStdout(() =>
      reportFileMarkdown(
        makeFileInspection({
          exists: false,
          reason: 'file not found',
        }),
      ),
    );

    expect(out).toContain('# File: src/big.ts');
    expect(out).toContain('> file not found');
    expect(out).not.toContain('## Risk');
  });

  it('prints summary, risk, issues, dependencies, exports, and functions', async () => {
    const out = await captureStdout(() => reportFileMarkdown(makeFileInspection()));

    expect(out).toContain('# File: src/big.ts');
    expect(out).toContain('**Purpose:** Source module');
    expect(out).toContain('**Lines:** 500  |  **Size:** 1536 B');
    expect(out).toContain('**Cyclomatic complexity:** 23');
    expect(out).toContain('**Coupling:** fan-in 2, fan-out 7');
    expect(out).toContain('## Risk');
    expect(out).toContain('- **Risk score:** 85.0');
    expect(out).toContain('- **Authors:** 1 (primary: alice@example.com, 75%)');
    expect(out).toContain('- ⚠️ **Bus factor 1** - only one author has touched this.');
    expect(out).toContain('## Related Issues');
    expect(out).toContain('- ⚠️ **Missing README** - No README file found.');
    expect(out).toContain('## Potential Issues');
    expect(out).toContain('- ⚠️ Large file (500 lines) - consider splitting');
    expect(out).toContain('## Dependencies');
    expect(out).toContain('- `./local.js` (local)');
    expect(out).toContain('- `chalk`');
    expect(out).toContain('## Exports');
    expect(out).toContain('- `run` (function)');
    expect(out).toContain('## Functions (top by CC)');
    expect(out).toContain('| 12 | 1 | `riskier` | L10-30 |');
  });

  it('truncates function rows after the first 20 entries', async () => {
    const functions = Array.from({ length: 22 }, (_, index) => ({
      name: `fn${index + 1}`,
      line: index + 1,
      endLine: index + 2,
      cyclomaticComplexity: 22 - index,
      fanIn: index,
    }));

    const out = await captureStdout(() => reportFileMarkdown(makeFileInspection({ functions })));

    expect(out).toContain('| 22 | 0 | `fn1` | L1-2 |');
    expect(out).toContain('| 3 | 19 | `fn20` | L20-21 |');
    expect(out).not.toContain('`fn21`');
    expect(out).toContain('_... and 2 more_');
  });

  it('preserves the markdownReporter re-export', () => {
    expect(reportFileMarkdownFromMarkdownReporter).toBe(reportFileMarkdown);
  });
});
