import { expect, test } from 'vitest';
import type { ExportInfo, ImportInfo, Issue } from '../../src/types/common.js';
import type {
  DependencyLicenseEntry,
  DependencyLicenseSummary,
  DependencyReport,
  DependencyRisk,
  DependencySizeEntry,
  DependencySizeSummary,
  DetectedFramework,
  DirectoryNode,
  FileEntry,
  FrameworkResult,
  LanguageBreakdown,
  LanguageStat,
  ScanBoundary,
  ScanResult,
} from '../../src/types/scanning.js';
import type {
  AnalysisReport,
  ArchitectureLayer,
  FileExplanation,
  HealthScore,
} from '../../src/types/analysis.js';
import type {
  AnalysisReport as BarrelAnalysisReport,
  ArchitectureLayer as BarrelArchitectureLayer,
  DependencyLicenseEntry as BarrelDependencyLicenseEntry,
  DependencyLicenseSummary as BarrelDependencyLicenseSummary,
  DependencyReport as BarrelDependencyReport,
  DependencyRisk as BarrelDependencyRisk,
  DependencySizeEntry as BarrelDependencySizeEntry,
  DependencySizeSummary as BarrelDependencySizeSummary,
  DetectedFramework as BarrelDetectedFramework,
  DirectoryNode as BarrelDirectoryNode,
  FileEntry as BarrelFileEntry,
  FileExplanation as BarrelFileExplanation,
  FrameworkResult as BarrelFrameworkResult,
  HealthScore as BarrelHealthScore,
  LanguageBreakdown as BarrelLanguageBreakdown,
  LanguageStat as BarrelLanguageStat,
  ScanBoundary as BarrelScanBoundary,
  ScanResult as BarrelScanResult,
} from '../../src/types.js';

const fileEntry: FileEntry = {
  relativePath: 'src/index.ts',
  absolutePath: '/repo/src/index.ts',
  extension: '.ts',
  sizeBytes: 120,
  directory: 'src',
};

const directoryNode: DirectoryNode = {
  name: 'src',
  path: 'src',
  children: [],
  fileCount: 1,
  totalFileCount: 1,
};

const scanBoundary: ScanBoundary = {
  source: 'git',
  gitignoreRespected: true,
  includeIgnored: false,
  ignoredFileCount: 0,
};

const scanResult: ScanResult = {
  rootPath: '/repo',
  totalFiles: 1,
  totalDirectories: 1,
  files: [fileEntry],
  directoryTree: directoryNode,
  scanDurationMs: 7,
  scanBoundary,
};

const languageStat: LanguageStat = {
  name: 'TypeScript',
  fileCount: 1,
  percentage: 100,
  extensions: ['.ts'],
};

const languageBreakdown: LanguageBreakdown = {
  primary: 'TypeScript',
  languages: {
    TypeScript: languageStat,
  },
};

const detectedFramework: DetectedFramework = {
  name: 'Vitest',
  category: 'testing',
  confidence: 'high',
};

const frameworkResult: FrameworkResult = {
  frameworks: [detectedFramework],
  buildTools: ['tsc'],
  packageManager: 'npm',
};

const dependencyRisk: DependencyRisk = {
  name: 'example',
  reason: 'compile check',
  severity: 'low',
  workspace: 'root',
};

const licenseEntry: DependencyLicenseEntry = {
  name: 'example',
  version: '1.0.0',
  scope: 'development',
  license: 'MIT',
  workspace: 'root',
};

const licenseSummary: DependencyLicenseSummary = {
  packages: [licenseEntry],
  byLicense: {
    MIT: 1,
  },
  unknown: [],
  copyleft: [],
  noticeCandidates: [licenseEntry],
};

const sizeEntry: DependencySizeEntry = {
  name: 'example',
  version: '1.0.0',
  scope: 'development',
  bytes: 10,
  formatted: '10 B',
  installed: true,
  workspace: 'root',
};

const sizeSummary: DependencySizeSummary = {
  packages: [sizeEntry],
  largest: [sizeEntry],
  totalBytes: 10,
  formattedTotal: '10 B',
  missing: [],
};

