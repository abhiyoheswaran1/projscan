import { describe, expect, test } from 'vitest';
import { buildStartAdoptionGaps } from '../../src/core/startAdoptionGaps.js';
import type { FirstRunDiagnostic } from '../../src/core/adoption.js';

describe('start adoption gaps', () => {
  test('keeps warnings and failures while dropping optional info diagnostics', () => {
    const diagnostics: FirstRunDiagnostic[] = [
      {
        id: 'node',
        label: 'Node.js',
        status: 'pass',
        summary: 'Node is ready.',
      },
      {
        id: 'plugins',
        label: 'Local plugins',
        status: 'info',
        summary: 'No local plugin manifests found.',
        command: 'projscan plugin init --kind analyzer --name policy',
      },
      {
        id: 'git',
        label: 'Git',
        status: 'warn',
        summary: 'Git worktree has local changes.',
      },
      {
        id: 'mcp-startup',
        label: 'MCP startup',
        status: 'fail',
        summary: 'MCP config is missing.',
        command: 'projscan mcp doctor --client codex --format json',
      },
    ];

    expect(buildStartAdoptionGaps(diagnostics)).toEqual([
      {
        id: 'git',
        status: 'warn',
        title: 'Git',
        summary: 'Git worktree has local changes.',
      },
      {
        id: 'mcp-startup',
        status: 'fail',
        title: 'MCP startup',
        summary: 'MCP config is missing.',
        command: 'projscan mcp doctor --client codex --format json',
      },
    ]);
  });
});
