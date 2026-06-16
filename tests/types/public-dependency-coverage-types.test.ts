import { expect, test } from 'vitest';
import type {
  AuditFinding,
  AuditReport,
  AuditSeverity,
  OutdatedPackage,
  OutdatedReport,
  SemverDrift,
  UpgradePreview,
} from '../../src/types/dependencyHealth.js';
import type {
  CoverageJoinedHotspot,
  CoverageJoinedReport,
  CoverageReport,
  CoverageSource,
  FileCoverage,
} from '../../src/types/coverage.js';
import type {
  AuditFinding as BarrelAuditFinding,
  AuditReport as BarrelAuditReport,
  AuditSeverity as BarrelAuditSeverity,
  CoverageJoinedHotspot as BarrelCoverageJoinedHotspot,
  CoverageJoinedReport as BarrelCoverageJoinedReport,
  CoverageReport as BarrelCoverageReport,
  CoverageSource as BarrelCoverageSource,
  FileCoverage as BarrelFileCoverage,
  OutdatedPackage as BarrelOutdatedPackage,
  OutdatedReport as BarrelOutdatedReport,
  SemverDrift as BarrelSemverDrift,
  UpgradePreview as BarrelUpgradePreview,
} from '../../src/types.js';

const drift: SemverDrift = 'minor';
const auditSeverity: AuditSeverity = 'high';

const outdatedPackage: OutdatedPackage = {
  name: 'agentloopkit',
  declared: '^1.0.0',
  installed: '1.0.0',
  latest: '1.1.0',
  drift,
  scope: 'devDependency',
  workspace: 'root',
};

const outdatedReport: OutdatedReport = {
  available: true,
  totalPackages: 1,
  packages: [outdatedPackage],
  byWorkspace: [{ workspace: 'root', relativePath: '.', total: 1 }],
};

const auditFinding: AuditFinding = {
  name: 'example',
  severity: auditSeverity,
  title: 'Example advisory',
  url: 'https://example.com/advisory',
  cve: ['CVE-2026-0001'],
  via: ['example'],
  range: '<1.1.0',
  fixAvailable: true,
};

const auditReport: AuditReport = {
  available: true,
  summary: {
    critical: 0,
    high: 1,
    moderate: 0,
    low: 0,
    info: 0,
  },
  findings: [auditFinding],
};

const upgradePreview: UpgradePreview = {
  available: true,
  name: outdatedPackage.name,
  declared: outdatedPackage.declared,
  installed: outdatedPackage.installed,
  latest: outdatedPackage.latest,
  drift,
  breakingMarkers: ['major version bump'],
  changelogExcerpt: 'Compile-check changelog excerpt.',
  importers: ['package.json'],
  installedSource: 'poetry.lock',
  installedLine: 3,
  latestSource: 'registry',
  registryError: 'compile-check registry error shape',
};

const coverageSource: CoverageSource = 'lcov';
const fileCoverage: FileCoverage = {
  relativePath: 'src/types.ts',
  lineCoverage: 91.5,
  linesFound: 100,
  linesHit: 92,
};

const coverageReport: CoverageReport = {
  available: true,
  source: coverageSource,
  sourceFile: 'coverage/lcov.info',
  totalCoverage: fileCoverage.lineCoverage,
  files: [fileCoverage],
};

const coverageHotspot: CoverageJoinedHotspot = {
  relativePath: fileCoverage.relativePath,
  riskScore: 407,
  churn: 71,
  lineCount: 2000,
  issueCount: 0,
  coverage: fileCoverage.lineCoverage,
  priority: 1,
  reasons: ['compile check'],
};

const coverageJoinedReport: CoverageJoinedReport = {
  available: true,
  coverageSource,
  coverageSourceFile: coverageReport.sourceFile,
  entries: [coverageHotspot],
};

const barrelDrift: BarrelSemverDrift = drift;
const barrelAuditSeverity: BarrelAuditSeverity = auditSeverity;
const barrelOutdatedPackage: BarrelOutdatedPackage = outdatedPackage;
const barrelOutdatedReport: BarrelOutdatedReport = outdatedReport;
const barrelAuditFinding: BarrelAuditFinding = auditFinding;
const barrelAuditReport: BarrelAuditReport = auditReport;
const barrelUpgradePreview: BarrelUpgradePreview = upgradePreview;
const barrelCoverageSource: BarrelCoverageSource = coverageSource;
const barrelFileCoverage: BarrelFileCoverage = fileCoverage;
const barrelCoverageReport: BarrelCoverageReport = coverageReport;
const barrelCoverageHotspot: BarrelCoverageJoinedHotspot = coverageHotspot;
const barrelCoverageJoinedReport: BarrelCoverageJoinedReport = coverageJoinedReport;

void [
  barrelDrift,
  barrelAuditSeverity,
  barrelOutdatedPackage,
  barrelOutdatedReport,
  barrelAuditFinding,
  barrelAuditReport,
  barrelUpgradePreview,
  barrelCoverageSource,
  barrelFileCoverage,
  barrelCoverageReport,
  barrelCoverageHotspot,
  barrelCoverageJoinedReport,
];

test('dependency and coverage public types compile from modules and legacy barrel', () => {
  expect(barrelCoverageJoinedReport).toBe(coverageJoinedReport);
});
