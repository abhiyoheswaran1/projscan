import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import { eslintFix } from '../../src/fixes/eslintFix.js';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:fs/promises');

vi.mock('../../src/utils/fileHelpers.js', () => ({
  fileExists: vi.fn(),
}));

import { execSync } from 'node:child_process';
import { fileExists } from '../../src/utils/fileHelpers.js';

describe('eslintFix', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('has correct metadata', () => {
    expect(eslintFix.id).toBe('add-eslint');
    expect(eslintFix.issueId).toBe('missing-eslint');
  });

  it('installs eslint with TypeScript plugins when tsconfig exists', async () => {
    vi.mocked(fileExists).mockResolvedValue(true);
    vi.mocked(fs.writeFile).mockResolvedValue();

    await eslintFix.apply('/proj');

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('@typescript-eslint/parser'),
      expect.objectContaining({ timeout: 60_000 }),
    );
  });

  it('installs only eslint when no tsconfig', async () => {
    vi.mocked(fileExists).mockResolvedValue(false);
    vi.mocked(fs.writeFile).mockResolvedValue();

    await eslintFix.apply('/proj');

    const call = vi.mocked(execSync).mock.calls[0][0] as string;
    expect(call).toBe('npm install --save-dev eslint');
  });

  it('writes .eslintrc.json config file', async () => {
    vi.mocked(fileExists).mockResolvedValue(false);
    vi.mocked(fs.writeFile).mockResolvedValue();

    await eslintFix.apply('/proj');

    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.eslintrc.json'),
      expect.any(String),
      'utf-8',
    );
  });

  it('uses 60s timeout on execSync', async () => {
    vi.mocked(fileExists).mockResolvedValue(false);
    vi.mocked(fs.writeFile).mockResolvedValue();

    await eslintFix.apply('/proj');

    expect(execSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ timeout: 60_000 }),
    );
  });
});
