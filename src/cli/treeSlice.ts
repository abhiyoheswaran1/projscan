import type { DirectoryNode } from '../types.js';

/** Walk a DirectoryNode to find the node whose `path` matches targetPath. */
export function sliceCliTree(node: DirectoryNode, targetPath: string): DirectoryNode | null {
  if (node.path === targetPath) return node;
  for (const child of node.children) {
    const hit = sliceCliTree(child, targetPath);
    if (hit) return hit;
  }
  return null;
}
