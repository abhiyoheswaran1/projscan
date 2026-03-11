import path from 'node:path';
import { walkFiles } from '../utils/fileWalker.js';
import type { ScanResult, FileEntry, DirectoryNode } from '../types.js';

export async function scanRepository(rootPath: string): Promise<ScanResult> {
  const start = performance.now();
  const files = await walkFiles(rootPath);
  const directoryTree = buildDirectoryTree(files, rootPath);
  const directories = new Set(files.map((f) => f.directory));
  const scanDurationMs = performance.now() - start;

  return {
    rootPath,
    totalFiles: files.length,
    totalDirectories: directories.size,
    files,
    directoryTree,
    scanDurationMs,
  };
}

function buildDirectoryTree(files: FileEntry[], rootPath: string): DirectoryNode {
  const root: DirectoryNode = {
    name: path.basename(rootPath),
    path: '.',
    children: [],
    fileCount: 0,
    totalFileCount: 0,
  };

  const nodeMap = new Map<string, DirectoryNode>();
  nodeMap.set('.', root);

  for (const file of files) {
    const dir = file.directory;
    ensureNode(dir, nodeMap, root);
  }

  // Count files per directory
  for (const file of files) {
    const dir = file.directory === '' ? '.' : file.directory;
    const node = nodeMap.get(dir);
    if (node) {
      node.fileCount++;
    }
  }

  // Compute totalFileCount bottom-up
  computeTotalFileCount(root);

  // Sort children alphabetically
  sortTree(root);

  return root;
}

function ensureNode(
  dirPath: string,
  nodeMap: Map<string, DirectoryNode>,
  root: DirectoryNode,
): DirectoryNode {
  if (dirPath === '' || dirPath === '.') return root;

  const existing = nodeMap.get(dirPath);
  if (existing) return existing;

  const parentPath = path.dirname(dirPath);
  const parent = ensureNode(parentPath === '.' ? '.' : parentPath, nodeMap, root);

  const node: DirectoryNode = {
    name: path.basename(dirPath),
    path: dirPath,
    children: [],
    fileCount: 0,
    totalFileCount: 0,
  };

  parent.children.push(node);
  nodeMap.set(dirPath, node);
  return node;
}

function computeTotalFileCount(node: DirectoryNode): number {
  let total = node.fileCount;
  for (const child of node.children) {
    total += computeTotalFileCount(child);
  }
  node.totalFileCount = total;
  return total;
}

function sortTree(node: DirectoryNode): void {
  node.children.sort((a, b) => a.name.localeCompare(b.name));
  for (const child of node.children) {
    sortTree(child);
  }
}
