import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { getToolHandler } from '../../src/mcp/tools.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-upgrade-fallback-'));
}

describe('projscan_upgrade Python fallback', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  function upgradeHandler() {
    const handler = getToolHandler('projscan_upgrade');
    if (!handler) throw new Error('projscan_upgrade handler not found');
    return handler;
  }

  it('returns available=false with Python-specific reason on a Python-dominated repo', async () => {
    await fs.writeFile(path.join(tmp, 'pyproject.toml'), '[project]\nname = "x"\n');
    await fs.mkdir(path.join(tmp, 'pkg'), { recursive: true });
    await fs.writeFile(path.join(tmp, 'pkg', 'mod.py'), 'x = 1\n');

    const result = (await upgradeHandler()({ package: 'requests' }, tmp)) as {
      available: boolean;
      reason: string;
      name: string;
      importers: string[];
    };
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/Node\.js|Python/);
    expect(result.name).toBe('requests');
    expect(result.importers).toEqual([]);
  });

  it('proceeds normally on a JS repo (no Python manifest)', async () => {
    await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({
      name: 'app',
      dependencies: { chalk: '^5.0.0' },
    }));
    await fs.mkdir(path.join(tmp, 'node_modules', 'chalk'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'node_modules', 'chalk', 'package.json'),
      JSON.stringify({ name: 'chalk', version: '5.3.0' }),
    );

    const result = (await upgradeHandler()({ package: 'chalk' }, tmp)) as {
      available: boolean;
      declared?: string | null;
      installed?: string | null;
    };
    // Should NOT fall into the Python short-circuit - available may be true or
    // false depending on CHANGELOG presence, but the reason should NOT mention
    // Python.
    if (!result.available) {
      // Acceptable; just make sure the reason isn't the Python fallback text.
      expect((result as { reason?: string }).reason ?? '').not.toMatch(/Python|Node\.js/);
    } else {
      expect(result.declared).toBe('^5.0.0');
      expect(result.installed).toBe('5.3.0');
    }
  });
});
