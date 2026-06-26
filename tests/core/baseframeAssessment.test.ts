import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createBaseframeAssessment } from '../../src/core/baseframeAssessment.js';
import type { AssessReport } from '../../src/types/assess.js';
import type { FrameworkResult, LanguageBreakdown, ScanResult } from '../../src/types.js';

const state = vi.hoisted(() => ({
  assess: undefined as AssessReport | undefined,
  scan: undefined as ScanResult | undefined,
  languages: undefined as LanguageBreakdown | undefined,
  frameworks: undefined as FrameworkResult | undefined,
}));

vi.mock('../../src/core/assess.js', () => ({
  computeAssess: vi.fn(async () => state.assess),
}));

vi.mock('../../src/core/repositoryScanner.js', () => ({
  scanRepository: vi.fn(async () => state.scan),
}));

vi.mock('../../src/core/languageDetector.js', () => ({
  detectLanguages: vi.fn(() => state.languages),
}));

vi.mock('../../src/core/frameworkDetector.js', () => ({
  detectFrameworks: vi.fn(async () => state.frameworks),
}));

let tmp: string;
let outside: string | undefined;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-baseframe-'));
  state.assess = assessReport();
  state.scan = scanResult(tmp);
  state.languages = languageBreakdown();
  state.frameworks = frameworkResult();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-26T12:00:00.000Z'));
});

afterEach(async () => {
  vi.useRealTimers();
  await fs.rm(tmp, { recursive: true, force: true });
  if (outside) await fs.rm(outside, { recursive: true, force: true });
  outside = undefined;
});

test('exports a valid Baseframe assessment artifact', async () => {
  const assessment = await createBaseframeAssessment({
    root: tmp,
    taskId: 'auth-password-reset-20260626-01',
    intent: 'Implement password reset',
  });

  const outputPath = path.join(
    tmp,
    '.baseframe/evidence/auth-password-reset-20260626-01/projscan-assessment.json',
  );
  const written = JSON.parse(await fs.readFile(outputPath, 'utf-8'));

  expect(written).toEqual(assessment);
  expect(assessment.schemaVersion).toBe('1.0');
  expect(assessment.kind).toBe('projscan-assessment');
  expect(assessment.producer.name).toBe('projscan');
  expect(assessment.producer.version).toMatch(/^\d+\.\d+\.\d+/);
  expect(assessment.taskId).toBe('auth-password-reset-20260626-01');
  expect(assessment.intent).toBe('Implement password reset');
  expect(assessment.generatedAt).toBe('2026-06-26T12:00:00.000Z');
  expect(assessment.repository.root).toBe(path.resolve(tmp));
  expect(assessment.verdict).toBe('caution');
  expect(assessment.repositoryType).toBe('TypeScript repository (Express, Vitest; npm)');
  expect(assessment.impactedAreas).toEqual([
    {
      name: 'src',
      paths: ['src/auth.ts'],
      reason: 'Hardcoded secret',
    },
  ]);
  expect(assessment.reviewFocus).toEqual([
    {
      path: 'src/auth.ts',
      priority: 'high',
      reasons: ['Hardcoded secret', 'A high-confidence secret-like value is assigned in source.'],
    },
  ]);
  expect(assessment.risks[0]).toMatchObject({
    id: 'bh-issue-hardcoded-secret-src-auth-ts',
    severity: 'warning',
    category: 'doctor',
    message: 'Hardcoded secret',
    files: ['src/auth.ts'],
  });
  expect(assessment.suggestedChecks).toEqual([
    {
      command: 'projscan doctor --format json',
      reason: 'Confirms the issue queue after fixes.',
      required: true,
    },
    {
      command: 'npm test',
      reason: 'Proof-card verification for Hardcoded secret.',
      required: true,
    },
    {
      command: 'projscan assess --mode fix-first --format json',
      reason: 'ProjScan assessment follow-up.',
      required: false,
    },
  ]);
});

test('rejects invalid task IDs before writing artifacts', async () => {
  await expect(
    createBaseframeAssessment({
      root: tmp,
      taskId: '../agentloopkit-task',
      intent: 'Implement password reset',
    }),
  ).rejects.toThrow(/task ID/i);

  await expect(fs.access(path.join(tmp, '.baseframe'))).rejects.toThrow();
});

