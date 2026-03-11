import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import { testFix } from '../../src/fixes/testFix.js';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:fs/promises');

vi.mock('../../src/utils/fileHelpers.js', () => ({
  fileExists: vi.fn(),
}));

import { execSync } from 'node:child_process';
import { fileExists } from '../../src/utils/fileHelpers.js';

describe('testFix', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('has correct metadata', () => {
    expect(testFix.id).toBe('add-tests');
    expect(testFix.issueId).toBe('missing-test-framework');
  });

  it('installs vitest with 60s timeout', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ scripts: {} }));
    vi.mocked(fs.writeFile).mockResolvedValue();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fileExists).mockResolvedValue(false);

    await testFix.apply('/proj');

    expect(execSync).toHaveBeenCalledWith(
      'npm install --save-dev vitest',
      expect.objectContaining({ timeout: 60_000 }),
    );
  });

  it('adds test scripts to package.json', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ scripts: {} }));
    vi.mocked(fs.writeFile).mockResolvedValue();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fileExists).mockResolvedValue(false);

    await testFix.apply('/proj');

    const pkgWrite = vi.mocked(fs.writeFile).mock.calls[0];
    const pkg = JSON.parse(pkgWrite[1] as string);
    expect(pkg.scripts.test).toBe('vitest run');
    expect(pkg.scripts['test:watch']).toBe('vitest');
  });

  it('creates sample test with .ts extension when tsconfig exists', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ scripts: {} }));
    vi.mocked(fs.writeFile).mockResolvedValue();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    // First call: tsconfig check → true, Second call: test file exists → false
    vi.mocked(fileExists).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await testFix.apply('/proj');

    const lastWrite = vi.mocked(fs.writeFile).mock.calls.at(-1)!;
    expect(lastWrite[0]).toContain('example.test.ts');
  });

  it('creates sample test with .js extension when no tsconfig', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ scripts: {} }));
    vi.mocked(fs.writeFile).mockResolvedValue();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fileExists).mockResolvedValue(false);

    await testFix.apply('/proj');

    const lastWrite = vi.mocked(fs.writeFile).mock.calls.at(-1)!;
    expect(lastWrite[0]).toContain('example.test.js');
  });

  it('does not overwrite existing test file', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ scripts: {} }));
    vi.mocked(fs.writeFile).mockResolvedValue();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    // tsconfig: false, test file exists: true
    vi.mocked(fileExists).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await testFix.apply('/proj');

    // Only one writeFile call (package.json), no test file written
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
  });

  it('silently skips if no package.json (ENOENT)', async () => {
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    vi.mocked(fs.readFile).mockRejectedValue(err);
    vi.mocked(fs.writeFile).mockResolvedValue();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fileExists).mockResolvedValue(false);

    await expect(testFix.apply('/proj')).resolves.toBeUndefined();
  });
});
