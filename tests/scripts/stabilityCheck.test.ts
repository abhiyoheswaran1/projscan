import { describe, expect, it } from 'vitest';
import { compareStableSurface } from '../../scripts/check-stability.mjs';

describe('stable surface check', () => {
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
});
