import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('start command architecture', () => {
  it('keeps Mission Control option registration out of the command facade', () => {
    const startSource = readFileSync(
      path.join(process.cwd(), 'src/cli/commands/start.ts'),
      'utf8',
    );
    expect(startSource).toContain("from './startOptionsRegistration.js'");
    expect(startSource).toContain('registerStartOptions(');
    expect(startSource).not.toContain('.option(');
    expect(startSource).not.toContain('--handoff-prompt');
    expect(startSource).not.toContain('--review-gate-json');

    const optionsSource = readFileSync(
      path.join(process.cwd(), 'src/cli/commands/startOptionsRegistration.ts'),
      'utf8',
    );
    expect(optionsSource).not.toContain("from './start.js'");
    expect(optionsSource).toContain('parsePositiveInt');
    expect(optionsSource).toContain('--handoff-prompt');
    expect(optionsSource).toContain('--review-gate-json');
  });
});
