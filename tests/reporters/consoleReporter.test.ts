import { describe, it, expect } from 'vitest';
import {
  reportAnalysis,
  reportHealth,
  reportCi,
  reportDiff,
  reportDependencies,
  reportHotspots,
  reportOutdated,
  reportAudit,
  reportUpgrade,
  reportExplanation,
  reportDetectedIssues,
  reportFixResults,
} from '../../src/reporters/consoleReporter.js';
import {
  captureStdout,
  stripAnsi,
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
import type { Fix } from '../../src/types.js';

async function capturePlain(fn: () => void): Promise<string> {
  return stripAnsi(await captureStdout(fn));
}

describe('consoleReporter', () => {
  describe('reportAnalysis', () => {
    it('renders project summary with name, language, and file count', async () => {
      const out = await capturePlain(() => reportAnalysis(makeAnalysisReport()));
      expect(out).toContain('test-project');
      expect(out).toContain('TypeScript');
      expect(out).toContain('42'); // totalFiles
      expect(out).toContain('React'); // framework
    });

    it('does not throw on a minimal report with no frameworks and no deps', async () => {
      const minimal = makeAnalysisReport({
        frameworks: { frameworks: [], buildTools: [], packageManager: 'unknown' },
        dependencies: null,
        issues: [],
      });
      await expect(capturePlain(() => reportAnalysis(minimal))).resolves.toBeTruthy();
    });
  });

  describe('reportHealth', () => {
    it('renders grade and issue counts', async () => {
      const issues = [
        makeIssue({ id: 'e1', severity: 'error' }),
        makeIssue({ id: 'w1', severity: 'warning' }),
      ];
      const out = await capturePlain(() => reportHealth(issues, 500));
      expect(out).toContain('Health Score');
      expect(out).toMatch(/\d+\/100/);
      expect(out).toContain('error');
      expect(out).toContain('warning');
      expect(out).toContain('500ms');
    });

    it('shows a healthy message when no issues are present', async () => {
      const out = await capturePlain(() => reportHealth([]));
      expect(out.toLowerCase()).toContain('no issues detected');
    });

    it('prints a Recommendations block for fixable issues', async () => {
      const issues = [makeIssue({ fixAvailable: true, fixId: 'add-readme' })];
      const out = await capturePlain(() => reportHealth(issues));
      expect(out).toContain('Recommendations');
      expect(out).toContain('projscan fix');
    });
  });

  describe('reportCi', () => {
    it('emits PASS when score clears threshold', async () => {
      const out = await capturePlain(() => reportCi([], 50));
      expect(out).toContain('PASS');
      expect(out).toContain('threshold: 50');
    });

    it('emits FAIL and lists issues when score is below threshold', async () => {
      const issues = [
        makeIssue({ id: 'e1', title: 'Big broken thing', severity: 'error' }),
        makeIssue({ id: 'e2', title: 'Another broken thing', severity: 'error' }),
      ];
      const out = await capturePlain(() => reportCi(issues, 100));
      expect(out).toContain('FAIL');
      expect(out).toContain('Big broken thing');
      expect(out).toContain('Another broken thing');
    });
  });

  describe('reportDiff', () => {
    it('shows score transition and resolved/new issue counts', async () => {
      const out = await capturePlain(() => reportDiff(makeDiff()));
      expect(out).toContain('80');
      expect(out).toContain('75');
      expect(out).toContain('-5');
      expect(out).toContain('Resolved');
      expect(out).toContain('New');
      expect(out).toContain('old-issue');
      expect(out).toContain('new-issue');
    });

    it('says "No change" when there are no new/resolved issues', async () => {
      const diff = makeDiff();
      diff.newIssues = [];
      diff.resolvedIssues = [];
      const out = await capturePlain(() => reportDiff(diff));
      expect(out.toLowerCase()).toContain('no change');
    });
  });

  describe('reportDependencies', () => {
    it('renders counts and risks', async () => {
      const out = await capturePlain(() => reportDependencies(makeDependencyReport()));
      expect(out).toContain('react');
      expect(out.toLowerCase()).toContain('depend');
    });
  });

  describe('reportHotspots', () => {
    it('renders the hotspots table with risk data', async () => {
      const out = await capturePlain(() => reportHotspots(makeHotspotReport()));
      expect(out).toContain('src/big.ts');
      expect(out).toContain('85');
    });

    it('gracefully handles unavailable report', async () => {
      const out = await capturePlain(() =>
        reportHotspots({
          available: false,
          reason: 'no git history',
          window: { since: null, commitsScanned: 0 },
          hotspots: [],
          totalFilesRanked: 0,
        }),
      );
      expect(out).toContain('no git history');
    });
  });

  describe('reportOutdated', () => {
    it('lists drifted packages', async () => {
      const out = await capturePlain(() => reportOutdated(makeOutdatedReport()));
      expect(out).toContain('react');
      expect(out.toLowerCase()).toContain('major');
    });

    it('shows a healthy message when nothing has drifted', async () => {
      const out = await capturePlain(() =>
        reportOutdated({ available: true, totalPackages: 0, packages: [] }),
      );
      expect(out.toLowerCase()).toContain('match installed');
    });

    it('handles unavailable report', async () => {
      const out = await capturePlain(() =>
        reportOutdated({ available: false, reason: 'no package.json', totalPackages: 0, packages: [] }),
      );
      expect(out).toContain('no package.json');
    });
  });

  describe('reportAudit', () => {
    it('renders severity counts and finding titles', async () => {
      const out = await capturePlain(() => reportAudit(makeAuditReport()));
      expect(out.toLowerCase()).toContain('prototype pollution');
      expect(out.toLowerCase()).toContain('high');
    });

    it('shows a clean message when summary is all zeroes', async () => {
      const out = await capturePlain(() =>
        reportAudit({
          available: true,
          summary: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
          findings: [],
        }),
      );
      expect(out.toLowerCase()).toContain('no known vulnerabilities');
    });
  });

  describe('reportUpgrade', () => {
    it('renders drift, breaking markers, and importers', async () => {
      const out = await capturePlain(() => reportUpgrade(makeUpgradePreview()));
      expect(out).toContain('react');
      expect(out).toContain('MAJOR');
      expect(out.toLowerCase()).toContain('breaking');
      expect(out).toContain('src/App.tsx');
    });

    it('renders a clean message when no breaking markers exist', async () => {
      const preview = makeUpgradePreview();
      preview.breakingMarkers = [];
      const out = await capturePlain(() => reportUpgrade(preview));
      expect(out.toLowerCase()).toContain('no obvious breaking');
    });

    it('handles unavailable preview gracefully', async () => {
      const out = await capturePlain(() =>
        reportUpgrade({
          available: false,
          reason: 'Invalid package name',
          name: 'x',
          declared: null,
          installed: null,
          latest: null,
          drift: 'unknown',
          breakingMarkers: [],
          importers: [],
        }),
      );
      expect(out).toContain('Invalid package name');
    });
  });

  describe('reportExplanation', () => {
    it('renders imports and exports', async () => {
      const out = await capturePlain(() => reportExplanation(makeExplanation()));
      expect(out).toContain('src/index.ts');
      expect(out).toContain('react');
      expect(out).toContain('App');
    });
  });

  describe('reportDetectedIssues / reportFixResults', () => {
    it('lists detected issues and their matching fixes', async () => {
      const issues = [makeIssue({ fixAvailable: true, fixId: 'add-readme', title: 'Missing README' })];
      const fixes: Fix[] = [
        {
          id: 'add-readme',
          title: 'Create a README',
          description: 'Scaffold a README',
          issueId: 'missing-readme',
          apply: async () => {},
        },
      ];
      const out = await capturePlain(() => reportDetectedIssues(issues, fixes));
      expect(out).toContain('Missing README');
    });

    it('summarises fix success/failure outcomes', async () => {
      const fixes: Fix[] = [
        {
          id: 'add-readme',
          title: 'Create a README',
          description: 'x',
          issueId: 'missing-readme',
          apply: async () => {},
        },
      ];
      const out = await capturePlain(() =>
        reportFixResults([
          { fix: fixes[0], success: true },
          { fix: fixes[0], success: false, error: 'disk full' },
        ]),
      );
      expect(out.toLowerCase()).toContain('disk full');
    });
  });
});
