import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import {
  computeQualityScorecard,
  deriveQualityScorecardVerdict,
} from '../../src/core/qualityScorecard.js';
import type { Issue } from '../../src/types/common.js';
import type { FileHotspot } from '../../src/types/hotspots.js';
import type { QualityScorecardDimension } from '../../src/types.js';

const hotspotState = vi.hoisted(() => ({
  hotspots: [] as FileHotspot[],
}));
const issueState = vi.hoisted(() => ({
  issues: [] as Issue[],
}));

vi.mock('../../src/core/hotspotAnalyzer.js', () => ({
  analyzeHotspots: vi.fn(async () => ({
    available: true,
    window: { since: null, commitsScanned: 0 },
    hotspots: hotspotState.hotspots,
    totalFilesRanked: hotspotState.hotspots.length,
  })),
}));

vi.mock('../../src/core/issueEngine.js', () => ({
  collectIssues: vi.fn(async () => issueState.issues),
}));

const tempRoots: string[] = [];

afterEach(async () => {
  hotspotState.hotspots = [];
  issueState.issues = [];
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('quality scorecard summarizes dimensions and verification commands', async () => {
  const root = await makeTempProject();
  issueState.issues = [
    issue({
      id: 'unsafe-eval',
      title: 'Unsafe eval',
      description: 'Avoid eval.',
      severity: 'error',
      category: 'security',
      locations: [{ file: 'src/danger.ts', line: 1 }],
    }),
  ];
  await fs.writeFile(path.join(root, 'src', 'danger.ts'), 'export const danger = true;\n');

  const report = await computeQualityScorecard(root, { maxRisks: 5 });

  expect(report.schemaVersion).toBe(1);
  expect(report.verdict).toMatch(/^(excellent|healthy|needs_attention|blocked)$/);
  expect(report.dimensions.map((dimension) => dimension.id)).toEqual(
    expect.arrayContaining(['health', 'security', 'tests', 'maintainability', 'coordination']),
  );
  expect(
    report.dimensions.every((dimension) => dimension.score >= 0 && dimension.score <= 100),
  ).toBe(true);
  expect(report.topRisks.length).toBeGreaterThan(0);
  expect(report.topRisks.length).toBeLessThanOrEqual(5);
  expect(report.commands).toEqual(
    expect.arrayContaining([
      'projscan doctor --format json',
      'projscan quality-scorecard --format json',
    ]),
  );
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

test('maintainability score keeps tiny issue-free hotspots as watch evidence', async () => {
  hotspotState.hotspots = [
    hotspot({ relativePath: 'src/types.ts', lineCount: 35, cyclomaticComplexity: 1 }),
    hotspot({ relativePath: 'tests/cli/start.test.ts', lineCount: 50, cyclomaticComplexity: 1 }),
  ];
  const root = await makeTempProject();

  const report = await computeQualityScorecard(root);
  const dimension = report.dimensions.find((item) => item.id === 'maintainability');

  expect(report.verdict).toBe('healthy');
  expect(dimension).toBeDefined();
  expect(dimension.status).toBe('watch');
  expect(dimension.score).toBe(100);
  expect(dimension.summary).toBe('0 maintainability issue(s), 2 hotspot(s)');
  expect(dimension.evidence).toEqual(
    expect.arrayContaining(['src/types.ts: risk 183', 'tests/cli/start.test.ts: risk 183']),
  );
});

test('maintainability score penalizes large or complex hotspots', async () => {
  hotspotState.hotspots = [
    hotspot({ relativePath: 'src/large.ts', lineCount: 450, cyclomaticComplexity: 1 }),
    hotspot({ relativePath: 'src/complex.ts', lineCount: 60, cyclomaticComplexity: 18 }),
  ];
  const root = await makeTempProject();

  const report = await computeQualityScorecard(root);
  const dimension = report.dimensions.find((item) => item.id === 'maintainability');

  expect(dimension).toBeDefined();
  expect(dimension.status).toBe('watch');
  expect(dimension.score).toBe(76);
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

function hotspot(overrides: Partial<FileHotspot>): FileHotspot {
  return {
    relativePath: 'src/file.ts',
    churn: 80,
    distinctAuthors: 1,
    daysSinceLastChange: 0,
    lineCount: 50,
    cyclomaticComplexity: 1,
    sizeBytes: 1000,
    issueCount: 0,
    issueIds: [],
    riskScore: 182.7,
    reasons: ['high churn'],
    primaryAuthor: 'dev@example.com',
    primaryAuthorShare: 1,
    busFactorOne: true,
    topAuthors: [{ author: 'dev@example.com', commits: 80, share: 1 }],
    coverage: null,
    ...overrides,
  };
}

function issue(overrides: Partial<Issue>): Issue {
  return {
    id: 'issue',
    title: 'Issue',
    description: 'Issue',
    severity: 'warning',
    category: 'maintainability',
    fixAvailable: false,
    ...overrides,
  };
}

async function makeTempProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-quality-scorecard-'));
  tempRoots.push(root);
  await fs.writeFile(
    path.join(root, 'package.json'),
    `${JSON.stringify({ name: 'fixture', version: '2.2.0', type: 'module' }, null, 2)}\n`,
  );
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}
