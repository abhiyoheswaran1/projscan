import { describe, expect, it } from 'vitest';
import { reportDiagram, reportStructure } from '../../src/reporters/consoleArchitectureReporter.js';
import {
  reportDiagram as reportDiagramFromConsoleReporter,
  reportStructure as reportStructureFromConsoleReporter,
} from '../../src/reporters/consoleReporter.js';
import type { ArchitectureLayer, DirectoryNode } from '../../src/types.js';
import { captureStdout, stripAnsi } from './fixtures.js';

async function capturePlain(fn: () => void): Promise<string> {
  return stripAnsi(await captureStdout(fn));
}

describe('consoleArchitectureReporter', () => {
  it('is re-exported from consoleReporter to preserve the public reporter API', () => {
    expect(reportDiagramFromConsoleReporter).toBe(reportDiagram);
    expect(reportStructureFromConsoleReporter).toBe(reportStructure);
  });

  it('renders architecture layers with technologies and directories', async () => {
    const out = await capturePlain(() => reportDiagram(architectureLayers()));

    expect(out).toContain('Project Architecture');
    expect(out).toContain('Frontend');
    expect(out).toContain('React / Vite');
    expect(out).toContain('src/ui');
    expect(out).toContain('Backend');
    expect(out).toContain('Node');
    expect(out).toContain('src/server');
  });

  it('uses Unknown for layers without detected technologies', async () => {
    const out = await capturePlain(() =>
      reportDiagram([{ name: 'Tooling', technologies: [], directories: [] }]),
    );

    expect(out).toContain('Tooling');
    expect(out).toContain('Unknown');
  });

  it('renders nested structure trees with a custom project title', async () => {
    const out = await capturePlain(() => reportStructure(directoryTree(), 'projscan'));

    expect(out).toContain('Project Structure');
    expect(out).toContain('projscan');
    expect(out).toContain('(6 files)');
    expect(out).toContain('src/');
    expect(out).toContain('(4 files)');
    expect(out).toContain('reporters/');
    expect(out).toContain('(2 files)');
    expect(out).toContain('tests/');
  });
});

function architectureLayers(): ArchitectureLayer[] {
  return [
    { name: 'Frontend', technologies: ['React', 'Vite'], directories: ['src/ui', 'src/styles'] },
    { name: 'Backend', technologies: ['Node'], directories: ['src/server'] },
  ];
}

function directoryTree(): DirectoryNode {
  return {
    name: 'root',
    path: '.',
    fileCount: 0,
    totalFileCount: 6,
    children: [
      {
        name: 'src',
        path: 'src',
        fileCount: 2,
        totalFileCount: 4,
        children: [
          {
            name: 'reporters',
            path: 'src/reporters',
            fileCount: 2,
            totalFileCount: 2,
            children: [],
          },
        ],
      },
      {
        name: 'tests',
        path: 'tests',
        fileCount: 2,
        totalFileCount: 2,
        children: [],
      },
    ],
  };
}
