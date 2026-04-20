import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { analyzeHotspots } from '../../src/core/hotspotAnalyzer.js';
import type { FileEntry, Issue } from '../../src/types.js';

const execFileAsync = promisify(execFile);

async function setupRepo(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-issuelink-'));
  await execFileAsync('git', ['init', '-q', '--initial-branch=main'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.email', 't@t'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.name', 't'], { cwd: dir });
  await execFileAsync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
  return dir;
}

async function commitFile(dir: string, rel: string, content: string): Promise<FileEntry> {
  const abs = path.join(dir, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content);
  await execFileAsync('git', ['add', rel], { cwd: dir });
  await execFileAsync('git', ['commit', '-q', '-m', `add ${rel}`], { cwd: dir });
  const stat = await fs.stat(abs);
  return {
    relativePath: rel.split(path.sep).join('/'),
    absolutePath: abs,
    extension: path.extname(rel).toLowerCase(),
    sizeBytes: stat.size,
    directory: path.dirname(rel) || '.',
  };
}

describe('hotspot ↔ issue linking', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await setupRepo();
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('prefers issue.locations over substring matching', async () => {
    const files = [
      await commitFile(dir, 'src/a.ts', 'export const a = 1;'),
      await commitFile(dir, 'src/ab.ts', 'export const ab = 2;'),
    ];
    // Issue anchored to src/ab.ts via locations - its title still mentions "src/a.ts"
    // as a red herring (e.g., because of a nearby import path). The old substring
    // logic would falsely link it to src/a.ts. Locations should win.
    const issues: Issue[] = [
      {
        id: 'issue-1',
        title: 'problem in src/a.ts',
        description: 'touches src/a.ts too',
        severity: 'warning',
        category: 'test',
        fixAvailable: false,
        locations: [{ file: 'src/ab.ts' }],
      },
    ];
    const report = await analyzeHotspots(dir, files, issues, { limit: 10 });
    const ab = report.hotspots.find((h) => h.relativePath === 'src/ab.ts');
    const a = report.hotspots.find((h) => h.relativePath === 'src/a.ts');
    expect(ab?.issueIds ?? []).toContain('issue-1');
    expect(a?.issueIds ?? []).not.toContain('issue-1');
  });

  it('does not false-match when file path is a substring of another in the haystack', async () => {
    const files = [
      await commitFile(dir, 'src/a.ts', 'export const a = 1;'),
      await commitFile(dir, 'src/ab.ts', 'export const ab = 2;'),
    ];
    // No locations - substring fallback kicks in. We mention "src/ab.ts" in
    // the description; the boundary guard must prevent "src/a.ts" from matching.
    const issues: Issue[] = [
      {
        id: 'issue-x',
        title: 'problem',
        description: 'see: src/ab.ts for details',
        severity: 'warning',
        category: 'test',
        fixAvailable: false,
      },
    ];
    const report = await analyzeHotspots(dir, files, issues, { limit: 10 });
    const a = report.hotspots.find((h) => h.relativePath === 'src/a.ts');
    expect(a?.issueIds ?? []).not.toContain('issue-x');
  });
});
