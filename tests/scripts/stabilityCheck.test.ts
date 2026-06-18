import { afterEach, describe, expect, it, vi } from 'vitest';
import { compareStableSurface, createStableSurface } from '../../scripts/check-stability.mjs';
import { printStabilityError, printStabilityUpdateReport } from '../../scripts/stability-report.mjs';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('stable surface check', () => {
  it('builds the default stable CLI and exit-code contract', () => {
    const surface = createStableSurface({ tools: [] });

    expect(surface.cliCommands).toContain('review');
    expect(surface.cliCommands).toContain('workspace');
    expect(surface.exitCodes).toEqual({
      success: 0,
      issues: 1,
      invalidUsage: 2,
    });
  });

  it('allows additive stable surface changes while reporting them for review', () => {
    const report = compareStableSurface(
      {
        schemaVersion: 1,
        mcpTools: {
          projscan_review: {
            args: ['format'],
            required: [],
          },
        },
        cliCommands: ['review'],
        exitCodes: {
          success: 0,
          issues: 1,
        },
      },
      {
        schemaVersion: 1,
        mcpTools: {
          projscan_review: {
            args: ['format', 'intent'],
            required: [],
          },
          projscan_bug_hunt: {
            args: ['format'],
            required: [],
          },
        },
        cliCommands: ['bug-hunt', 'review'],
        exitCodes: {
          success: 0,
          issues: 1,
        },
      },
    );

    expect(report.status).toBe('pass');
    expect(report.issues).toEqual([]);
    expect(report.additions).toEqual([
      '+ MCP tool: projscan_bug_hunt',
      '+ arg intent in projscan_review',
      '+ CLI command: bug-hunt',
    ]);
  });

  it('blocks stable surface removals, new required args, and changed exit codes', () => {
    const report = compareStableSurface(
      {
        schemaVersion: 1,
        mcpTools: {
          projscan_review: {
            args: ['format', 'intent'],
            required: ['format'],
          },
          projscan_taint: {
            args: ['format'],
            required: [],
          },
        },
        cliCommands: ['review', 'taint'],
        exitCodes: {
          success: 0,
          issues: 1,
        },
      },
      {
        schemaVersion: 1,
        mcpTools: {
          projscan_review: {
            args: ['format'],
            required: ['format', 'strict'],
          },
        },
        cliCommands: ['review'],
        exitCodes: {
          success: 0,
          issues: 2,
        },
      },
    );

    expect(report.status).toBe('fail');
    expect(report.issues).toEqual([
      'REMOVED MCP tool: projscan_taint',
      'REMOVED arg from projscan_review: intent',
      'NEW required arg in projscan_review: strict (must be optional within a major version)',
      'REMOVED CLI command: taint',
      'exit code "issues" changed: 1 → 2',
    ]);
  });

  it('prints update guidance from the stability reporter', () => {
    const messages: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message = '') => {
      messages.push(String(message));
    });

    printStabilityUpdateReport({ baselinePath: 'stability-baseline.json' });

    expect(messages).toEqual([
      '✓ stability baseline updated at stability-baseline.json',
      '  Only do this on a deliberate major version bump or when intentionally',
      '  expanding the stable surface (e.g. promoting a tool to GA).',
    ]);
  });

  it('prints thrown errors from the stability reporter', () => {
    const errors: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((message = '') => {
      errors.push(String(message));
    });

    printStabilityError(new Error('manifest missing'));
    printStabilityError('plain failure');

    expect(errors).toEqual(['manifest missing', 'plain failure']);
  });
});
