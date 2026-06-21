import { afterEach, expect, test, vi } from 'vitest';
import { computeBugHunt } from '../../src/core/bugHunt.js';
import { analyzeHotspots } from '../../src/core/hotspotAnalyzer.js';
import type { CodeGraph } from '../../src/core/codeGraph.js';
import type { FileEntry, FileHotspot } from '../../src/types.js';

const fileEntry: FileEntry = {
  relativePath: 'src/complex.ts',
  absolutePath: '/repo/src/complex.ts',
  extension: '.ts',
  directory: 'src',
  sizeBytes: 120,
};

const codeGraphState = vi.hoisted(() => ({
  graph: {
    files: new Map(),
    packageImporters: new Map(),
    localImporters: new Map(),
    symbolDefs: new Map(),
    scannedFiles: 0,
  } as CodeGraph,
  shouldThrow: false,
}));
const hotspotState = vi.hoisted(() => ({
  hotspots: [] as FileHotspot[],
}));

vi.mock('../../src/core/codeGraph.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/codeGraph.js')>();
  return {
    ...actual,
    buildCodeGraph: vi.fn(async () => {
      if (codeGraphState.shouldThrow) throw new Error('graph unavailable');
      return codeGraphState.graph;
    }),
  };
});

vi.mock('../../src/core/hotspotAnalyzer.js', () => ({
  analyzeHotspots: vi.fn(async () => ({
    available: true,
    window: { since: null, commitsScanned: 0 },
    hotspots: hotspotState.hotspots.length > 0 ? hotspotState.hotspots : [hotspot()],
    totalFilesRanked: hotspotState.hotspots.length || 1,
  })),
}));

vi.mock('../../src/core/repositoryScanner.js', () => ({
  scanRepository: vi.fn(async () => ({
    rootPath: '/repo',
    totalFiles: 1,
    totalDirectories: 1,
    files: [fileEntry],
    directoryTree: { name: '.', path: '.', files: [], children: [] },
    scanDurationMs: 1,
    scanBoundary: {
      source: 'glob',
      gitignoreRespected: true,
      includeIgnored: false,
      ignoredFileCount: 0,
    },
  })),
}));

vi.mock('../../src/core/issueEngine.js', () => ({
  collectIssues: vi.fn(async () => []),
}));

vi.mock('../../src/core/preflight.js', () => ({
  computePreflight: vi.fn(async () => ({
    verdict: 'proceed',
    reasons: [],
    requiredChecks: [],
    suggestedActions: [],
    evidence: { changedFiles: { files: [] } },
  })),
}));

vi.mock('../../src/core/sessionResources.js', () => ({
  buildRiskNow: vi.fn(async () => ({ touchedFiles: [], conflicts: [] })),
}));

afterEach(() => {
  codeGraphState.shouldThrow = false;
  hotspotState.hotspots = [];
  vi.mocked(analyzeHotspots).mockClear();
});

test('bug hunt uses graph-aware hotspot analysis when available', async () => {
  await computeBugHunt('/repo', { maxFindings: 3 });

  expect(vi.mocked(analyzeHotspots).mock.calls[0]?.[3]).toEqual(
    expect.objectContaining({ graph: codeGraphState.graph }),
  );
});

test('bug hunt falls back when graph-aware hotspot analysis is unavailable', async () => {
  codeGraphState.shouldThrow = true;

  const report = await computeBugHunt('/repo', { maxFindings: 3 });

  expect(report.topSuspects.some((finding) => finding.source === 'hotspot')).toBe(true);
  expect(vi.mocked(analyzeHotspots).mock.calls[0]?.[3]).toEqual(
    expect.not.objectContaining({ graph: expect.anything() }),
  );
});

test('bug hunt preserves analyzer order for same-priority hotspots', async () => {
  hotspotState.hotspots = [
    hotspot({ relativePath: 'src/z-risk.ts', riskScore: 120 }),
    hotspot({ relativePath: 'src/a-risk.ts', riskScore: 110 }),
  ];

  const report = await computeBugHunt('/repo', { maxFindings: 5 });
  const hotspotFiles = report.topSuspects
    .filter((finding) => finding.source === 'hotspot')
    .map((finding) => finding.files[0]);

  expect(hotspotFiles).toEqual(['src/z-risk.ts', 'src/a-risk.ts']);
});

function hotspot(overrides: Partial<FileHotspot> = {}): FileHotspot {
  return {
    relativePath: 'src/complex.ts',
    churn: 8,
    distinctAuthors: 1,
    daysSinceLastChange: 0,
    lineCount: 120,
    cyclomaticComplexity: 20,
    sizeBytes: 120,
    issueCount: 0,
    issueIds: [],
    riskScore: 100,
    reasons: ['high complexity'],
    primaryAuthor: 'dev@example.com',
    primaryAuthorShare: 1,
    busFactorOne: true,
    topAuthors: [{ author: 'dev@example.com', commits: 8, share: 1 }],
    coverage: null,
    ...overrides,
  };
}
