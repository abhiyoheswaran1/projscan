import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import { prettierFix } from '../../src/fixes/prettierFix.js';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:fs/promises');

import { execSync } from 'node:child_process';

describe('prettierFix', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('has correct metadata', () => {
    expect(prettierFix.id).toBe('add-prettier');
    expect(prettierFix.issueId).toBe('missing-prettier');
  });

  it('installs prettier with 60s timeout', async () => {
    vi.mocked(fs.writeFile).mockResolvedValue();
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ scripts: {} }));

    await prettierFix.apply('/proj');

    expect(execSync).toHaveBeenCalledWith(
      'npm install --save-dev prettier',
      expect.objectContaining({ timeout: 60_000 }),
    );
  });

  it('writes .prettierrc config', async () => {
    vi.mocked(fs.writeFile).mockResolvedValue();
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ scripts: {} }));

    await prettierFix.apply('/proj');

    const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
    expect(writeCall[0]).toContain('.prettierrc');
    const config = JSON.parse(writeCall[1] as string);
    expect(config.singleQuote).toBe(true);
  });

  it('adds format script to package.json', async () => {
    vi.mocked(fs.writeFile).mockResolvedValue();
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ scripts: {} }));

    await prettierFix.apply('/proj');

    // Second writeFile call is package.json
    const pkgWrite = vi.mocked(fs.writeFile).mock.calls[1];
    expect(pkgWrite[0]).toContain('package.json');
    const pkg = JSON.parse(pkgWrite[1] as string);
    expect(pkg.scripts.format).toBe('prettier --write .');
  });

  it('skips format script if already present', async () => {
    vi.mocked(fs.writeFile).mockResolvedValue();
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ scripts: { format: 'existing' } }),
    );

    await prettierFix.apply('/proj');

    // Only one writeFile call (.prettierrc), no package.json update
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
  });

  it('silently skips if no package.json (ENOENT)', async () => {
    vi.mocked(fs.writeFile).mockResolvedValue();
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    vi.mocked(fs.readFile).mockRejectedValue(err);

    await expect(prettierFix.apply('/proj')).resolves.toBeUndefined();
  });

  it('re-throws non-ENOENT errors', async () => {
    vi.mocked(fs.writeFile).mockResolvedValue();
    vi.mocked(fs.readFile).mockResolvedValue('not valid json {{{');

    await expect(prettierFix.apply('/proj')).rejects.toThrow();
  });
});
