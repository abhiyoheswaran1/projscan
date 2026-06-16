import { expect, test } from 'vitest';
import '../../src/types/prDiff.js';
import type { ExportRename, FileAstDiff, PrDiffReport } from '../../src/types/prDiff.js';
import type {
  ExportRename as BarrelExportRename,
  FileAstDiff as BarrelFileAstDiff,
  PrDiffReport as BarrelPrDiffReport,
} from '../../src/types.js';

const rename: ExportRename = {
  from: 'createReport',
  to: 'buildReport',
};

const fileDiff: FileAstDiff = {
  relativePath: 'src/core/prDiff.ts',
  status: 'modified',
  exportsAdded: ['buildReport'],
  exportsRemoved: [],
  exportsRenamed: [rename],
  importsAdded: ['../types/prDiff.js'],
  importsRemoved: ['../types.js'],
  callsAdded: ['buildReport'],
  callsRemoved: ['createReport'],
  cyclomaticDelta: 1,
  fanInDelta: 2,
};

const report: PrDiffReport = {
  available: true,
  base: { ref: 'main', resolvedSha: 'abc123' },
  head: { ref: 'HEAD', resolvedSha: 'def456' },
  filesAdded: ['src/new.ts'],
  filesRemoved: [],
  filesModified: [fileDiff],
  totalFilesChanged: 2,
};

const barrelRename: BarrelExportRename = rename;
const barrelFileDiff: BarrelFileAstDiff = fileDiff;
const barrelReport: BarrelPrDiffReport = report;
const moduleReport: PrDiffReport = barrelReport;

test('PR diff public types compile from the module and legacy barrel', () => {
  expect(barrelRename.to).toBe('buildReport');
  expect(barrelFileDiff.exportsRenamed).toEqual([rename]);
  expect(moduleReport.filesModified[0]?.fanInDelta).toBe(2);
  expect(moduleReport.totalFilesChanged).toBe(2);
});
