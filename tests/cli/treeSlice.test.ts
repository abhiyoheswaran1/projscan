import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sliceCliTree } from '../../src/cli/treeSlice.js';
import type { DirectoryNode } from '../../src/types.js';

describe('sliceCliTree', () => {
  it('returns the matching tree node by path', () => {
    const root = directoryNode('.', [
      directoryNode('src', [directoryNode('src/core')]),
      directoryNode('tests'),
    ]);

    expect(sliceCliTree(root, 'src/core')).toBe(root.children[0].children[0]);
  });

  it('returns null when the target path is absent', () => {
    expect(sliceCliTree(directoryNode('.', [directoryNode('src')]), 'docs')).toBeNull();
  });

  it('keeps tree traversal out of the shared CLI orchestrator', () => {
    const sharedSource = readFileSync(path.join(process.cwd(), 'src/cli/_shared.ts'), 'utf8');
    expect(sharedSource).not.toContain('for (const child of node.children)');
    expect(sharedSource).toContain("from './treeSlice.js'");

    const treeSliceSource = readFileSync(path.join(process.cwd(), 'src/cli/treeSlice.ts'), 'utf8');
    expect(treeSliceSource).not.toContain("from './_shared.js'");
  });
});

function directoryNode(pathValue: string, children: DirectoryNode[] = []): DirectoryNode {
  return {
    name: path.posix.basename(pathValue),
    path: pathValue,
    children,
    fileCount: 0,
    totalFileCount: children.reduce((total, child) => total + child.totalFileCount, 0),
  };
}
