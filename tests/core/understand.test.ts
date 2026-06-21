import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { computeUnderstandReport } from '../../src/core/understand.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('map view explains the repo with cited claims and read-first files', async () => {
  const root = await makeUnderstandFixture();

  const report = await computeUnderstandReport(root, { view: 'map', maxItems: 6 });

  expect(report.schemaVersion).toBe(1);
  expect(report.view).toBe('map');
  expect(report.summary).toContain('repo map');
  expect(report.entrypoints.map((entry) => entry.file)).toEqual(
    expect.arrayContaining(['src/server.ts', 'src/cli.ts']),
  );
  expect(report.boundaries.map((boundary) => boundary.name)).toContain('src');
  expect(report.readFirst.length).toBeGreaterThan(0);
  expect(report.claims.length).toBeGreaterThan(0);
  expect(report.claims.every((claim) => claim.citations.length > 0)).toBe(true);
  expect(report.commands).toContain('projscan understand --view map --format json');
});

test('flow view describes runtime paths and side-effect sinks', async () => {
  const root = await makeUnderstandFixture();

  const report = await computeUnderstandReport(root, { view: 'flow', maxItems: 8 });

  expect(report.view).toBe('flow');
  expect(report.flows.length).toBeGreaterThan(0);
  expect(report.flows.map((flow) => flow.entry.file)).toContain('src/server.ts');
  expect(report.flows.flatMap((flow) => flow.sideEffects.map((effect) => effect.kind))).toContain(
    'database',
  );
  expect(report.claims.some((claim) => claim.id === 'flow-runtime-paths')).toBe(true);
});

