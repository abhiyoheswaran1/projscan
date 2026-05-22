import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { computeQualityScorecard, deriveQualityScorecardVerdict } from '../../src/core/qualityScorecard.js';
import type { QualityScorecardDimension } from '../../src/types.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('quality scorecard summarizes dimensions and verification commands', async () => {
  const root = await makeTempProject();
  await fs.writeFile(path.join(root, 'src', 'danger.ts'), 'eval("console.log(1)");\n');

  const report = await computeQualityScorecard(root, { maxRisks: 5 });

  expect(report.schemaVersion).toBe(1);
  expect(report.verdict).toMatch(/^(excellent|healthy|needs_attention|blocked)$/);
  expect(report.dimensions.map((dimension) => dimension.id)).toEqual(
    expect.arrayContaining(['health', 'security', 'tests', 'maintainability', 'coordination']),
  );
  expect(report.dimensions.every((dimension) => dimension.score >= 0 && dimension.score <= 100)).toBe(true);
  expect(report.topRisks.length).toBeGreaterThan(0);
  expect(report.topRisks.length).toBeLessThanOrEqual(5);
  expect(report.commands).toEqual(expect.arrayContaining(['projscan doctor --format json', 'projscan quality-scorecard --format json']));
});

test('quality scorecard verdict needs attention for low-scoring watch dimensions', () => {
  const dimensions: QualityScorecardDimension[] = [
    dimension('health', 'Project health', 'pass', 100),
    dimension('security', 'Security posture', 'pass', 100),
    dimension('tests', 'Test readiness', 'pass', 100),
    dimension('maintainability', 'Maintainability', 'watch', 4),
    dimension('coordination', 'Coordination', 'watch', 50),
  ];

  expect(deriveQualityScorecardVerdict(dimensions, 100)).toBe('needs_attention');
});

function dimension(
  id: QualityScorecardDimension['id'],
  label: string,
  status: QualityScorecardDimension['status'],
  score: number,
): QualityScorecardDimension {
  return {
    id,
    label,
    status,
    score,
    summary: '',
    evidence: [],
    commands: [],
  };
}

async function makeTempProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-quality-scorecard-'));
  tempRoots.push(root);
  await fs.writeFile(path.join(root, 'package.json'), `${JSON.stringify({ name: 'fixture', version: '2.2.0', type: 'module' }, null, 2)}\n`);
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}
