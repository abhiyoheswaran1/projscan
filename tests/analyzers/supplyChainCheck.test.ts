import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { check } from '../../src/analyzers/supplyChainCheck.js';
import type { FileEntry } from '../../src/types.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('flags git ssh and GitHub shorthand dependencies pinned to commits', async () => {
  const root = await makeTempProject();
  await writeJson(root, 'package.json', {
    name: 'fixture',
    dependencies: {
      'runtime-policy': 'github:example/runtime-policy#2e5f6c7d8a9b0c1d2e3f4a5b6c7d8e9f00112233',
    },
    devDependencies: {
      'build-policy': 'https://github.com/example/build-policy.git#2e5f6c7d8a9b0c1d2e3f4a5b6c7d8e9f00112233',
    },
    optionalDependencies: {
      'ssh-policy': 'git+ssh://git@github.com/example/team-policy.git#2e5f6c7d8a9b0c1d2e3f4a5b6c7d8e9f00112233',
      'shorthand-policy': 'example/team-policy#2e5f6c7d8a9b0c1d2e3f4a5b6c7d8e9f00112233',
    },
  });

  const issues = await check(root, [await fileEntry(root, 'package.json')]);

  expect(issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'supply-chain-git-dependency-runtime-policy',
        severity: 'warning',
      }),
      expect.objectContaining({
        id: 'supply-chain-git-dependency-build-policy',
        severity: 'warning',
      }),
      expect.objectContaining({
        id: 'supply-chain-git-dependency-ssh-policy',
        severity: 'warning',
      }),
      expect.objectContaining({
        id: 'supply-chain-git-dependency-shorthand-policy',
        severity: 'warning',
      }),
    ]),
  );
});

test('flags lockfile package entries whose resolved URL matches a known IOC', async () => {
  const root = await makeTempProject();
  await writeJson(root, 'package-lock.json', {
    name: 'fixture',
    lockfileVersion: 3,
    packages: {
      '': { name: 'fixture', version: '0.0.0' },
      'node_modules/@tanstack/setup': {
        version: '1.0.0',
        resolved: 'https://git-tanstack.com/@tanstack/setup/-/setup-1.0.0.tgz',
      },
    },
  });

  const issues = await check(root, [await fileEntry(root, 'package-lock.json')]);

  expect(issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'supply-chain-known-ioc-tanstack-setup',
        severity: 'error',
      }),
    ]),
  );
});

test('scans package-lock files larger than 2MB', async () => {
  const root = await makeTempProject();
  const lockfile = {
    name: 'fixture',
    lockfileVersion: 3,
    padding: 'x'.repeat(2 * 1024 * 1024 + 1024),
    packages: {
      '': { name: 'fixture', version: '0.0.0' },
      'node_modules/@tanstack/react-router': {
        version: '1.169.5',
      },
    },
  };
  await writeJson(root, 'package-lock.json', lockfile);

  const issues = await check(root, [await fileEntry(root, 'package-lock.json')]);

  expect(issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'supply-chain-malicious-package-@tanstack/react-router',
        severity: 'error',
      }),
    ]),
  );
});

test('flags prepare scripts that execute packages directly while allowing npm build delegation', async () => {
  const root = await makeTempProject();
  await writeJson(root, 'package.json', {
    name: 'fixture',
    scripts: {
      prepare: 'npx team-bootstrap',
      prepack: 'npm run build',
    },
  });

  const issues = await check(root, [await fileEntry(root, 'package.json')]);

  expect(issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'supply-chain-lifecycle-prepare',
        severity: 'warning',
      }),
    ]),
  );
  expect(issues.some((issue) => issue.id === 'supply-chain-lifecycle-prepack')).toBe(false);
});

async function makeTempProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-supply-chain-'));
  tempRoots.push(root);
  return root;
}

async function writeJson(root: string, relativePath: string, value: unknown): Promise<void> {
  const filePath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function fileEntry(root: string, relativePath: string): Promise<FileEntry> {
  const absolutePath = path.join(root, relativePath);
  const stat = await fs.stat(absolutePath);
  return {
    relativePath,
    absolutePath,
    extension: path.extname(relativePath),
    sizeBytes: stat.size,
    directory: path.dirname(relativePath),
  };
}
