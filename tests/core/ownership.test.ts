import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadOwnership } from '../../src/core/ownership.js';

describe('loadOwnership', () => {
  it('uses workspace package owner metadata as an ownership fallback', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-ownership-'));
    try {
      await fs.writeFile(
        path.join(root, 'package.json'),
        JSON.stringify({ name: 'root', private: true, workspaces: ['packages/*'] }, null, 2),
      );
      await fs.mkdir(path.join(root, 'packages', 'api'), { recursive: true });
      await fs.writeFile(
        path.join(root, 'packages', 'api', 'package.json'),
        JSON.stringify({ name: '@app/api', projscan: { owner: '@api-team' } }, null, 2),
      );

      const lookup = await loadOwnership(root);

      expect(lookup?.('packages/api/src/routes.ts')).toBe('@api-team');
      expect(lookup?.('packages/web/src/page.ts')).toBeUndefined();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
