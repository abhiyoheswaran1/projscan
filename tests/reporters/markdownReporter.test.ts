import { describe, it, expect } from 'vitest';
import {
  reportAnalysisMarkdown,
  reportHealthMarkdown,
  reportCiMarkdown,
  reportDiffMarkdown,
  reportExplanationMarkdown,
  reportDependenciesMarkdown,
  reportHotspotsMarkdown,
  reportOutdatedMarkdown,
  reportAuditMarkdown,
  reportUpgradeMarkdown,
} from '../../src/reporters/markdownReporter.js';
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

describe('markdownReporter', () => {
  describe('reportAnalysisMarkdown', () => {
    it('emits the expected top-level headings and Project table', async () => {
      const out = await captureStdout(() => reportAnalysisMarkdown(makeAnalysisReport()));
      expect(out).toContain('# ProjScan Project Report');
      expect(out).toContain('## Project');
      expect(out).toContain('## Languages');
      expect(out).toContain('## Issues');
      expect(out).toContain('| Language | TypeScript |');
      expect(out).toContain('| Frameworks | React |');
      expect(out).toContain('| Files | 42 |');
    });

    it('renders issue bullets with severity icons', async () => {
      const report = makeAnalysisReport({
        issues: [
          makeIssue({ id: 'e', severity: 'error', title: 'Err' }),
          makeIssue({ id: 'w', severity: 'warning', title: 'Warn' }),
          makeIssue({ id: 'i', severity: 'info', title: 'Inf' }),
        ],
      });
      const out = await captureStdout(() => reportAnalysisMarkdown(report));
      expect(out).toContain('❌ **Err**');
      expect(out).toContain('⚠️ **Warn**');
      expect(out).toContain('ℹ️ **Inf**');
    });

    it('omits the Issues section when there are no issues', async () => {
      const report = makeAnalysisReport({ issues: [] });
      const out = await captureStdout(() => reportAnalysisMarkdown(report));
      expect(out).not.toContain('## Issues');
    });
  });

  describe('reportHealthMarkdown', () => {
    it('includes health score, grade, badge, and issue bullets', async () => {
      const issues = [makeIssue({ severity: 'error', title: 'Fatal' })];
      const out = await captureStdout(() => reportHealthMarkdown(issues));
      expect(out).toMatch(/# Project Health Report/);
      expect(out).toMatch(/\*\*Health Score: [A-F] \(\d+\/100\)\*\*/);
      expect(out).toMatch(/!\[.*\]\(.*\)/); // badge markdown image
      expect(out).toContain('❌ **Fatal**');
    });

    it('shows the healthy message when no issues exist', async () => {
      const out = await captureStdout(() => reportHealthMarkdown([]));
      expect(out.toLowerCase()).toContain('no issues detected');
    });
  });

  describe('reportCiMarkdown', () => {
    it('produces a PASS table when score meets threshold', async () => {
      const out = await captureStdout(() => reportCiMarkdown([], 50));
      expect(out).toContain('# Projscan CI - PASS');
      expect(out).toContain('| Threshold | 50 |');
      expect(out).toContain('✅ Pass');
    });

    it('produces a FAIL table when below threshold', async () => {
      const out = await captureStdout(() =>
        reportCiMarkdown([makeIssue({ severity: 'error' })], 100),
      );
      expect(out).toContain('# Projscan CI - FAIL');
      expect(out).toContain('❌ Fail');
    });
  });

  describe('reportDiffMarkdown', () => {
    it('renders the Before/After/Delta table and Resolved/New sections', async () => {
      const out = await captureStdout(() => reportDiffMarkdown(makeDiff()));
      expect(out).toContain('# Health Diff');
      expect(out).toContain('| Metric | Before | After | Delta |');
      expect(out).toContain('| Score | 80 | 75 | -5 ↓ |');
      expect(out).toContain('| Grade | B | C | |');
      expect(out).toContain('## Resolved');
      expect(out).toContain('## New Issues');
      expect(out).toContain('✅ old-issue');
      expect(out).toContain('❌ new-issue');
    });

    it('omits Resolved and New sections when empty', async () => {
      const diff = makeDiff();
      diff.resolvedIssues = [];
      diff.newIssues = [];
      const out = await captureStdout(() => reportDiffMarkdown(diff));
      expect(out).not.toContain('## Resolved');
      expect(out).not.toContain('## New Issues');
    });
  });

  describe('reportExplanationMarkdown', () => {
    it('includes purpose, line count, Dependencies, and Exports sections', async () => {
      const out = await captureStdout(() => reportExplanationMarkdown(makeExplanation()));
      expect(out).toContain('# File: src/index.ts');
      expect(out).toContain('**Purpose:** Entry point');
      expect(out).toContain('**Lines:** 42');
      expect(out).toContain('## Dependencies');
      expect(out).toContain('`react`');
      expect(out).toContain('## Exports');
      expect(out).toContain('`App` (function)');
    });
  });

  describe('reportDependenciesMarkdown', () => {
    it('emits counts and Risks section', async () => {
      const out = await captureStdout(() => reportDependenciesMarkdown(makeDependencyReport()));
      expect(out).toContain('# Dependency Report');
      expect(out).toContain('Production: **2** packages');
      expect(out).toContain('Development: **1** packages');
      expect(out).toContain('## Risks');
      expect(out).toContain('**lodash**');
      expect(out).toContain('(medium)');
    });
  });

  describe('reportHotspotsMarkdown', () => {
    it('renders the hotspots table with risk columns', async () => {
      const out = await captureStdout(() => reportHotspotsMarkdown(makeHotspotReport()));
      expect(out).toContain('# Project Hotspots');
      expect(out).toContain('| # | Score | File | Churn | Lines | Issues | Reasons |');
      expect(out).toContain('`src/big.ts`');
      expect(out).toContain('| 1 | 85.0 |');
    });

    it('shows a placeholder message when the report is unavailable', async () => {
      const out = await captureStdout(() =>
        reportHotspotsMarkdown({
          available: false,
          reason: 'no git',
          window: { since: null, commitsScanned: 0 },
          hotspots: [],
          totalFilesRanked: 0,
        }),
      );
      expect(out).toContain('> no git');
    });

    it('shows "No hotspots detected." when the list is empty', async () => {
      const out = await captureStdout(() =>
        reportHotspotsMarkdown({
          available: true,
          window: { since: '2026-01-01', commitsScanned: 5 },
          hotspots: [],
          totalFilesRanked: 0,
        }),
      );
      expect(out).toContain('No hotspots detected.');
    });
  });

  describe('reportOutdatedMarkdown', () => {
    it('renders the drift table', async () => {
      const out = await captureStdout(() => reportOutdatedMarkdown(makeOutdatedReport()));
      expect(out).toContain('# Outdated Packages');
      expect(out).toContain('| Package | Scope | Declared | Installed | Drift |');
      expect(out).toContain('`react`');
      expect(out).toContain('| major |');
    });

    it('renders the healthy message when nothing drifts', async () => {
      const out = await captureStdout(() =>
        reportOutdatedMarkdown({ available: true, totalPackages: 0, packages: [] }),
      );
      expect(out).toContain('All declared packages match installed versions');
    });
  });

  describe('reportAuditMarkdown', () => {
    it('renders findings table with severity counts', async () => {
      const out = await captureStdout(() => reportAuditMarkdown(makeAuditReport()));
      expect(out).toContain('# Vulnerability Audit');
      expect(out).toContain('**1** findings');
      expect(out).toContain('| Severity | Package | Title | Fix |');
      expect(out).toContain('`vulnerable-pkg`');
      expect(out).toContain('| high |');
    });

    it('shows the clean message when no findings exist', async () => {
      const out = await captureStdout(() =>
        reportAuditMarkdown({
          available: true,
          summary: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
          findings: [],
        }),
      );
      expect(out).toContain('_No known vulnerabilities._');
    });
  });

  describe('reportUpgradeMarkdown', () => {
    it('renders version info, breaking markers, and importers', async () => {
      const out = await captureStdout(() => reportUpgradeMarkdown(makeUpgradePreview()));
      expect(out).toContain('# Upgrade Preview - `react`');
      expect(out).toContain('- Declared: `^17.0.0`');
      expect(out).toContain('- Installed: `17.0.2`');
      expect(out).toContain('- Drift: **major**');
      expect(out).toContain('## ⚠ Breaking-change markers');
      expect(out).toContain('BREAKING CHANGE: removed x');
      expect(out).toContain('## Importers (1)');
      expect(out).toContain('`src/App.tsx`');
    });

    it('shows reason when preview is unavailable', async () => {
      const out = await captureStdout(() =>
        reportUpgradeMarkdown({
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
});
