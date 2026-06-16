import { describe, expect, it } from 'vitest';
import { reportCi } from '../../src/reporters/consoleCiReporter.js';
import { reportCi as reportCiFromConsoleReporter } from '../../src/reporters/consoleReporter.js';
import { captureStdout, makeIssue, stripAnsi } from './fixtures.js';

async function capturePlain(fn: () => void): Promise<string> {
  return stripAnsi(await captureStdout(fn));
}

describe('consoleCiReporter', () => {
  it('renders PASS with score, grade, counts, and threshold when score clears threshold', async () => {
    const out = await capturePlain(() => reportCi([], 50));

    expect(out).toContain('projscan:');
    expect(out).toContain('A (100/100)');
    expect(out).toContain('0 errors');
    expect(out).toContain('0 warnings');
    expect(out).toContain('0 info');
    expect(out).toContain('PASS');
    expect(out).toContain('(threshold: 50)');
  });

  it('renders FAIL with pluralized counts and issue rows when score is below threshold', async () => {
    const issues = [
      makeIssue({ id: 'error-1', title: 'First error', severity: 'error' }),
      makeIssue({ id: 'warning-1', title: 'One warning', severity: 'warning' }),
      makeIssue({ id: 'warning-2', title: 'Second warning', severity: 'warning' }),
      makeIssue({ id: 'info-1', title: 'One info', severity: 'info' }),
    ];
    const out = await capturePlain(() => reportCi(issues, 100));

    expect(out).toContain('FAIL');
    expect(out).toContain('(threshold: 100)');
    expect(out).toContain('1 error');
    expect(out).toContain('2 warnings');
    expect(out).toContain('1 info');
    expect(out).toContain('First error');
    expect(out).toContain('One warning');
    expect(out).toContain('Second warning');
    expect(out).toContain('One info');
  });

  it('does not render issue rows when score clears threshold with issues present', async () => {
    const issues = [
      makeIssue({ id: 'warning-1', title: 'Hidden warning row', severity: 'warning' }),
    ];
    const out = await capturePlain(() => reportCi(issues, 0));

    expect(out).toContain('PASS');
    expect(out).toContain('1 warning');
    expect(out).not.toContain('Hidden warning row');
  });

  it('preserves the consoleReporter re-export', async () => {
    const out = await capturePlain(() => reportCiFromConsoleReporter([], 50));

    expect(out).toContain('PASS');
    expect(out).toContain('threshold: 50');
  });
});
