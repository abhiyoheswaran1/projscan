import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { computeAgentBrief } from '../../src/core/agentBrief.js';
import { loadSession, recordTouch, saveSession } from '../../src/core/session.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('agent brief returns compact next-agent context without mutating package version', async () => {
  const root = await makeTempProject('2.2.0');
  await fs.writeFile(path.join(root, 'src', 'danger.ts'), 'eval("console.log(1)");\n');

  const { session } = await loadSession(root);
  recordTouch(session, 'src/index.ts', 'explicit');
  await saveSession(root, session);

  const report = await computeAgentBrief(root, { intent: 'bug_hunt', maxItems: 4 });

  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8')) as { version: string };
  expect(pkg.version).toBe('2.2.0');
  expect(report.schemaVersion).toBe(1);
  expect(report.intent).toBe('bug_hunt');
  expect(report.summary).toContain('agent brief');
  expect(report.focus.length).toBeGreaterThan(0);
  expect(report.focus.length).toBeLessThanOrEqual(4);
  expect(report.guardrails.map((guardrail) => guardrail.command)).toEqual(
    expect.arrayContaining(['projscan doctor --format json', 'projscan preflight --mode before_edit --format json']),
  );
  expect(report.context.totalFiles).toBeGreaterThan(0);
  expect(report.context.coordinationHints.map((hint) => hint.id)).toContain('remembered-session-context');
  expect(report.context.coordinationHints.map((hint) => hint.command)).toContain('projscan session touched --format json');
  expect(report.context.graph).toEqual(
    expect.objectContaining({
      schemaVersion: 1,
      totalFunctions: expect.any(Number),
      totalCallEdges: expect.any(Number),
      dataflowRisks: expect.any(Number),
    }),
  );
  expect(report.suggestedNextActions.length).toBeGreaterThan(0);
});

async function makeTempProject(version: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-agent-brief-'));
  tempRoots.push(root);
  await fs.writeFile(path.join(root, 'package.json'), `${JSON.stringify({ name: 'fixture', version, type: 'module' }, null, 2)}\n`);
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}
