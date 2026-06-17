import { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import { cliCommandPath } from '../../src/cli/commandPath.js';

describe('cliCommandPath', () => {
  it('returns a single command name under the root command', () => {
    const program = new Command().name('projscan');
    const doctor = new Command('doctor');
    program.addCommand(doctor);

    expect(cliCommandPath(doctor)).toBe('doctor');
  });

  it('returns nested command names without the root command', () => {
    const program = new Command().name('projscan');
    const mcp = new Command('mcp');
    const doctor = new Command('doctor');
    mcp.addCommand(doctor);
    program.addCommand(mcp);

    expect(cliCommandPath(doctor)).toBe('mcp doctor');
  });

  it('falls back to the action command name when no root parent is present', () => {
    const orphan = new Command('standalone');

    expect(cliCommandPath(orphan)).toBe('standalone');
  });
});
