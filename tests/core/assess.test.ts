import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { computeAssess } from '../../src/core/assess.js';
import { computePreflight } from '../../src/core/preflight.js';
import type { BugHuntReport, PreflightReport, QualityScorecardReport } from '../../src/types.js';

const state = vi.hoisted(() => ({
  quality: undefined as QualityScorecardReport | undefined,
  bugHunt: undefined as BugHuntReport | undefined,
  preflight: undefined as PreflightReport | undefined,
}));

let tmp: string | undefined;

vi.mock('../../src/core/qualityScorecard.js', () => ({
  computeQualityScorecard: vi.fn(async () => state.quality),
}));

vi.mock('../../src/core/bugHunt.js', () => ({
  computeBugHunt: vi.fn(async () => state.bugHunt),
}));

vi.mock('../../src/core/preflight.js', () => ({
  computePreflight: vi.fn(async () => state.preflight),
}));

beforeEach(() => {
  state.quality = qualityReport();
  state.bugHunt = bugHuntReport();
  state.preflight = preflightReport('caution');
  vi.mocked(computePreflight).mockClear();
});

afterEach(async () => {
  if (tmp) await fs.rm(tmp, { recursive: true, force: true });
  tmp = undefined;
});

test('computeAssess answers the seven proof-first questions', async () => {
  const report = await computeAssess('/repo', {
    goal: 'make this repo safer to ship this week',
    maxCards: 4,
  });

  expect(report.schemaVersion).toBe(1);
  expect(report.goal).toBe('make this repo safer to ship this week');
  expect(report.mode).toBe('standard');
  expect(report.verdict).toBe('watch');
  expect(report.answers.actuallyRisky).toContain('Hardcoded secret');
  expect(report.answers.whyRisky).toContain('doctor');
  expect(report.answers.fixFirst).toContain('Hardcoded secret');
  expect(report.answers.safestChange).toContain('small');
  expect(report.answers.testsThatProveIt).toContain('projscan doctor --format json');
  expect(report.answers.riskRemoved).toContain('Projected risk score');
  expect(report.answers.shipNow).toContain('preflight');
  expect(report.proofCards.length).toBeGreaterThan(0);
  expect(report.proofCards[0]?.evidenceStrength.level).toBe('strong');
  expect(report.proofCards[0]?.confidenceReason).toContain('high confidence');
  expect(report.proofCards[0]?.ranking.reasons).toContain('priority p1');
  expect(report.proofCards[0]?.agentHandoff.constraints).toContain(
    'Do not release, publish, deploy, push, merge, tag, or bump versions from this packet.',
  );
  expect(report.commands).toContain('projscan assess --mode fix-first --format json');
});

test('computeAssess fix-first mode returns at most two proof cards', async () => {
  const report = await computeAssess('/repo', { mode: 'fix-first', maxCards: 8 });

  expect(report.mode).toBe('fix-first');
  expect(report.proofCards.length).toBeLessThanOrEqual(2);
  expect(report.fixFirst?.id).toBe(report.proofCards[0]?.id);
});

test('computeAssess blocks when preflight blocks', async () => {
  state.bugHunt = bugHuntReport({ preflightVerdict: 'block' });

  const report = await computeAssess('/repo', { mode: 'ship-readiness' });

  expect(report.verdict).toBe('blocked');
  expect(report.answers.shipNow).toContain('Do not ship');
});

test('computeAssess reuses bug-hunt preflight evidence instead of duplicate preflight', async () => {
  await computeAssess('/repo', { mode: 'fix-first' });

  expect(computePreflight).not.toHaveBeenCalled();
});

