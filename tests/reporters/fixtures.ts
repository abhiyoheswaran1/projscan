import type {
  AnalysisReport,
  AuditReport,
  DependencyReport,
  DiffResult,
  FileExplanation,
  HotspotReport,
  Issue,
  OutdatedReport,
  UpgradePreview,
} from '../../src/types.js';

export function makeIssue(partial: Partial<Issue> = {}): Issue {
  return {
    id: 'missing-readme',
    title: 'Missing README',
    description: 'No README file found.',
    severity: 'warning',
    category: 'architecture',
    fixAvailable: false,
    ...partial,
  };
}

export function makeAnalysisReport(overrides: Partial<AnalysisReport> = {}): AnalysisReport {
  return {
    projectName: 'test-project',
    rootPath: '/proj',
    scan: {
      rootPath: '/proj',
      totalFiles: 42,
      totalDirectories: 7,
      files: [],
      directoryTree: {
        name: 'test-project',
        path: '/proj',
        children: [],
        fileCount: 0,
        totalFileCount: 42,
      },
      scanDurationMs: 123,
    },
    languages: {
      primary: 'TypeScript',
      languages: {
        TypeScript: { name: 'TypeScript', fileCount: 30, percentage: 71.4, extensions: ['.ts'] },
        JavaScript: { name: 'JavaScript', fileCount: 12, percentage: 28.6, extensions: ['.js'] },
      },
    },
    frameworks: {
      frameworks: [{ name: 'React', category: 'frontend', confidence: 'high' }],
      buildTools: ['vite'],
      packageManager: 'npm',
    },
    dependencies: {
      totalDependencies: 5,
      totalDevDependencies: 3,
      dependencies: { react: '^18.0.0' },
      devDependencies: { vitest: '^2.0.0' },
      risks: [],
    },
    issues: [makeIssue()],
    timestamp: '2026-04-24T00:00:00.000Z',
    ...overrides,
  };
}

export function makeDependencyReport(): DependencyReport {
  return {
    totalDependencies: 2,
    totalDevDependencies: 1,
    dependencies: { react: '^18.0.0', lodash: '^4.0.0' },
    devDependencies: { vitest: '^2.0.0' },
    risks: [{ name: 'lodash', reason: 'heavy package', severity: 'medium' }],
  };
}

export function makeHotspotReport(): HotspotReport {
  return {
    available: true,
    window: { since: '2026-01-01', commitsScanned: 100 },
    hotspots: [
      {
        relativePath: 'src/big.ts',
        churn: 20,
        distinctAuthors: 3,
        daysSinceLastChange: 2,
        lineCount: 500,
        sizeBytes: 10000,
        issueCount: 1,
        issueIds: ['missing-readme'],
        riskScore: 85,
        reasons: ['high churn', 'many authors'],
        primaryAuthor: 'Alice',
        primaryAuthorShare: 0.6,
        busFactorOne: false,
        topAuthors: [{ author: 'Alice', commits: 12, share: 0.6 }],
      },
    ],
    totalFilesRanked: 1,
  };
}

export function makeOutdatedReport(): OutdatedReport {
  return {
    available: true,
    totalPackages: 1,
    packages: [
      {
        name: 'react',
        declared: '^17.0.0',
        installed: '17.0.2',
        latest: '18.2.0',
        drift: 'major',
        scope: 'dependency',
      },
    ],
  };
}

export function makeAuditReport(): AuditReport {
  return {
    available: true,
    summary: { critical: 0, high: 1, moderate: 0, low: 0, info: 0 },
    findings: [
      {
        name: 'vulnerable-pkg',
        severity: 'high',
        title: 'Prototype pollution',
        via: ['vulnerable-pkg'],
        fixAvailable: true,
      },
    ],
  };
}

export function makeUpgradePreview(): UpgradePreview {
  return {
    available: true,
    name: 'react',
    declared: '^17.0.0',
    installed: '17.0.2',
    latest: '18.2.0',
    drift: 'major',
    breakingMarkers: ['BREAKING CHANGE: removed x'],
    importers: ['src/App.tsx'],
  };
}

export function makeDiff(): DiffResult {
  return {
    before: {
      score: 80,
      grade: 'B',
      issues: [{ id: 'old-issue', title: 'old', severity: 'warning' }],
      timestamp: '2026-04-01T00:00:00.000Z',
    },
    after: {
      score: 75,
      grade: 'C',
      issues: [{ id: 'new-issue', title: 'new', severity: 'error' }],
      timestamp: '2026-04-24T00:00:00.000Z',
    },
    scoreDelta: -5,
    newIssues: ['new-issue'],
    resolvedIssues: ['old-issue'],
  };
}

export function makeExplanation(): FileExplanation {
  return {
    filePath: 'src/index.ts',
    purpose: 'Entry point',
    imports: [{ source: 'react', specifiers: ['default'], isRelative: false }],
    exports: [{ name: 'App', type: 'function' }],
    potentialIssues: [],
    lineCount: 42,
  };
}

/**
 * Capture everything written to console.log during `fn`, returning the
 * concatenated output. Restores the original console.log even on error.
 */
export async function captureStdout(fn: () => void | Promise<void>): Promise<string> {
  const original = console.log;
  const chunks: string[] = [];
  console.log = (...args: unknown[]): void => {
    chunks.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };
  try {
    await fn();
  } finally {
    console.log = original;
  }
  return chunks.join('\n');
}

// Strip ANSI escape sequences so we can assert on plain text.
// Ref: https://github.com/chalk/ansi-regex
// eslint-disable-next-line no-control-regex
const ANSI_RE = /[][[()#;?]*(?:\d{1,4}(?:;\d{0,4})*)?[\d<=>A-ORZcf-nq-uy]/g;
export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '');
}
