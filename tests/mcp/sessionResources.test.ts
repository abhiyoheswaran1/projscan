import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { loadSession, recordTouch, saveSession } from '../../src/core/session.js';
import { getResourceDefinitions, readResource } from '../../src/mcp/resources.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-session-resources-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }),
  );
  await fs.writeFile(path.join(tmp, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'a.ts'), "import { b } from './b';\nexport const a = b;\n");
  await fs.writeFile(path.join(tmp, 'src', 'b.ts'), 'export const b = 1;\n');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('lists agent coordination resources', () => {
  const uris = getResourceDefinitions().map((resource) => resource.uri);

  expect(uris).toContain('projscan://session/summary');
  expect(uris).toContain('projscan://handoff');
  expect(uris).toContain('projscan://risk-now');
});

test('risk-now returns JSON-compatible conflict data from touched files', async () => {
  await touchFiles('src/a.ts', 'src/b.ts');

  const resource = await readResource('projscan://risk-now', tmp);
  const payload = JSON.parse(resource.text);

  expect(resource.mimeType).toBe('application/json');
  expect(payload.schemaVersion).toBe(1);
  expect([...payload.touchedFiles].sort()).toEqual(['src/a.ts', 'src/b.ts']);
  expect(Array.isArray(payload.conflicts)).toBe(true);
  expect(payload.coordinationHints.map((hint: { id: string }) => hint.id)).toEqual(
    expect.arrayContaining(['remembered-session-context', 'resolve-conflicts']),
  );
  expect(payload.coordinationHints.map((hint: { command?: string }) => hint.command)).toContain('projscan session touched --format json');
  const sameWorkspace = payload.conflicts.find(
    (conflict: { kind?: string }) => conflict.kind === 'same-workspace',
  );
  expect(sameWorkspace).toBeDefined();
  expect([...sameWorkspace.files].sort()).toEqual(['src/a.ts', 'src/b.ts']);
});

test('handoff includes summary, remaining risks, and next actions', async () => {
  await touchFiles('src/a.ts', 'src/b.ts');

  const resource = await readResource('projscan://handoff', tmp);
  const payload = JSON.parse(resource.text);

  expect(payload.schemaVersion).toBe(1);
  expect(payload.summary.sessionId).toMatch(/^[0-9a-f-]{36}$/);
  expect(payload.remainingRisks.length).toBeGreaterThan(0);
  expect(payload.coordinationHints.map((hint: { id: string }) => hint.id)).toContain('current-worktree-check');
  expect(payload.suggestedNextActions).toEqual(
    expect.arrayContaining([expect.objectContaining({ tool: 'projscan_preflight' })]),
  );
});

test('session summary truncates large touched-file lists', async () => {
  const files = Array.from({ length: 75 }, (_, index) => `src/file-${index}.ts`);
  await touchFiles(...files);

  const resource = await readResource('projscan://session/summary', tmp);
  const payload = JSON.parse(resource.text);

  expect(payload.schemaVersion).toBe(1);
  expect(payload.touchedFiles.length).toBeLessThanOrEqual(50);
  expect(payload.truncated).toBe(true);
});

async function touchFiles(...files: string[]): Promise<void> {
  const { session } = await loadSession(tmp);
  for (const file of files) {
    recordTouch(session, file, 'explicit');
  }
  await saveSession(tmp, session);
}