test('uses the default Baseframe output path when no output path is supplied', async () => {
  await createBaseframeAssessment({
    root: tmp,
    taskId: 'auth-password-reset-20260626-01',
    intent: 'Implement password reset',
  });

  await expect(
    fs.access(
      path.join(
        tmp,
        '.baseframe/evidence/auth-password-reset-20260626-01/projscan-assessment.json',
      ),
    ),
  ).resolves.toBeUndefined();
});

test('writes to an explicit ProjScan-owned output path', async () => {
  const outputPath = path.join(
    tmp,
    '.baseframe/evidence/auth-password-reset-20260626-01/projscan-assessment.json',
  );

  await createBaseframeAssessment({
    root: tmp,
    taskId: 'auth-password-reset-20260626-01',
    intent: 'Implement password reset',
    outputPath,
  });

  const written = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
  expect(written.taskId).toBe('auth-password-reset-20260626-01');
});

test('creates the workflow manifest with ProjScan status and relative paths', async () => {
  const assessment = await createBaseframeAssessment({
    root: tmp,
    taskId: 'auth-password-reset-20260626-01',
    intent: 'Implement password reset',
  });

  const manifest = JSON.parse(
    await fs.readFile(path.join(tmp, '.baseframe/agent-workflow.json'), 'utf-8'),
  );
  expect(manifest).toEqual({
    schemaVersion: '1.0',
    taskId: 'auth-password-reset-20260626-01',
    intent: 'Implement password reset',
    createdAt: '2026-06-26T12:00:00.000Z',
    updatedAt: '2026-06-26T12:00:00.000Z',
    tools: {
      projscan: {
        status: 'completed',
        assessmentPath:
          '.baseframe/evidence/auth-password-reset-20260626-01/projscan-assessment.json',
        version: assessment.producer.version,
      },
    },
  });
  expect(path.isAbsolute(manifest.tools.projscan.assessmentPath)).toBe(false);
});

test('updates the workflow manifest while preserving other tool sections and unknown fields', async () => {
  await fs.mkdir(path.join(tmp, '.baseframe'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, '.baseframe/agent-workflow.json'),
    `${JSON.stringify(
      {
        schemaVersion: '1.0',
        taskId: 'auth-password-reset-20260626-01',
        intent: 'Implement password reset',
        createdAt: '2026-06-26T08:00:00.000Z',
        updatedAt: '2026-06-26T09:00:00.000Z',
        tools: {
          projscan: {
            status: 'created',
            assessmentPath: '.baseframe/evidence/auth-password-reset-20260626-01/old.json',
            version: '0.0.0',
          },
          agentloopkit: {
            status: 'created',
            taskPath: '.baseframe/evidence/auth-password-reset-20260626-01/agentloopkit-task.json',
            version: '1.2.3',
          },
          agentflight: {
            status: 'completed',
            resultPath:
              '.baseframe/evidence/auth-password-reset-20260626-01/agentflight-result.json',
            version: '4.5.6',
          },
        },
        reviewerNote: 'keep me',
      },
      null,
      2,
    )}\n`,
  );

  await createBaseframeAssessment({
    root: tmp,
    taskId: 'auth-password-reset-20260626-01',
    intent: 'Implement password reset',
  });

  const manifest = JSON.parse(
    await fs.readFile(path.join(tmp, '.baseframe/agent-workflow.json'), 'utf-8'),
  );
  expect(manifest.createdAt).toBe('2026-06-26T08:00:00.000Z');
  expect(manifest.updatedAt).toBe('2026-06-26T12:00:00.000Z');
  expect(manifest.reviewerNote).toBe('keep me');
  expect(manifest.tools.agentloopkit).toEqual({
    status: 'created',
    taskPath: '.baseframe/evidence/auth-password-reset-20260626-01/agentloopkit-task.json',
    version: '1.2.3',
  });
  expect(manifest.tools.agentflight).toEqual({
    status: 'completed',
    resultPath: '.baseframe/evidence/auth-password-reset-20260626-01/agentflight-result.json',
    version: '4.5.6',
  });
  expect(manifest.tools.projscan.assessmentPath).toBe(
    '.baseframe/evidence/auth-password-reset-20260626-01/projscan-assessment.json',
  );
});

