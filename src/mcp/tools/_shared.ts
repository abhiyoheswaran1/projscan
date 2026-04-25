import path from 'node:path';
import fs from 'node:fs/promises';
import {
  extractImports,
  extractExports,
  inferPurpose,
  detectFileIssues,
} from '../../core/fileInspector.js';
import { detectWorkspaces } from '../../core/monorepo.js';
import type { FileEntry, FileExplanation, McpToolDefinition, DirectoryNode } from '../../types.js';

export interface McpToolHandler {
  (args: Record<string, unknown>, rootPath: string): Promise<unknown>;
}

export interface McpTool extends McpToolDefinition {
  handler: McpToolHandler;
}

/**
 * A repo is "Python-dominated" if it has a pyproject.toml OR setup.py AND
 * either no node_modules directory or no package.json.
 */
export async function isPythonDominated(rootPath: string, files: FileEntry[]): Promise<boolean> {
  const hasPython = files.some((f) => f.extension === '.py' || f.extension === '.pyw');
  if (!hasPython) return false;
  const manifests = ['pyproject.toml', 'setup.py', 'setup.cfg'];
  let hasPyManifest = false;
  for (const m of manifests) {
    try {
      await fs.access(path.join(rootPath, m));
      hasPyManifest = true;
      break;
    } catch {
      // next
    }
  }
  if (!hasPyManifest) return false;
  try {
    await fs.access(path.join(rootPath, 'package.json'));
    return false;
  } catch {
    return true;
  }
}

/**
 * Resolve the `package` arg to a (file -> boolean) filter, or null when
 * scoping wasn't requested.
 */
export async function resolvePackageFilter(
  rootPath: string,
  args: Record<string, unknown>,
): Promise<((file: string) => boolean) | null> {
  const name = typeof args.package === 'string' && args.package.length > 0 ? args.package : null;
  if (!name) return null;
  const ws = await detectWorkspaces(rootPath);
  const pkg = ws.packages.find((p) => p.name === name);
  if (!pkg) return () => false;
  if (pkg.isRoot) return () => true;
  const prefix = pkg.relativePath + '/';
  return (file: string) => file === pkg.relativePath || file.startsWith(prefix);
}

export const PACKAGE_ARG_SCHEMA = {
  type: 'string',
  description:
    'Optional. Workspace package name (from projscan_workspaces) to scope results to one package only.',
} as const;

/** Walk a DirectoryNode tree to find the node whose `path` equals targetPath. */
export function sliceTree(node: DirectoryNode, targetPath: string): DirectoryNode | null {
  if (node.path === targetPath) return node;
  for (const child of node.children) {
    const hit = sliceTree(child, targetPath);
    if (hit) return hit;
  }
  return null;
}

export function explainFile(absolutePath: string, content: string, rootPath: string): FileExplanation {
  const lines = content.split('\n');
  const imports = extractImports(content);
  const exports = extractExports(content);
  const purpose = inferPurpose(absolutePath, exports);
  const potentialIssues = detectFileIssues(content, lines.length);
  return {
    filePath: path.relative(rootPath, absolutePath),
    purpose,
    imports,
    exports,
    potentialIssues,
    lineCount: lines.length,
  };
}