test('computeAssess applies optional local feedback memory without network access', async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-assess-memory-'));
  const feedbackPath = path.join(tmp, '.projscan-feedback.json');
  await fs.writeFile(
    feedbackPath,
    JSON.stringify({
      schemaVersion: 1,
      responses: [
        {
          useful: false,
          noisyFindings: ['hardcoded secret'],
          note: 'Hardcoded secret was a false positive in this repo.',
        },
      ],
    }),
  );

  const report = await computeAssess('/repo', { feedbackPath });

  expect(report.proofCards[0]?.finding).toBe('Hardcoded secret');
  expect(report.proofCards[0]?.trustMemory.status).toBe('noisy');
  expect(report.proofCards[0]?.confidence).toBe('low');
  expect(report.proofCards[0]?.evidenceGaps).toContain(
    'Reviewer feedback marked this signal noisy or false-positive.',
  );
});

test('computeAssess ignores a missing feedback memory file', async () => {
  const report = await computeAssess('/repo', { feedbackPath: '/does/not/exist.json' });

  expect(report.proofCards[0]?.trustMemory.status).toBe('none');
});

function qualityReport(): QualityScorecardReport {
  return {
    schemaVersion: 1,
    verdict: 'needs_attention',
    summary: 'needs_attention: health score 100/100 with 0 failing and 1 watch dimension(s)',
    health: {
      score: 100,
      grade: 'A',
      errors: 0,
      warnings: 0,
      infos: 0,
      scoreBreakdown: {
        baseScore: 100,
        finalScore: 100,
        grade: 'A',
        totalPenalty: 0,
        uncappedPenalty: 0,
        bySeverity: {
          error: { count: 0, weight: 20, penalty: 0 },
          warning: { count: 0, weight: 10, penalty: 0 },
          info: { count: 0, weight: 3, penalty: 0 },
        },
        byCategory: [],
      },
    },
    dimensions: [],
    topRisks: [
      {
        id: 'qs-hotspot-src-core-bughunt-ts',
        priority: 'p1',
        title: 'Hotspot src/core/bugHunt.ts',
        files: ['src/core/bugHunt.ts'],
        source: 'hotspot',
        command: 'projscan file src/core/bugHunt.ts --format json',
      },
    ],
    commands: ['projscan quality-scorecard --format json', 'projscan doctor --format json'],
    suggestedNextActions: [],
  };
}

function bugHuntReport(
  overrides: Partial<BugHuntReport['evidence']> = {},
): BugHuntReport {
  return {
    schemaVersion: 1,
    verdict: 'fix',
    summary: 'fix: bug hunt found 1 prioritized fix target(s)',
    health: qualityReport().health,
    evidence: {
      issueCounts: { errors: 0, warnings: 1, infos: 0 },
      hotspotCount: 1,
      preflightVerdict: 'caution',
      touchedFiles: [],
      conflicts: 0,
      ...overrides,
    },
    topSuspects: [],
    fixQueue: [
      {
        id: 'bh-issue-hardcoded-secret-src-auth-ts',
        priority: 'p1',
        source: 'doctor',
        title: 'Hardcoded secret',
        why: 'A high-confidence secret-like value is assigned in source.',
        files: ['src/auth.ts'],
        evidence: [{ source: 'doctor', severity: 'warning', message: 'Hardcoded secret' }],
        suggestedTools: ['projscan_explain_issue', 'projscan_fix_suggest'],
        verification: {
          commands: ['projscan doctor --format json', 'npm test'],
          expected: 'The finding no longer appears and tests pass.',
        },
      },
    ],
    reviewQueue: [],
    verificationMatrix: [
      {
        command: 'projscan doctor --format json',
        reason: 'Confirms the issue queue after fixes.',
        expected: 'The issue no longer appears.',
      },
    ],
  };
}

function preflightReport(verdict: PreflightReport['verdict']): PreflightReport {
  return {
    schemaVersion: 1,
    mode: 'before_commit',
    verdict,
    summary: `${verdict}: preflight summary`,
    reasons: [],
    evidence: {},
    suggestedActions: [],
    commands: ['projscan preflight --mode before_commit --format json'],
  };
}
