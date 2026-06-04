import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import { eslintFix } from '../../src/fixes/eslintFix.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('node:fs/promises');

vi.mock('../../src/utils/fileHelpers.js', () => ({
  fileExists: vi.fn(),
}));

import { execFileSync } from 'node:child_process';
import { fileExists } from '../../src/utils/fileHelpers.js';

describe('eslintFix', () => {
  beforeEach(() => vi.resetAllMocks());

  it('has correct metadata', () => {
    expect(eslintFix.id).toBe('add-eslint');
    expect(eslintFix.issueId).toBe('missing-eslint');
  });

  it('installs eslint with TypeScript plugins when tsconfig exists', async () => {
    vi.mocked(fileExists).mockResolvedValue(true);
    vi.mocked(fs.writeFile).mockResolvedValue();

    await eslintFix.apply('/proj');

    const args = vi.mocked(execFileSync).mock.calls[0][1] as string[];
    expect(args).toContain('@typescript-eslint/parser');
    expect(args).toContain('@typescript-eslint/eslint-plugin');
  });

  it('installs only eslint via execFile (no shell) when no tsconfig', async () => {
    vi.mocked(fileExists).mockResolvedValue(false);
    vi.mocked(fs.writeFile).mockResolvedValue();

    await eslintFix.apply('/proj');

    expect(execFileSync).toHaveBeenCalledWith(
      'npm',
      ['install', '--save-dev', '--ignore-scripts', 'eslint'],
      expect.objectContaining({ cwd: '/proj', timeout: 60_000 }),
    );
  });

  // Security regression guard (Finding 1): see testFix for the full rationale.
  // Package names are interpolated into the install args, so the no-shell
  // execFile form also removes any shell-metacharacter surface, and
  // --ignore-scripts blocks lifecycle-script RCE from a hostile scanned repo.
  it('always passes --ignore-scripts so a hostile repo cannot run lifecycle scripts', async () => {
    vi.mocked(fileExists).mockResolvedValue(false);
    vi.mocked(fs.writeFile).mockResolvedValue();

    await eslintFix.apply('/proj');

    const args = vi.mocked(execFileSync).mock.calls[0][1] as string[];
    expect(args).toContain('--ignore-scripts');
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

  it('uses 60s timeout on execFileSync', async () => {
    vi.mocked(fileExists).mockResolvedValue(false);
    vi.mocked(fs.writeFile).mockResolvedValue();

    await eslintFix.apply('/proj');

    expect(execFileSync).toHaveBeenCalledWith(
      'npm',
      expect.any(Array),
      expect.objectContaining({ timeout: 60_000 }),
    );
  });
});
