import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('release workflow metadata', () => {
  const root = process.cwd();
  const workflow = readFileSync(join(root, '.github/workflows/release.yml'), 'utf8');

  it('opts JavaScript actions into the Node 24 runtime', () => {
    expect(workflow).toMatch(/FORCE_JAVASCRIPT_ACTIONS_TO_NODE24:\s*true/);
  });
});
