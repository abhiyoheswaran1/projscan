import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { explainIssue } from '../../src/core/explainIssue.js';
import type { Issue } from '../../src/types.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-explain-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const full = path.join(tmp, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf-8');
}

function issue(partial: Partial<Issue>): Issue {
  return {
    id: 'unknown',
    title: 'Unknown',
    description: 'desc',
    severity: 'warning',
    category: 'general',
    fixAvailable: false,
    ...partial,
  };
}

describe('explainIssue', () => {
  it('returns null for unknown issue id', async () => {
    const r = await explainIssue(tmp, [], 'no-such-id');
    expect(r).toBeNull();
  });

  it('captures the surrounding code excerpt', async () => {
    await write(
      'src/big.ts',
      ['line 1', 'line 2', 'line 3', 'line 4 - target', 'line 5', 'line 6', 'line 7'].join('\n'),
    );
    const r = await explainIssue(
      tmp,
      [issue({ id: 'cycle-detected-1', locations: [{ file: 'src/big.ts', line: 4 }] })],
      'cycle-detected-1',
    );
    expect(r).not.toBeNull();
    expect(r!.excerpt).not.toBeNull();
    expect(r!.excerpt!.startLine).toBe(1);
    expect(r!.excerpt!.endLine).toBe(7);
    expect(r!.excerpt!.lines).toContain('line 4 - target');
  });

  it('lists other issues touching the same file as related', async () => {
    await write('src/x.ts', `export const a = 1;`);
    const issues: Issue[] = [
      issue({ id: 'cycle-detected-1', locations: [{ file: 'src/x.ts', line: 1 }] }),
      issue({ id: 'dead-code', title: 'Dead export', locations: [{ file: 'src/x.ts' }] }),
      issue({ id: 'unrelated', locations: [{ file: 'src/y.ts' }] }),
    ];
    const r = await explainIssue(tmp, issues, 'cycle-detected-1');
    expect(r!.relatedIssues.map((x) => x.id)).toContain('dead-code');
    expect(r!.relatedIssues.map((x) => x.id)).not.toContain('unrelated');
  });

  it('returns the headline + structured fix', async () => {
    await write('src/x.ts', `export const a = 1;`);
    const r = await explainIssue(
      tmp,
      [issue({ id: 'unused-dependency-axios', title: 'Unused dependency: axios' })],
      'unused-dependency-axios',
    );
    expect(r!.fix).not.toBeNull();
    expect(r!.fix!.headline).toContain('axios');
    expect(r!.headline).toMatch(/axios|wire/i);
  });

  it('returns empty similarFixes when not in a git repo', async () => {
    await write('src/x.ts', `export const a = 1;`);
    const r = await explainIssue(
      tmp,
      [issue({ id: 'cycle-detected-1', locations: [{ file: 'src/x.ts' }] })],
      'cycle-detected-1',
    );
    expect(r!.similarFixes).toEqual([]);
  });
});