test('flow view follows tsconfig alias imports in runtime paths', async () => {
  const root = await makeUnderstandFixture();
  await fs.writeFile(
    path.join(root, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@app/*': ['src/*'] } } }),
  );
  await fs.writeFile(
    path.join(root, 'src', 'server.ts'),
    [
      'import { loadConfig } from "@app/config";',
      'import { query } from "@app/db";',
      '',
      'export function createApp() {',
      '  return {',
      '    async handle(req: { body: { id: string } }) {',
      '      const config = loadConfig();',
      '      await query(`select ${req.body.id} ${config.token}`);',
      '    },',
      '  };',
      '}',
      '',
    ].join('\n'),
  );

  const report = await computeUnderstandReport(root, { view: 'flow', maxItems: 8 });
  const serverFlow = report.flows.find((flow) => flow.entry.file === 'src/server.ts');

  expect(serverFlow?.path).toEqual(expect.arrayContaining(['src/config.ts', 'src/db.ts']));
});

test('contracts view lists public exports config contracts and breaking risks', async () => {
  const root = await makeUnderstandFixture();

  const report = await computeUnderstandReport(root, { view: 'contracts', maxItems: 8 });

  expect(report.view).toBe('contracts');
  expect(report.contracts.publicExports.map((entry) => entry.name)).toEqual(
    expect.arrayContaining(['createApp', 'loadConfig']),
  );
  expect(report.contracts.configContracts.map((entry) => entry.name)).toContain('API_KEY');
  expect(report.contracts.breakingChangeRisks.length).toBeGreaterThan(0);
  expect(report.commands).toContain('projscan understand --view contracts --format json');
});

test('change view ties intent to blast radius safe edit verification and rollback', async () => {
  const root = await makeUnderstandFixture();

  const report = await computeUnderstandReport(root, {
    view: 'change',
    intent: 'rename the auth token loader',
    changedFiles: ['src/config.ts'],
    maxItems: 8,
  });

  expect(report.view).toBe('change');
  expect(report.intent).toBe('rename the auth token loader');
  expect(report.changeReadiness.intent).toContain('auth token');
  expect(
    report.changeReadiness.blastRadius.some((item) => item.files.includes('src/server.ts')),
  ).toBe(true);
  expect(report.changeReadiness.safeEdit.command).toContain(
    'projscan file src/config.ts --format json',
  );
  expect(report.changeReadiness.rollback.command).toContain('git restore');
  expect(report.changeReadiness.verificationCommands).toContain(
    'projscan understand --view verify --format json',
  );
});

test('change view emits shell-safe file commands', async () => {
  const root = await makeUnderstandFixture();

  const report = await computeUnderstandReport(root, {
    view: 'change',
    changedFiles: ['src/app route/$(touch pwn).ts'],
    maxItems: 8,
  });

  expect(report.changeReadiness.safeEdit.command).toBe(
    'projscan file "src/app route/\\$(touch pwn).ts" --format json',
  );
});

test('verify view returns minimal focused and full proof tiers with direct-test gaps', async () => {
  const root = await makeUnderstandFixture();

  const report = await computeUnderstandReport(root, {
    view: 'verify',
    changedFiles: ['src/server.ts'],
    maxItems: 8,
  });

  expect(report.view).toBe('verify');
  expect(report.verification.tiers.map((tier) => tier.id)).toEqual(['minimal', 'focused', 'full']);
  expect(report.verification.tiers[0]?.commands).toContain(
    'projscan preflight --mode before_edit --format json',
  );
  expect(report.verification.directTests.some((entry) => entry.file === 'src/server.ts')).toBe(
    true,
  );
  expect(report.verification.gaps.length).toBeGreaterThan(0);
});

test('verify view does not match every test for directory-like changed paths', async () => {
  const root = await makeUnderstandFixture();

  const report = await computeUnderstandReport(root, {
    view: 'verify',
    changedFiles: ['.agentflight/'],
    maxItems: 8,
  });

  expect(report.verification.directTests).toContainEqual({
    file: '.agentflight/',
    tests: [],
    confidence: 'none',
  });
  expect(report.verification.gaps.map((gap) => gap.file)).toContain('.agentflight/');
});

test('verify view keeps direct-test matches for normal source filenames', async () => {
  const root = await makeUnderstandFixture();

  const report = await computeUnderstandReport(root, {
    view: 'verify',
    changedFiles: ['src/config.ts'],
    maxItems: 8,
  });

  expect(report.verification.directTests).toContainEqual({
    file: 'src/config.ts',
    tests: ['tests/config.test.ts'],
    confidence: 'medium',
  });
});

test('verify view recognizes graph-based test coverage through importer tests', async () => {
  const root = await makeUnderstandFixture();
  await fs.writeFile(
    path.join(root, 'src', 'preflightEvidence.ts'),
    ['export function buildEvidence() {', '  return { ready: true };', '}', ''].join('\n'),
  );
  await fs.writeFile(
    path.join(root, 'src', 'preflight.ts'),
    [
      'import { buildEvidence } from "./preflightEvidence";',
      '',
      'export function runPreflight() {',
      '  return buildEvidence();',
      '}',
      '',
    ].join('\n'),
  );
  await fs.writeFile(
    path.join(root, 'tests', 'preflight.test.ts'),
    [
      'import { runPreflight } from "../src/preflight";',
      '',
      'test("runs preflight", () => {',
      '  expect(runPreflight().ready).toBe(true);',
      '});',
      '',
    ].join('\n'),
  );

  const report = await computeUnderstandReport(root, {
    view: 'verify',
    changedFiles: ['src/preflightEvidence.ts'],
    maxItems: 8,
  });

  expect(report.verification.directTests).toContainEqual({
    file: 'src/preflightEvidence.ts',
    tests: ['tests/preflight.test.ts'],
    confidence: 'low',
  });
  expect(report.verification.gaps.map((gap) => gap.file)).not.toContain(
    'src/preflightEvidence.ts',
  );
});

async function makeUnderstandFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-understand-'));
  tempRoots.push(root);
  await fs.writeFile(
    path.join(root, 'package.json'),
    `${JSON.stringify({ name: 'understand-fixture', version: '0.0.0', type: 'module', exports: './src/server.ts' }, null, 2)}\n`,
  );
  await fs.writeFile(path.join(root, 'README.md'), '# understand fixture\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.mkdir(path.join(root, 'tests'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'src', 'config.ts'),
    [
      'export function loadConfig() {',
      '  return { token: process.env.API_KEY ?? "dev-token" };',
      '}',
      '',
    ].join('\n'),
  );
  await fs.writeFile(
    path.join(root, 'src', 'db.ts'),
    ['export async function query(sql: string) {', '  return sql;', '}', ''].join('\n'),
  );
  await fs.writeFile(
    path.join(root, 'src', 'server.ts'),
    [
      'import { loadConfig } from "./config";',
      'import { query } from "./db";',
      '',
      'export function createApp() {',
      '  return {',
      '    async handle(req: { body: { id: string } }) {',
      '      const config = loadConfig();',
      '      await query(`select ${req.body.id} ${config.token}`);',
      '    },',
      '  };',
      '}',
      '',
    ].join('\n'),
  );
  await fs.writeFile(
    path.join(root, 'src', 'cli.ts'),
    ['import { createApp } from "./server";', '', 'createApp();', ''].join('\n'),
  );
  await fs.writeFile(
    path.join(root, 'tests', 'config.test.ts'),
    [
      'import { loadConfig } from "../src/config";',
      '',
      'test("loads config", () => {',
      '  expect(loadConfig()).toBeDefined();',
      '});',
      '',
    ].join('\n'),
  );
  return root;
}