test('keeps assessment JSON deterministic for identical inputs', async () => {
  const options = {
    root: tmp,
    taskId: 'auth-password-reset-20260626-01',
    intent: 'Implement password reset',
  };
  const outputPath = path.join(
    tmp,
    '.baseframe/evidence/auth-password-reset-20260626-01/projscan-assessment.json',
  );

  await createBaseframeAssessment(options);
  const first = await fs.readFile(outputPath, 'utf-8');
  await createBaseframeAssessment(options);
  const second = await fs.readFile(outputPath, 'utf-8');

  expect(second).toBe(first);
  expect(first.endsWith('\n')).toBe(true);
});

test('uses unknown and empty values when ProjScan signals are unavailable', async () => {
  state.assess = assessReport({
    verdict: 'ready',
    summary: 'ready: no proof-backed action outranks baseline verification',
    proofCards: [],
    commands: [],
    feedback: [],
    sourceVerdicts: undefined,
  });
  state.scan = scanResult(tmp, []);
  state.languages = { primary: 'Unknown', languages: {} };
  state.frameworks = { frameworks: [], buildTools: [], packageManager: 'unknown' };

  const assessment = await createBaseframeAssessment({
    root: tmp,
    taskId: 'unknown-task-20260626-01',
    intent: 'Assess unknown repo',
  });

  expect(assessment.verdict).toBe('unknown');
  expect(assessment.summary).toContain('limited');
  expect(assessment.repositoryType).toBeUndefined();
  expect(assessment.impactedAreas).toEqual([]);
  expect(assessment.reviewFocus).toEqual([]);
  expect(assessment.risks).toEqual([]);
  expect(assessment.suggestedChecks).toEqual([]);
});

test.each([
  ['block', 'blocked', 'block'],
  ['caution', 'watch', 'caution'],
  ['proceed', 'ready', 'proceed'],
] as const)(
  'maps preflight %s and assess %s to Baseframe verdict %s',
  async (preflightVerdict, assessVerdict, expected) => {
    state.assess = assessReport({
      verdict: assessVerdict,
      sourceVerdicts: { quality: assessVerdict === 'blocked' ? 'blocked' : 'healthy', preflight: preflightVerdict },
    });

    const assessment = await createBaseframeAssessment({
      root: tmp,
      taskId: `verdict-${expected}-20260626-01`,
      intent: `Assess ${expected} mapping`,
    });

    expect(assessment.verdict).toBe(expected);
  },
);

test('rejects output paths outside the ProjScan-owned Baseframe artifact', async () => {
  await expect(
    createBaseframeAssessment({
      root: tmp,
      taskId: 'auth-password-reset-20260626-01',
      intent: 'Implement password reset',
      outputPath: path.join(tmp, '..', 'escape', 'projscan-assessment.json'),
    }),
  ).rejects.toThrow(/output path/i);
});

test('rejects symlinked Baseframe directories', async () => {
  outside = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-baseframe-outside-'));
  try {
    await fs.symlink(outside, path.join(tmp, '.baseframe'), 'dir');
  } catch {
    return;
  }

  await expect(
    createBaseframeAssessment({
      root: tmp,
      taskId: 'auth-password-reset-20260626-01',
      intent: 'Implement password reset',
    }),
  ).rejects.toThrow(/symlink/i);
});

test('does not overwrite unrelated existing artifacts', async () => {
  const outputPath = path.join(
    tmp,
    '.baseframe/evidence/auth-password-reset-20260626-01/projscan-assessment.json',
  );
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, '{"kind":"agentloopkit-task"}\n');

  await expect(
    createBaseframeAssessment({
      root: tmp,
      taskId: 'auth-password-reset-20260626-01',
      intent: 'Implement password reset',
    }),
  ).rejects.toThrow(/existing output/i);
});

