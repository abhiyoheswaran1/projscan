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
    expect(out).toContain('(threshold: 50, failOn: warning)');
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
    expect(out).toContain('(threshold: 100, failOn: warning)');
    expect(out).toContain('1 error');
    expect(out).toContain('2 warnings');
    expect(out).toContain('1 info');
    expect(out).toContain('Score breakdown');
    expect(out).toContain('error: 1 x 20 = -20');
    expect(out).toContain('warning: 2 x 10 = -20');
    expect(out).toContain('info: 1 x 3 = -3');
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

  it('shows when failOn lets info-only findings pass despite a low score', async () => {
    const issues = Array.from({ length: 20 }, (_, index) =>
      makeIssue({ id: `info-${index}`, severity: 'info' }),
    );
    const out = await capturePlain(() => reportCi(issues, 70, 'warning'));

    expect(out).toContain('PASS');
    expect(out).toContain('(threshold: 70, failOn: warning)');
    expect(out).toContain('score is below threshold, but no warning-or-higher findings were found');
  });

  it('preserves the consoleReporter re-export', async () => {
    const out = await capturePlain(() => reportCiFromConsoleReporter([], 50));

    expect(out).toContain('PASS');
    expect(out).toContain('threshold: 50');
    expect(out).toContain('failOn: warning');
  });
});
