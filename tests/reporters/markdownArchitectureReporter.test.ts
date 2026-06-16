import { describe, it, expect } from 'vitest';
import {
  reportDiagramMarkdown,
  reportStructureMarkdown,
} from '../../src/reporters/markdownArchitectureReporter.js';
import {
  reportDiagramMarkdown as reportDiagramMarkdownFromMarkdownReporter,
  reportStructureMarkdown as reportStructureMarkdownFromMarkdownReporter,
} from '../../src/reporters/markdownReporter.js';
import type { ArchitectureLayer, DirectoryNode } from '../../src/types.js';
import { captureStdout } from './fixtures.js';

describe('markdownArchitectureReporter', () => {
  it('preserves markdownReporter re-exports for existing callers', () => {
    expect(reportDiagramMarkdownFromMarkdownReporter).toBe(reportDiagramMarkdown);
    expect(reportStructureMarkdownFromMarkdownReporter).toBe(reportStructureMarkdown);
  });

  it('renders architecture layers and directories', async () => {
    const layers: ArchitectureLayer[] = [
      { name: 'Frontend', technologies: ['React', 'Vite'], directories: ['src/ui', 'src/pages'] },
      { name: 'Core', technologies: ['TypeScript'], directories: ['src/core'] },
    ];

    const out = await captureStdout(() => reportDiagramMarkdown(layers));

    expect(out).toContain('# Project Architecture');
    expect(out).toContain('Frontend');
    expect(out).toContain('└─ React / Vite');
    expect(out).toContain('   └─ src/ui');
    expect(out).toContain('Core');
  });

  it('renders nested directory structure', async () => {
    const out = await captureStdout(() => reportStructureMarkdown(directoryTree()));

    expect(out).toContain('# Project Structure');
    expect(out).toContain('projscan/ (3 files)');
    expect(out).toContain('├── src/ (2 files)');
    expect(out).toContain('│   └── reporters/ (1 files)');
    expect(out).toContain('└── tests/ (1 files)');
  });
});

function directoryTree(): DirectoryNode {
  return {
    name: 'projscan',
    path: '/repo',
    fileCount: 0,
    totalFileCount: 3,
    children: [
      {
        name: 'src',
        path: '/repo/src',
        fileCount: 1,
        totalFileCount: 2,
        children: [
          {
            name: 'reporters',
            path: '/repo/src/reporters',
            fileCount: 1,
            totalFileCount: 1,
            children: [],
          },
        ],
      },
      {
        name: 'tests',
        path: '/repo/tests',
        fileCount: 1,
        totalFileCount: 1,
        children: [],
      },
    ],
  };
}
