import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { findDependencyLines } from '../../src/utils/packageJsonLocator.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-pkgjson-'));
}

describe('findDependencyLines', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns null when package.json is missing', async () => {
    const result = await findDependencyLines(tmp);
    expect(result).toBeNull();
  });

  it('finds the line of each dependency in every section', async () => {
    const pkg = [
      '{',
      '  "name": "example",',
      '  "dependencies": {',
      '    "chalk": "^5.0.0",',
      '    "commander": "^12.0.0"',
      '  },',
      '  "devDependencies": {',
      '    "vitest": "^2.0.0",',
      '    "typescript": "^5.6.0"',
      '  }',
      '}',
      '',
    ].join('\n');
    await fs.writeFile(path.join(tmp, 'package.json'), pkg);

    const result = await findDependencyLines(tmp);
    expect(result).not.toBeNull();
    expect(result!.lineOfDependency.get('chalk')).toBe(4);
    expect(result!.lineOfDependency.get('commander')).toBe(5);
    expect(result!.lineOfDependency.get('vitest')).toBe(8);
    expect(result!.lineOfDependency.get('typescript')).toBe(9);
  });

  it('handles absence of sections', async () => {
    await fs.writeFile(path.join(tmp, 'package.json'), '{ "name": "x" }');
    const result = await findDependencyLines(tmp);
    expect(result).not.toBeNull();
    expect(result!.lineOfDependency.size).toBe(0);
  });
});
