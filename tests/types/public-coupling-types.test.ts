import { expect, test } from 'vitest';
import '../../src/types/coupling.js';
import type {
  CouplingReport,
  CrossPackageEdge,
  FileCoupling,
  ImportCycle,
} from '../../src/types/coupling.js';
import type {
  CouplingReport as BarrelCouplingReport,
  CrossPackageEdge as BarrelCrossPackageEdge,
  FileCoupling as BarrelFileCoupling,
  ImportCycle as BarrelImportCycle,
} from '../../src/types.js';

const fileCoupling: FileCoupling = {
  relativePath: 'src/core/couplingAnalyzer.ts',
  fanIn: 2,
  fanOut: 3,
  instability: 0.6,
};

const cycle: ImportCycle = {
  files: ['src/a.ts', 'src/b.ts'],
  size: 2,
};

const crossPackageEdge: CrossPackageEdge = {
  from: { file: 'packages/app/src/index.ts', package: '@acme/app' },
  to: { file: 'packages/core/src/index.ts', package: '@acme/core' },
};

const report: CouplingReport = {
  files: [fileCoupling],
  cycles: [cycle],
  crossPackageEdges: [crossPackageEdge],
  totalFiles: 1,
  totalCycles: 1,
  totalCrossPackageEdges: 1,
};

const barrelFileCoupling: BarrelFileCoupling = fileCoupling;
const barrelCycle: BarrelImportCycle = cycle;
const barrelCrossPackageEdge: BarrelCrossPackageEdge = crossPackageEdge;
const barrelReport: BarrelCouplingReport = report;
const moduleReport: CouplingReport = barrelReport;

test('coupling public types compile from the module and legacy barrel', () => {
  expect(barrelFileCoupling.instability).toBe(0.6);
  expect(barrelCycle.size).toBe(2);
  expect(barrelCrossPackageEdge.from.package).toBe('@acme/app');
  expect(moduleReport.totalFiles).toBe(1);
  expect(moduleReport.crossPackageEdges).toEqual([crossPackageEdge]);
});