const dependencyReport: DependencyReport = {
  totalDependencies: 0,
  totalDevDependencies: 1,
  dependencies: {},
  devDependencies: {
    example: '^1.0.0',
  },
  risks: [dependencyRisk],
  licenses: licenseSummary,
  sizes: sizeSummary,
  byWorkspace: [
    {
      workspace: 'root',
      relativePath: '.',
      isRoot: true,
      totalDependencies: 0,
      totalDevDependencies: 1,
      risks: [dependencyRisk],
    },
  ],
};

const importInfo: ImportInfo = {
  source: './types.js',
  specifiers: ['AnalysisReport'],
  isRelative: true,
};

const exportInfo: ExportInfo = {
  name: 'AnalysisReport',
  type: 'interface',
};

const fileExplanation: FileExplanation = {
  filePath: 'src/types.ts',
  purpose: 'Type barrel',
  imports: [importInfo],
  exports: [exportInfo],
  potentialIssues: [],
  lineCount: 1,
};

const architectureLayer: ArchitectureLayer = {
  name: 'Core',
  technologies: ['TypeScript'],
  directories: ['src/core'],
};

const issue: Issue = {
  id: 'compile-check',
  title: 'Compile check',
  description: 'Representative issue for analysis report compatibility.',
  severity: 'info',
  category: 'test',
  fixAvailable: false,
};

const analysisReport: AnalysisReport = {
  projectName: 'projscan',
  rootPath: '/repo',
  scan: scanResult,
  languages: languageBreakdown,
  frameworks: frameworkResult,
  dependencies: dependencyReport,
  issues: [issue],
  timestamp: '2026-06-16T00:00:00.000Z',
};

const healthScore: HealthScore = {
  score: 100,
  grade: 'A',
  errors: 0,
  warnings: 0,
  infos: 0,
};

const barrelFileEntry: BarrelFileEntry = fileEntry;
const barrelDirectoryNode: BarrelDirectoryNode = directoryNode;
const barrelScanBoundary: BarrelScanBoundary = scanBoundary;
const barrelScanResult: BarrelScanResult = scanResult;
const barrelLanguageStat: BarrelLanguageStat = languageStat;
const barrelLanguageBreakdown: BarrelLanguageBreakdown = languageBreakdown;
const barrelDetectedFramework: BarrelDetectedFramework = detectedFramework;
const barrelFrameworkResult: BarrelFrameworkResult = frameworkResult;
const barrelDependencyRisk: BarrelDependencyRisk = dependencyRisk;
const barrelLicenseEntry: BarrelDependencyLicenseEntry = licenseEntry;
const barrelLicenseSummary: BarrelDependencyLicenseSummary = licenseSummary;
const barrelSizeEntry: BarrelDependencySizeEntry = sizeEntry;
const barrelSizeSummary: BarrelDependencySizeSummary = sizeSummary;
const barrelDependencyReport: BarrelDependencyReport = dependencyReport;
const barrelFileExplanation: BarrelFileExplanation = fileExplanation;
const barrelArchitectureLayer: BarrelArchitectureLayer = architectureLayer;
const barrelAnalysisReport: BarrelAnalysisReport = analysisReport;
const barrelHealthScore: BarrelHealthScore = healthScore;

void [
  barrelFileEntry,
  barrelDirectoryNode,
  barrelScanBoundary,
  barrelScanResult,
  barrelLanguageStat,
  barrelLanguageBreakdown,
  barrelDetectedFramework,
  barrelFrameworkResult,
  barrelDependencyRisk,
  barrelLicenseEntry,
  barrelLicenseSummary,
  barrelSizeEntry,
  barrelSizeSummary,
  barrelDependencyReport,
  barrelFileExplanation,
  barrelArchitectureLayer,
  barrelAnalysisReport,
  barrelHealthScore,
];

test('scan and analysis public types compile from modules and legacy barrel', () => {
  expect(barrelAnalysisReport).toBe(analysisReport);
});
