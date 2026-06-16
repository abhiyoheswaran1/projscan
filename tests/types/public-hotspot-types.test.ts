import { expect, test } from 'vitest';
import '../../src/types/hotspots.js';
import type { AuthorShare, FileHotspot, HotspotReport } from '../../src/types/hotspots.js';
import type {
  AuthorShare as BarrelAuthorShare,
  FileHotspot as BarrelFileHotspot,
  HotspotReport as BarrelHotspotReport,
} from '../../src/types.js';

const authorShare: AuthorShare = {
  author: 'teammate@example.com',
  commits: 4,
  share: 0.8,
};

const hotspot: FileHotspot = {
  relativePath: 'src/core/start.ts',
  churn: 12,
  distinctAuthors: 2,
  daysSinceLastChange: 1,
  lineCount: 140,
  cyclomaticComplexity: 12,
  sizeBytes: 4200,
  issueCount: 1,
  issueIds: ['complexity-high'],
  riskScore: 76.5,
  reasons: ['high churn', 'high complexity'],
  primaryAuthor: authorShare.author,
  primaryAuthorShare: authorShare.share,
  busFactorOne: true,
  topAuthors: [authorShare],
  coverage: 72,
  accepted: false,
};

const report: HotspotReport = {
  available: true,
  window: { since: '30 days ago', commitsScanned: 42 },
  hotspots: [hotspot],
  totalFilesRanked: 1,
};

const barrelAuthorShare: BarrelAuthorShare = authorShare;
const barrelHotspot: BarrelFileHotspot = hotspot;
const barrelReport: BarrelHotspotReport = report;
const moduleReport: HotspotReport = barrelReport;

test('hotspot public types compile from the module and legacy barrel', () => {
  expect(barrelAuthorShare.share).toBe(0.8);
  expect(barrelHotspot.relativePath).toBe('src/core/start.ts');
  expect(moduleReport.hotspots).toEqual([hotspot]);
  expect(moduleReport.totalFilesRanked).toBe(1);
});
