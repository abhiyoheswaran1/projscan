import { expect, test } from 'vitest';
import '../../src/types/workspace.js';
import type { WorkspaceInfo, WorkspaceKind, WorkspacePackage } from '../../src/types/workspace.js';
import type {
  WorkspaceInfo as BarrelWorkspaceInfo,
  WorkspaceKind as BarrelWorkspaceKind,
  WorkspacePackage as BarrelWorkspacePackage,
} from '../../src/types.js';

const kinds: WorkspaceKind[] = ['npm', 'yarn', 'pnpm', 'nx', 'turbo', 'lerna', 'none'];

const workspacePackage: WorkspacePackage = {
  name: '@acme/core',
  relativePath: 'packages/core',
  version: '1.0.0',
  isRoot: false,
};

const workspaceInfo: WorkspaceInfo = {
  kind: 'pnpm',
  packages: [{ name: 'root', relativePath: '', isRoot: true }, workspacePackage],
  source: 'pnpm-workspace.yaml',
};

const barrelKind: BarrelWorkspaceKind = workspaceInfo.kind;
const barrelPackage: BarrelWorkspacePackage = workspacePackage;
const barrelInfo: BarrelWorkspaceInfo = workspaceInfo;
const moduleInfo: WorkspaceInfo = barrelInfo;

test('workspace public types compile from the module and legacy barrel', () => {
  expect(kinds).toEqual(['npm', 'yarn', 'pnpm', 'nx', 'turbo', 'lerna', 'none']);
  expect(barrelKind).toBe('pnpm');
  expect(barrelPackage.relativePath).toBe('packages/core');
  expect(moduleInfo.packages.map((pkg) => pkg.name)).toEqual(['root', '@acme/core']);
  expect(moduleInfo.source).toBe('pnpm-workspace.yaml');
});
