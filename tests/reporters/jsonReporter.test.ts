import { describe, it, expect } from 'vitest';
import {
  reportAnalysisJson,
  reportHealthJson,
  reportCiJson,
  reportDiffJson,
  reportExplanationJson,
  reportDependenciesJson,
  reportHotspotsJson,
  reportOutdatedJson,
  reportAuditJson,
  reportUpgradeJson,
} from '../../src/reporters/jsonReporter.js';
import {
  captureStdout,
  makeAnalysisReport,
  makeAuditReport,
  makeDependencyReport,
  makeDiff,
  makeExplanation,
  makeHotspotReport,
  makeIssue,
  makeOutdatedReport,
  makeUpgradePreview,
} from './fixtures.js';

async function captureJson(fn: () => void): Promise<unknown> {
  const out = await captureStdout(fn);
  return JSON.parse(out);
}

describe('jsonReporter', () => {
  describe('reportAnalysisJson', () => {
    it('emits the full AnalysisReport at the top level', async () => {
      const report = makeAnalysisReport();
      const parsed = (await captureJson(() => reportAnalysisJson(report))) as Record<string, unknown>;
      expect(parsed).toMatchObject({
        projectName: 'test-project',
        rootPath: '/proj',
        timestamp: '2026-04-24T00:00:00.000Z',
      });
      expect(parsed).toHaveProperty('scan');
      expect(parsed).toHaveProperty('languages');
      expect(parsed).toHaveProperty('frameworks');
      expect(parsed).toHaveProperty('dependencies');
      expect(parsed).toHaveProperty('issues');
    });
  });

  describe('reportHealthJson', () => {
    it('wraps health data under a `health` key with score/grade/counts', async () => {
      const issues = [
        makeIssue({ id: 'e1', severity: 'error' }),
        makeIssue({ id: 'w1', severity: 'warning' }),
        makeIssue({ id: 'i1', severity: 'info' }),
      ];
      const parsed = (await captureJson(() => reportHealthJson(issues))) as {
        health: Record<string, unknown>;
      };
      expect(parsed.health).toMatchObject({
        totalIssues: 3,
        errors: 1,
        warnings: 1,
        info: 1,
      });
      expect(typeof parsed.health.score).toBe('number');
      expect(parsed.health.grade).toMatch(/^[A-F]$/);
      expect(parsed.health.issues).toHaveLength(3);
    });

    it('reports zero counts for an empty issue list', async () => {
      const parsed = (await captureJson(() => reportHealthJson([]))) as {
        health: Record<string, number>;
      };
      expect(parsed.health.totalIssues).toBe(0);
      expect(parsed.health.errors).toBe(0);
      expect(parsed.health.warnings).toBe(0);
      expect(parsed.health.info).toBe(0);
    });
  });

  describe('reportCiJson', () => {
    it('includes threshold, pass/fail, and propagates issues', async () => {
      const parsed = (await captureJson(() =>
        reportCiJson([makeIssue({ severity: 'error' })], 80),
      )) as { ci: Record<string, unknown> };
      expect(parsed.ci).toMatchObject({ threshold: 80, totalIssues: 1, errors: 1 });
      expect(typeof parsed.ci.pass).toBe('boolean');
      expect(typeof parsed.ci.score).toBe('number');
    });

    it('marks pass=true when score meets threshold', async () => {
      const parsed = (await captureJson(() => reportCiJson([], 50))) as {
        ci: { pass: boolean; score: number };
      };
      expect(parsed.ci.pass).toBe(parsed.ci.score >= 50);
      expect(parsed.ci.pass).toBe(true);
    });
  });

  describe('wrapper shapes', () => {
    it('reportDiffJson wraps under `diff`', async () => {
      const parsed = (await captureJson(() => reportDiffJson(makeDiff()))) as {
        diff: Record<string, unknown>;
      };
      expect(parsed).toHaveProperty('diff');
      expect(parsed.diff).toMatchObject({
        scoreDelta: -5,
        newIssues: ['new-issue'],
        resolvedIssues: ['old-issue'],
      });
    });

    it('reportHotspotsJson wraps under `hotspots`', async () => {
      const parsed = (await captureJson(() => reportHotspotsJson(makeHotspotReport()))) as {
        hotspots: Record<string, unknown>;
      };
      expect(parsed).toHaveProperty('hotspots');
      expect(parsed.hotspots).toHaveProperty('hotspots');
    });

    it('reportOutdatedJson wraps under `outdated`', async () => {
      const parsed = (await captureJson(() => reportOutdatedJson(makeOutdatedReport()))) as Record<
        string,
        unknown
      >;
      expect(parsed).toHaveProperty('outdated');
    });

    it('reportAuditJson wraps under `audit`', async () => {
      const parsed = (await captureJson(() => reportAuditJson(makeAuditReport()))) as Record<
        string,
        unknown
      >;
      expect(parsed).toHaveProperty('audit');
    });

    it('reportUpgradeJson wraps under `upgrade`', async () => {
      const parsed = (await captureJson(() => reportUpgradeJson(makeUpgradePreview()))) as {
        upgrade: Record<string, unknown>;
      };
      expect(parsed).toHaveProperty('upgrade');
      expect(parsed.upgrade).toMatchObject({
        name: 'react',
        drift: 'major',
      });
    });

    it('reportExplanationJson emits the explanation at the top level', async () => {
      const parsed = (await captureJson(() =>
        reportExplanationJson(makeExplanation()),
      )) as Record<string, unknown>;
      expect(parsed).toMatchObject({ filePath: 'src/index.ts', lineCount: 42 });
    });

    it('reportDependenciesJson emits the dependency report at the top level', async () => {
      const parsed = (await captureJson(() =>
        reportDependenciesJson(makeDependencyReport()),
      )) as Record<string, unknown>;
      expect(parsed).toMatchObject({ totalDependencies: 2, totalDevDependencies: 1 });
    });
  });

  it('emits parseable JSON with 2-space indentation', async () => {
    const out = await captureStdout(() => reportAnalysisJson(makeAnalysisReport()));
    expect(() => JSON.parse(out)).not.toThrow();
    expect(out).toContain('\n  "projectName"');
  });
});
