import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readMcpPackageVersion } from '../../src/mcp/serverVersion.js';

describe('readMcpPackageVersion', () => {
  it('reads the version from a package manifest', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mcp-version-'));
    try {
      const manifest = path.join(root, 'package.json');
      await fs.writeFile(manifest, JSON.stringify({ version: '9.8.7' }));

      expect(readMcpPackageVersion(manifest)).toBe('9.8.7');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('falls back when the package manifest cannot be read', () => {
    expect(readMcpPackageVersion('/missing/package.json')).toBe('0.0.0');
  });
});
