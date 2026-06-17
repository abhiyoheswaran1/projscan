import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { computePreflight } from '../../src/core/preflight.js';

const tempRoots: string[] = [];
const execFileAsync = promisify(execFile);

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('preflight surfaces swarm-coordination evidence and a caution (not block) across worktrees', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-preflight-coord-'));
  tempRoots.push(root);
  const sibling = `${root}-wt`;
  tempRoots.push(sibling);
  await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  await execFileAsync('git', ['config', 'user.email', 't@t.t'], { cwd: root });
  await execFileAsync('git', ['config', 'user.name', 't'], { cwd: root });
  await writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '0.0.0',
    type: 'module',
  });
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'a.ts'), 'export const a = 1;\n');
  await execFileAsync('git', ['add', '.'], { cwd: root });
  await execFileAsync('git', ['commit', '-qm', 'base'], { cwd: root });
  await execFileAsync('git', ['worktree', 'add', '-q', '-b', 'agent-b', sibling], { cwd: root });
  // Same-file collision: both worktrees change src/a.ts.
  await fs.writeFile(path.join(root, 'src', 'a.ts'), 'export const a = 2;\n');
  await fs.writeFile(path.join(sibling, 'src', 'a.ts'), 'export const a = 3;\n');
  await execFileAsync('git', ['commit', '-qam', 'b'], { cwd: sibling });

  const report = await computePreflight(root, { mode: 'before_commit' });

  expect(report.evidence.coordination?.available).toBe(true);
  expect(report.evidence.coordination?.readiness).toBe('conflicted');
  expect(report.evidence.coordination?.collisions.high).toBeGreaterThanOrEqual(1);
  const coordReason = report.reasons.find((r) => r.source === 'coordination');
  expect(coordReason).toBeDefined();
  // Advisory only - coordination contributes a warning (caution), never an error/block.
  expect(coordReason?.severity).toBe('warning');

  await execFileAsync('git', ['worktree', 'remove', '--force', sibling], { cwd: root }).catch(
    () => {},
  );
});

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
