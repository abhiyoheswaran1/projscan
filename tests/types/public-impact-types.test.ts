import { expect, test } from 'vitest';
import '../../src/types/impact.js';
import type { ImpactBoundarySummary, ImpactNode, ImpactReport } from '../../src/types/impact.js';
import type {
  ImpactBoundarySummary as BarrelImpactBoundarySummary,
  ImpactNode as BarrelImpactNode,
  ImpactReport as BarrelImpactReport,
} from '../../src/types.js';

const node: ImpactNode = {
  file: 'packages/web/src/auth.ts',
  distance: 2,
  repo: 'web',
};

const boundary: ImpactBoundarySummary = {
  repo: 'web',
  packageName: '@acme/web',
  owner: 'platform',
  files: [node.file],
  reachableFiles: 1,
};

const report: ImpactReport = {
  available: true,
  target: { kind: 'symbol', value: 'loadToken' },
  definitionFiles: ['packages/core/src/token.ts'],
  directCallers: ['packages/api/src/session.ts'],
  reachable: [node],
  totalReachable: 1,
  totalReachableByRepo: { '(this repo)': 0, web: 1 },
  boundarySummary: [boundary],
  truncated: false,
  maxDistance: 10,
};

const barrelNode: BarrelImpactNode = node;
const barrelBoundary: BarrelImpactBoundarySummary = boundary;
const barrelReport: BarrelImpactReport = report;
const moduleReport: ImpactReport = barrelReport;

test('impact public types compile from the module and legacy barrel', () => {
  expect(barrelNode.repo).toBe('web');
  expect(barrelBoundary.reachableFiles).toBe(1);
  expect(moduleReport.target.value).toBe('loadToken');
  expect(moduleReport.boundarySummary).toEqual([boundary]);
});
