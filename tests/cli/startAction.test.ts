import { describe, expect, it, vi } from 'vitest';

import {
  parsePositiveInt,
  parseStartMode,
  runStartAction,
  type StartActionDependencies,
  type StartCommandOptions,
} from '../../src/cli/commands/startAction.js';
import type { ReportFormat, StartReport } from '../../src/types.js';

describe('start command action', () => {
  it('parses optional start mode values without changing valid modes', () => {
    expect(parseStartMode(undefined, exitHarness())).toBeUndefined();
    expect(parseStartMode('bug_hunt', exitHarness())).toBe('bug_hunt');
  });

  it('exits with a supported mode message for invalid mode values', () => {
    const harness = exitHarness();

    expect(() => parseStartMode('unknown', harness)).toThrow('exit 1');
    expect(harness.logError).toHaveBeenCalledWith(
      expect.stringContaining('Unsupported --mode unknown.'),
    );
    expect(harness.logError).toHaveBeenCalledWith(
      expect.stringContaining('Supported modes: before_edit'),
    );
    expect(harness.exit).toHaveBeenCalledWith(1);
  });

  it('parses positive integer option values', () => {
    expect(parsePositiveInt('7')).toBe(7);
    expect(() => parsePositiveInt('0')).toThrow('value must be a positive integer');
    expect(() => parsePositiveInt('abc')).toThrow('value must be a positive integer');
  });

  it('computes the start report and delegates output with normalized command options', async () => {
    const options: StartCommandOptions = {
      mode: 'bug_hunt',
      intent: 'find bugs before release',
      mission: 'mission',
      maxTasks: 2,
      maxRisks: 4,
      includeHandoff: true,
      nextCommand: true,
    };
    const report = { schemaVersion: 1, rootPath: '/repo', mode: 'bug_hunt' } as StartReport;
    const deps = startActionDeps({ report });

    await runStartAction(options, deps);

    expect(deps.setupLogLevel).toHaveBeenCalledOnce();
    expect(deps.maybeCompactBanner).toHaveBeenCalledOnce();
    expect(deps.assertFormatSupported).toHaveBeenCalledWith('start');
    expect(deps.computeStartReport).toHaveBeenCalledWith('/repo', {
      mode: 'bug_hunt',
      intent: 'find bugs before release',
      missionDir: 'mission',
      maxTasks: 2,
      maxRisks: 4,
      includeHandoff: true,
    });
    expect(deps.handleStartOutput).toHaveBeenCalledWith(report, {
      rootPath: '/repo',
      format: 'json',
      mode: 'bug_hunt',
      intent: 'find bugs before release',
      options,
    });
  });

  it('prints command failures and exits with status 1', async () => {
    const deps = startActionDeps({ error: new Error('start failed') });

    await expect(runStartAction({}, deps)).rejects.toThrow('exit 1');

    expect(deps.logError).toHaveBeenCalledWith(expect.stringContaining('start failed'));
    expect(deps.exit).toHaveBeenCalledWith(1);
  });
});

function startActionDeps(input: { report?: StartReport; error?: Error } = {}) {
  const harness = exitHarness();
  return {
    setupLogLevel: vi.fn(),
    maybeCompactBanner: vi.fn(),
    assertFormatSupported: vi.fn((): ReportFormat => 'json'),
    getRootPath: vi.fn(() => '/repo'),
    computeStartReport: vi.fn(async () => {
      if (input.error) throw input.error;
      return input.report ?? ({ schemaVersion: 1, rootPath: '/repo' } as StartReport);
    }),
    handleStartOutput: vi.fn(async () => undefined),
    ...harness,
  } satisfies StartActionDependencies;
}

function exitHarness() {
  return {
    logError: vi.fn(),
    exit: vi.fn((code: number): never => {
      throw new Error(`exit ${code}`);
    }),
  };
}
