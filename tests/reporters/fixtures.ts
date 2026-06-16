import type {
  AnalysisReport,
  AuditReport,
  DependencyReport,
  DiffResult,
  FileExplanation,
  FileInspection,
  HotspotReport,
  Issue,
  OutdatedReport,
  ReviewReport,
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
    licenses: {
      packages: [
        { name: 'lodash', version: '^4.0.0', scope: 'production', license: 'MIT' },
        { name: 'react', version: '^18.0.0', scope: 'production', license: 'MIT' },
        { name: 'vitest', version: '^2.0.0', scope: 'development', license: 'MIT' },
      ],
      byLicense: { MIT: 3 },
      unknown: [],
      copyleft: [],
      noticeCandidates: [
        { name: 'lodash', version: '^4.0.0', scope: 'production', license: 'MIT' },
        { name: 'react', version: '^18.0.0', scope: 'production', license: 'MIT' },
        { name: 'vitest', version: '^2.0.0', scope: 'development', license: 'MIT' },
      ],
    },
    sizes: {
      packages: [
        {
          name: 'lodash',
          version: '^4.0.0',
          scope: 'production',
          bytes: 1_250_000,
          formatted: '1.2 MB',
          installed: true,
        },
        {
          name: 'react',
          version: '^18.0.0',
          scope: 'production',
          bytes: 95_000,
          formatted: '92.8 KB',
          installed: true,
        },
        {
          name: 'vitest',
          version: '^2.0.0',
          scope: 'development',
          bytes: null,
          formatted: 'not installed',
          installed: false,
        },
      ],
      largest: [
        {
          name: 'lodash',
          version: '^4.0.0',
          scope: 'production',
          bytes: 1_250_000,
          formatted: '1.2 MB',
          installed: true,
        },
        {
          name: 'react',
          version: '^18.0.0',
          scope: 'production',
          bytes: 95_000,
          formatted: '92.8 KB',
          installed: true,
        },
      ],
      totalBytes: 1_345_000,
      formattedTotal: '1.3 MB',
      missing: ['vitest'],
    },
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
        cyclomaticComplexity: 23,
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

export function makeFileInspection(overrides: Partial<FileInspection> = {}): FileInspection {
  return {
    relativePath: 'src/big.ts',
    exists: true,
    purpose: 'Source module',
    lineCount: 500,
    sizeBytes: 1536,
    imports: [
      { source: './local.js', specifiers: ['local'], isRelative: true },
      { source: 'chalk', specifiers: ['default'], isRelative: false },
    ],
    exports: [{ name: 'run', type: 'function' }],
    potentialIssues: ['Large file (500 lines) - consider splitting'],
    hotspot: {
      relativePath: 'src/big.ts',
      churn: 20,
      distinctAuthors: 1,
      daysSinceLastChange: 2,
      lineCount: 500,
      cyclomaticComplexity: 23,
      sizeBytes: 1536,
      issueCount: 1,
      issueIds: ['missing-readme'],
      riskScore: 85,
      reasons: ['high churn', 'bus factor 1'],
      primaryAuthor: 'alice@example.com',
      primaryAuthorShare: 0.75,
      busFactorOne: true,
      topAuthors: [{ author: 'alice@example.com', commits: 20, share: 1 }],
    },
    issues: [makeIssue({ title: 'Missing README', severity: 'warning' })],
    cyclomaticComplexity: 23,
    fanIn: 2,
    fanOut: 7,
    language: 'javascript',
    functions: [
      { name: 'riskier', line: 10, endLine: 30, cyclomaticComplexity: 12, fanIn: 1 },
      { name: 'small', line: 40, endLine: 45, cyclomaticComplexity: 2, fanIn: 0 },
    ],
    ...overrides,
  };
}

export function makeReviewReport(overrides: Partial<ReviewReport> = {}): ReviewReport {
  return {
    available: true,
    base: { ref: 'main', resolvedSha: 'abc1234567890' },
    head: { ref: 'feature/review', resolvedSha: 'def9876543210' },
    prDiff: {
      available: true,
      base: { ref: 'main', resolvedSha: 'abc1234567890' },
      head: { ref: 'feature/review', resolvedSha: 'def9876543210' },
      filesAdded: ['src/new.ts'],
      filesRemoved: [],
      filesModified: [],
      totalFilesChanged: 2,
    },
    changedFiles: [
      {
        relativePath: 'src/core/review.ts',
        status: 'modified',
        riskScore: 91.2,
        cyclomaticComplexity: 22,
        cyclomaticDelta: 5,
        exportsAdded: 1,
        exportsRemoved: 0,
        importsAdded: 1,
        importsRemoved: 0,
      },
      {
        relativePath: 'src/new.ts',
        status: 'added',
        riskScore: null,
        cyclomaticComplexity: null,
        cyclomaticDelta: null,
        exportsAdded: 1,
        exportsRemoved: 0,
        importsAdded: 0,
        importsRemoved: 0,
      },
    ],
    newCycles: [{ classification: 'new', files: ['src/a.ts', 'src/b.ts'], size: 2 }],
    riskyFunctions: [
      {
        file: 'src/core/review.ts',
        name: 'parseReview',
        line: 42,
        endLine: 58,
        cyclomaticComplexity: 16,
        baseCc: 9,
        reason: 'jumped',
      },
      {
        file: 'src/new.ts',
        name: 'newRisk',
        line: 3,
        endLine: 20,
        cyclomaticComplexity: 10,
        baseCc: null,
        reason: 'added',
      },
    ],
    dependencyChanges: [
      {
        workspace: '',
        manifestFile: 'package.json',
        added: [{ name: 'agentloopkit', version: '^0.33.0', kind: 'dev' }],
        removed: [{ name: 'old-tool', version: '^1.0.0', kind: 'dep' }],
        bumped: [{ name: 'projscan', from: '^4.2.0', to: '^4.3.0', kind: 'dep' }],
      },
    ],
    contractChanges: [],
    newTaintFlows: [],
    newDataflowRisks: [],
    verdict: 'block',
    summary: ['Maximum changed-file risk score is 91.2.'],
    ...overrides,
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
