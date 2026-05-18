import path from 'node:path';
import fs from 'node:fs/promises';
import { explainFile as explainProjectFile } from '../../core/fileInspector.js';
import { detectWorkspaces } from '../../core/monorepo.js';
import type { FileEntry, FileExplanation, McpToolDefinition, DirectoryNode } from '../../types.js';

/**
 * 1.8+ — handlers may also receive an optional `context` object with
 * server-level capabilities (notify channel, watch registry). Existing
 * handlers ignore it and continue to read `args` + `rootPath` only;
 * new handlers (e.g., `projscan_review_watch`) opt in to use it.
 */
export interface McpToolContext {
  /**
   * Emit a JSON-RPC notification (no `id`) over the server's notify
   * channel. No-op when the server was started without a notify
   * channel (e.g., a CLI smoke test). Always returns true when the
   * channel is wired and the payload is valid; false otherwise.
   */
  notify?: (method: string, params: Record<string, unknown>) => boolean;
  /**
   * Register a long-running watch with the server. The server holds
   * the cancel handle and will invoke it when the connection closes,
   * preventing leaked timers. Returns a `watchId` the caller persists
   * so it can stop the watch later via `unregisterWatch`.
   */
  registerWatch?: (cancel: () => void) => string;
  /** Cancel a watch previously registered via `registerWatch`. */
  unregisterWatch?: (watchId: string) => boolean;
}

export interface McpToolHandler {
  (args: Record<string, unknown>, rootPath: string, context?: McpToolContext): Promise<unknown>;
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

export async function explainFile(absolutePath: string, rootPath: string): Promise<FileExplanation> {
  return await explainProjectFile(rootPath, path.relative(rootPath, absolutePath));
}
