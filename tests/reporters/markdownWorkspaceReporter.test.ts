import { describe, it, expect } from 'vitest';
import { reportWorkspacesMarkdown } from '../../src/reporters/markdownWorkspaceReporter.js';
import { reportWorkspacesMarkdown as reportWorkspacesMarkdownFromMarkdownReporter } from '../../src/reporters/markdownReporter.js';
import type { WorkspaceInfo } from '../../src/types.js';
import { captureStdout } from './fixtures.js';

describe('markdownWorkspaceReporter', () => {
  it('preserves the markdownReporter re-export for existing callers', () => {
    expect(reportWorkspacesMarkdownFromMarkdownReporter).toBe(reportWorkspacesMarkdown);
  });

  it('renders a no-package workspace summary', async () => {
    const out = await captureStdout(() =>
      reportWorkspacesMarkdown({ kind: 'none', packages: [], source: undefined }),
    );

    expect(out).toContain('# Workspaces');
    expect(out).toContain('_kind: **none** · 0 package(s)_');
    expect(out).toContain('No packages detected.');
  });

  it('renders workspace package rows with source, version fallbacks, and root marker', async () => {
    const out = await captureStdout(() => reportWorkspacesMarkdown(monorepoInfo()));

    expect(out).toContain('_kind: **pnpm** · source: pnpm-workspace.yaml · 3 package(s)_');
    expect(out).toContain('| Package | Path | Version | Root |');
    expect(out).toContain('| `root` | `.` | 0.0.0 | ✓ |');
    expect(out).toContain('| `app-web` | `apps/web` | 2.0.0 |  |');
    expect(out).toContain('| `lib-core` | `packages/core` | - |  |');
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
