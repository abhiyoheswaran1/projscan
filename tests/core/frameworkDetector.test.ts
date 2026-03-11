import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectFrameworks } from '../../src/core/frameworkDetector.js';
import type { FileEntry } from '../../src/types.js';
import fs from 'node:fs/promises';

vi.mock('node:fs/promises');

function makeFile(relativePath: string): FileEntry {
  const ext = relativePath.includes('.') ? relativePath.substring(relativePath.lastIndexOf('.')) : '';
  const dir = relativePath.includes('/') ? relativePath.substring(0, relativePath.lastIndexOf('/')) : '.';
  return {
    relativePath,
    absolutePath: `/root/project/${relativePath}`,
    extension: ext,
    sizeBytes: 100,
    directory: dir,
  };
}

describe('detectFrameworks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should detect React from package.json', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
      }),
    );

    const files = [makeFile('package.json'), makeFile('src/App.tsx')];
    const result = await detectFrameworks('/root/project', files);

    expect(result.frameworks.some((f) => f.name === 'React')).toBe(true);
    const react = result.frameworks.find((f) => f.name === 'React');
    expect(react?.category).toBe('frontend');
    expect(react?.confidence).toBe('high');
  });

  it('should detect Next.js from both dependency and config', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        dependencies: { next: '^14.0.0', react: '^18.0.0' },
      }),
    );

    const files = [
      makeFile('package.json'),
      makeFile('next.config.js'),
      makeFile('src/app/page.tsx'),
    ];
    const result = await detectFrameworks('/root/project', files);

    expect(result.frameworks.some((f) => f.name === 'Next.js')).toBe(true);
  });

  it('should detect package manager from lockfile', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({}));

    const files = [makeFile('package.json'), makeFile('yarn.lock')];
    const result = await detectFrameworks('/root/project', files);

    expect(result.packageManager).toBe('yarn');
  });

  it('should detect pnpm from lockfile', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({}));

    const files = [makeFile('package.json'), makeFile('pnpm-lock.yaml')];
    const result = await detectFrameworks('/root/project', files);

    expect(result.packageManager).toBe('pnpm');
  });

  it('should return empty frameworks for unknown project', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

    const files = [makeFile('main.py')];
    const result = await detectFrameworks('/root/project', files);

    expect(result.frameworks.length).toBe(0);
    expect(result.packageManager).toBe('unknown');
  });

  it('should detect build tools from config files', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({}));

    const files = [
      makeFile('package.json'),
      makeFile('tsconfig.json'),
      makeFile('Dockerfile'),
    ];
    const result = await detectFrameworks('/root/project', files);

    expect(result.buildTools).toContain('TypeScript');
    expect(result.buildTools).toContain('Docker');
  });

  it('should detect Express as backend framework', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        dependencies: { express: '^4.18.0' },
      }),
    );

    const files = [makeFile('package.json'), makeFile('src/server.ts')];
    const result = await detectFrameworks('/root/project', files);

    const express = result.frameworks.find((f) => f.name === 'Express');
    expect(express).toBeDefined();
    expect(express?.category).toBe('backend');
  });
});
