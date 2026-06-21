import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { computeSimulation } from '../../src/core/simulate.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-simulate-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      version: '1.0.0',
      type: 'module',
      scripts: { test: 'vitest run', typecheck: 'tsc --noEmit' },
      devDependencies: { vitest: '^3.0.0', typescript: '^5.0.0' },
    }),
  );
  await fs.writeFile(path.join(tmp, '.gitignore'), '.env\n.projscan-memory/\n');
  await fs.mkdir(path.join(tmp, 'src/core'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      "import { rankBugHuntFindings } from './bugHuntRanking.js';",
      '',
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return rankBugHuntFindings(findings).map((finding) => finding.toUpperCase());',
      '}',
      '',
    ].join('\n'),
  );
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHuntRanking.ts'),
    [
      'export function rankBugHuntFindings(findings: string[]): string[] {',
      '  return [...findings].sort();',
      '}',
      '',
    ].join('\n'),
  );
  await fs.mkdir(path.join(tmp, 'tests/core'), { recursive: true });
  await fs.mkdir(path.join(tmp, 'tests/cli'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, 'tests/core/bugHunt.test.ts'),
    [
      "import { buildBugHuntReport } from './bugHunt.js';",
      '',
      "test('builds report', () => {",
      "  expect(buildBugHuntReport(['b', 'a'])).toEqual(['A', 'B']);",
      '});',
      '',
    ].join('\n'),
  );
  await fs.writeFile(
    path.join(tmp, 'tests/core/unrelated.test.ts'),
    "test('unrelated', () => undefined);\n",
  );
  await fs.writeFile(
    path.join(tmp, 'tests/cli/releaseTrainBugHunt.test.ts'),
    "test('release train bug hunt integration', () => undefined);\n",
  );
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('predicts the safest rollout for a bounded split plan', async () => {
  const report = await computeSimulation(tmp, {
    plan: 'split bugHunt.ts into ranking, evidence, and output modules',
  });

  expect(report.schemaVersion).toBe(1);
  expect(report.plan).toBe('split bugHunt.ts into ranking, evidence, and output modules');
  expect(report.verdict).toBe('worth-doing');
  expect(report.confidence).toMatch(/high|medium/);
  expect(report.filesLikelyTouched[0]?.path).toBe('src/core/bugHunt.ts');
  expect(report.filesLikelyTouched[0]?.reasons.join(' ')).toContain('plan mentions bugHunt.ts');
  expect(report.testsLikelyAffected[0]).toBe('tests/core/bugHunt.test.ts');
  expect(report.testsLikelyAffected).toContain('tests/cli/releaseTrainBugHunt.test.ts');
  expect(report.testsLikelyAffected).not.toContain('tests/core/unrelated.test.ts');
  expect(report.contractsLikelyAffected).toContain('module boundary');
  expect(report.riskDelta.projectedScore).toBeGreaterThan(report.riskDelta.baselineScore);
  expect(report.rolloutPlan.map((step) => step.title)).toEqual([
    'Lock the current behavior',
    'Extract the smallest module boundary',
    'Wire callers through the existing public surface',
    'Run proof commands and compare risk',
  ]);
  expect(report.proofCommands).toContain('projscan simulate --plan "split bugHunt.ts into ranking, evidence, and output modules" --format json');
  expect(report.proofCommands).toContain('projscan file src/core/bugHunt.ts --format json');
});

test('returns low-confidence evidence instead of pretending a vague plan is precise', async () => {
  const report = await computeSimulation(tmp, { plan: 'make things cleaner' });

  expect(report.verdict).toBe('needs-more-evidence');
  expect(report.confidence).toBe('low');
  expect(report.filesLikelyTouched).toEqual([]);
  expect(report.warnings).toContain(
    'No repo files matched the plan. Mention a file, symbol, command, package, or module name for a stronger simulation.',
  );
  expect(report.proofCommands).toContain('projscan assess --mode fix-first --format json');
});
