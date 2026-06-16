import { describe, expect, it } from 'vitest';
import { reportWorkspaces } from '../../src/reporters/consoleWorkspaceReporter.js';
import { reportWorkspaces as reportWorkspacesFromConsoleReporter } from '../../src/reporters/consoleReporter.js';
import type { WorkspaceInfo } from '../../src/types.js';
import { captureStdout, stripAnsi } from './fixtures.js';

async function capturePlain(fn: () => void): Promise<string> {
  return stripAnsi(await captureStdout(fn));
}

describe('consoleWorkspaceReporter', () => {
  it('is re-exported from consoleReporter to preserve the public reporter API', () => {
    expect(reportWorkspacesFromConsoleReporter).toBe(reportWorkspaces);
  });

  it('renders single-package repos with the root package name and version', async () => {
    const out = await capturePlain(() =>
      reportWorkspaces({
        kind: 'none',
        packages: [{ name: 'projscan', relativePath: '.', version: '1.2.3', isRoot: true }],
      }),
    );

    expect(out).toContain('Workspaces');
    expect(out).toContain('Single-package repo (no monorepo workspaces detected).');
    expect(out).toContain('projscan');
    expect(out).toContain('1.2.3');
  });

  it('renders monorepo package rows with kind, source, version, path, and root tag', async () => {
    const out = await capturePlain(() => reportWorkspaces(monorepoInfo()));

    expect(out).toContain('Kind: pnpm');
    expect(out).toContain('Source: pnpm-workspace.yaml');
    expect(out).toContain('3 package(s)');
    expect(out).toContain('root');
    expect(out).toContain('v0.0.0');
    expect(out).toContain('(root)');
    expect(out).toContain('app-web');
    expect(out).toContain('apps/web');
    expect(out).toContain('lib-core');
    expect(out).toContain('packages/core');
  });

  it('uses a question mark when a workspace source is unavailable', async () => {
    const out = await capturePlain(() =>
      reportWorkspaces({
        kind: 'nx',
        packages: [{ name: 'api', relativePath: 'apps/api', isRoot: false }],
      }),
    );

    expect(out).toContain('Kind: nx');
    expect(out).toContain('Source: ?');
    expect(out).toContain('api');
    expect(out).toContain('apps/api');
  });
});

function monorepoInfo(): WorkspaceInfo {
  return {
    kind: 'pnpm',
    source: 'pnpm-workspace.yaml',
    packages: [
      { name: 'root', relativePath: '.', version: '0.0.0', isRoot: true },
      { name: 'app-web', relativePath: 'apps/web', version: '2.0.0', isRoot: false },
      { name: 'lib-core', relativePath: 'packages/core', isRoot: false },
    ],
  };
}