function assessReport(overrides: Partial<AssessReport> = {}): AssessReport {
  return {
    schemaVersion: 1,
    goal: 'Implement password reset',
    mode: 'standard',
    verdict: 'watch',
    summary: 'watch: 1 proof-backed action(s), projected risk delta +5',
    answers: {
      actuallyRisky: 'Hardcoded secret is the top proof-backed risk.',
      whyRisky: 'Evidence comes from doctor.',
      fixFirst: 'Hardcoded secret: Replace hardcoded value.',
      safestChange: 'Use a small bounded change.',
      testsThatProveIt: ['projscan doctor --format json', 'npm test'],
      riskRemoved: 'Projected risk score improves by 5 to 95.',
      shipNow: 'Ship only after preflight and proof commands pass; current preflight verdict is caution.',
    },
    proofCards: [
      {
        id: 'bh-issue-hardcoded-secret-src-auth-ts',
        priority: 'p1',
        source: 'doctor',
        finding: 'Hardcoded secret',
        whyItMatters: 'A high-confidence secret-like value is assigned in source.',
        files: ['src/auth.ts'],
        evidence: [{ source: 'doctor', detail: 'Hardcoded secret', file: 'src/auth.ts' }],
        impact: {
          commands: ['projscan file src/auth.ts --format json'],
          affectedAreas: ['src'],
          likelyFiles: ['src/auth.ts'],
        },
        recommendedFix: {
          summary: 'Replace hardcoded value.',
          safeChangeShape: 'Keep the change isolated to auth configuration.',
        },
        verification: {
          commands: ['npm test'],
          expected: 'The finding no longer appears and tests pass.',
        },
        confidence: 'high',
        confidenceReason: 'Strong local signal.',
        evidenceStrength: {
          level: 'strong',
          score: 10,
          sources: ['doctor'],
          reasons: ['doctor warning'],
        },
        evidenceGaps: [],
        ranking: { rank: 1, score: 100, reasons: ['priority p1'] },
        trustMemory: {
          status: 'none',
          summary: 'No feedback memory.',
          signals: [],
          feedbackCommand: 'projscan feedback',
        },
        agentHandoff: {
          title: 'Fix hardcoded secret',
          problem: 'Hardcoded secret',
          scope: ['src/auth.ts'],
          files: ['src/auth.ts'],
          constraints: [],
          verificationCommands: ['npm test'],
          doneCriteria: [],
          rollback: 'Revert auth change.',
        },
        suppression: { command: 'projscan feedback' },
        feedback: { command: 'projscan feedback' },
        riskDelta: {
          baselineScore: 90,
          projectedScore: 95,
          delta: 5,
          basis: ['doctor'],
        },
      },
    ],
    fixFirst: undefined,
    riskDelta: {
      baselineScore: 90,
      projectedScore: 95,
      delta: 5,
      basis: ['doctor'],
    },
    commands: ['projscan assess --mode fix-first --format json'],
    feedback: [],
    sourceVerdicts: {
      quality: 'needs_attention',
      preflight: 'caution',
    },
    ...overrides,
  };
}

function scanResult(rootPath: string, relativePaths = ['package.json', 'src/auth.ts']): ScanResult {
  const files = relativePaths.map((relativePath) => ({
    relativePath,
    absolutePath: path.join(rootPath, relativePath),
    extension: path.extname(relativePath),
    sizeBytes: 10,
    directory: path.dirname(relativePath) === '.' ? '.' : path.dirname(relativePath),
  }));
  return {
    rootPath,
    totalFiles: files.length,
    totalDirectories: 1,
    files,
    directoryTree: {
      name: path.basename(rootPath),
      path: '.',
      children: [],
      fileCount: files.length,
      totalFileCount: files.length,
    },
    scanDurationMs: 1,
    scanBoundary: {
      source: 'glob',
      gitignoreRespected: false,
      includeIgnored: false,
      ignoredFileCount: 0,
    },
  };
}

function languageBreakdown(): LanguageBreakdown {
  return {
    primary: 'TypeScript',
    languages: {
      TypeScript: {
        name: 'TypeScript',
        fileCount: 1,
        percentage: 50,
        extensions: ['.ts'],
      },
      JSON: {
        name: 'JSON',
        fileCount: 1,
        percentage: 50,
        extensions: ['.json'],
      },
    },
  };
}

function frameworkResult(): FrameworkResult {
  return {
    frameworks: [
      {
        name: 'Express',
        category: 'backend',
        confidence: 'high',
      },
      {
        name: 'Vitest',
        category: 'testing',
        confidence: 'high',
      },
    ],
    buildTools: ['TypeScript'],
    packageManager: 'npm',
  };
}
