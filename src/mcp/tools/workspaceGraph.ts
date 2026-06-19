import fs from 'node:fs/promises';
import path from 'node:path';
import type { McpTool } from './_shared.js';
import { loadWorkspace } from '../../core/workspace.js';
import { scanRepository } from '../../core/repositoryScanner.js';
import { buildCodeGraph, type CodeGraph } from '../../core/codeGraph.js';
import {
  loadJavaScriptProjectConfigs,
  resolveJavaScriptImportAbsolute,
} from '../../core/languages/javascriptProjectConfig.js';

/**
 * `projscan_workspace_graph` (1.6+) — cross-repo intelligence over the
 * sibling repos registered via `projscan workspace add`. Distinct from
 * `projscan_workspaces` (plural) which surfaces intra-repo monorepo
 * packages within a single codebase.
 *
 * Subactions:
 *   - "list" — registered repos with parsed-file counts.
 *   - "graph" — every shared symbol exported by ≥ 2 registered repos
 *     (a candidate refactor / API contract surface).
 *   - "file_importers" — given a file in one registered repo, list all
 *     repos whose graphs include that file as a local importer
 *     (cross-repo impact spotlight).
 *
 * Read-only; does not mutate workspace state.
 */
export const workspaceGraphTool: McpTool = {
  name: 'projscan_workspace_graph',
  description:
    'Cross-repo intelligence over sibling repos registered via `projscan workspace add`. Use to answer "what other repos import this file/symbol?" or "what symbols are shared across the workspace?" Read-only.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'graph', 'file_importers'],
        description:
          'Subaction. Default "list" returns the registered repos with file counts. "graph" returns every symbol exported by ≥ 2 repos. "file_importers" needs `file` (and optionally `repo`); returns the cross-repo importers list.',
      },
      file: {
        type: 'string',
        description:
          '"file_importers" only — repo-relative path inside the source repo (e.g. "src/auth.ts").',
      },
      repo: {
        type: 'string',
        description:
          '"file_importers" only — registered repo name (defaults to the cwd if registered).',
      },
    },
  },
  handler: async (args, rootPath) => {
    const action = typeof args.action === 'string' ? args.action : 'list';
    const workspace = await loadWorkspace(rootPath);
    if (!workspace || workspace.repos.length === 0) {
      return {
        action,
        available: false,
        reason:
          'No cross-repo workspace registered. Run `projscan workspace add <path>` to register sibling repos.',
        repos: [],
      };
    }

    switch (action) {
      case 'list':
        return await listView(workspace, rootPath);
      case 'graph':
        return await graphView(workspace);
      case 'file_importers': {
        const file = typeof args.file === 'string' ? args.file : '';
        const repo = typeof args.repo === 'string' ? args.repo : undefined;
        if (!file) {
          throw new Error(
            'file_importers requires a `file` argument (repo-relative path inside the source repo).',
          );
        }
        return await fileImportersView(workspace, rootPath, file, repo);
      }
      default:
        throw new Error(`Unknown action "${action}". Valid: list, graph, file_importers.`);
    }
  },
};

const MAX_WORKSPACE_GRAPH_FILES = 5000;
const SKIPPED_WORKSPACE_DIRS = new Set([
  '.git',
  '.projscan-cache',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
]);

interface RepoSummary {
  name: string;
  path: string;
  parsedFiles: number;
  exports: number;
}

async function buildPerRepoGraph(repoPath: string): Promise<CodeGraph | null> {
  try {
    const withinCap = await isWithinWorkspaceGraphFileCap(repoPath);
    if (!withinCap) return null;
    const scan = await scanRepository(repoPath);
    if (scan.files.length > MAX_WORKSPACE_GRAPH_FILES) return null;
    return await buildCodeGraph(repoPath, scan.files);
  } catch {
    return null;
  }
}

async function isWithinWorkspaceGraphFileCap(rootPath: string): Promise<boolean> {
  let count = 0;
  const stack = [rootPath];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIPPED_WORKSPACE_DIRS.has(entry.name)) stack.push(path.join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      count += 1;
      if (count > MAX_WORKSPACE_GRAPH_FILES) return false;
    }
  }
  return true;
}

async function listView(
  workspace: ReturnType<typeof loadWorkspace> extends Promise<infer T> ? T : never,
  rootPath: string,
): Promise<Record<string, unknown>> {
  if (!workspace) return { repos: [] };
  const summaries: RepoSummary[] = [];
  for (const repo of workspace.repos) {
    const graph = await buildPerRepoGraph(repo.path);
    if (!graph) {
      summaries.push({ name: repo.name, path: repo.path, parsedFiles: 0, exports: 0 });
      continue;
    }
    let exports = 0;
    for (const f of graph.files.values()) exports += f.exports.length;
    summaries.push({
      name: repo.name,
      path: repo.path,
      parsedFiles: graph.scannedFiles,
      exports,
    });
  }
  return {
    action: 'list',
    workspaceRoot: rootPath,
    totalRepos: workspace.repos.length,
    repos: summaries,
  };
}

async function graphView(
  workspace: ReturnType<typeof loadWorkspace> extends Promise<infer T> ? T : never,
): Promise<Record<string, unknown>> {
  if (!workspace) return { sharedSymbols: [] };
  const symbolToRepos = new Map<string, Set<string>>();
  for (const repo of workspace.repos) {
    const graph = await buildPerRepoGraph(repo.path);
    if (!graph) continue;
    for (const f of graph.files.values()) {
      for (const exp of f.exports) {
        if (!exp.name) continue;
        let set = symbolToRepos.get(exp.name);
        if (!set) {
          set = new Set();
          symbolToRepos.set(exp.name, set);
        }
        set.add(repo.name);
      }
    }
  }
  const shared = [...symbolToRepos.entries()]
    .filter(([, repos]) => repos.size >= 2)
    .map(([symbol, repos]) => ({ symbol, repos: [...repos].sort() }))
    .sort((a, b) => b.repos.length - a.repos.length || a.symbol.localeCompare(b.symbol));
  return {
    action: 'graph',
    totalRepos: workspace.repos.length,
    sharedSymbolCount: shared.length,
    sharedSymbols: shared.slice(0, 200),
    truncated: shared.length > 200,
  };
}

async function fileImportersView(
  workspace: ReturnType<typeof loadWorkspace> extends Promise<infer T> ? T : never,
  rootPath: string,
  file: string,
  repoFilter: string | undefined,
): Promise<Record<string, unknown>> {
  if (!workspace) return { importers: [] };
  // Treat the file as living in a specific repo. If `repo` is given,
  // use that; otherwise assume the file is in the cwd-rooted repo.
  let sourceRepoPath = rootPath;
  if (repoFilter) {
    const match = workspace.repos.find((r) => r.name === repoFilter);
    if (!match) {
      throw new Error(
        `repo "${repoFilter}" is not registered. Run \`projscan workspace list\` to see options.`,
      );
    }
    sourceRepoPath = match.path;
  }

  const sourceAbs = path.resolve(sourceRepoPath, file);
  const importers: Array<{ repo: string; file: string; source: string }> = [];
  for (const repo of workspace.repos) {
    if (repo.path === sourceRepoPath) continue;
    const graph = await buildPerRepoGraph(repo.path);
    if (!graph) continue;
    const projectConfigs = await loadJavaScriptProjectConfigs(
      repo.path,
      [...graph.files.keys()].map((relativePath) => ({ relativePath })),
    );
    for (const f of graph.files.values()) {
      for (const imp of f.imports) {
        if (typeof imp.source !== 'string') continue;
        const resolved = await resolveJavaScriptImportAbsolute(
          repo.path,
          f.relativePath,
          imp.source,
          projectConfigs,
        );
        if (resolved && pathsReferToSameFile(resolved, sourceAbs)) {
          importers.push({ repo: repo.name, file: f.relativePath, source: imp.source });
        }
      }
    }
  }
  return {
    action: 'file_importers',
    file,
    sourceRepo: repoFilter ?? '(cwd)',
    importerCount: importers.length,
    importers: importers.slice(0, 200),
    truncated: importers.length > 200,
  };
}

function pathsReferToSameFile(a: string, b: string): boolean {
  const left = path.resolve(a);
  const right = path.resolve(b);
  return left === right || stripKnownSourceExtension(left) === stripKnownSourceExtension(right);
}

function stripKnownSourceExtension(value: string): string {
  return value.replace(/\.(?:[cm]?[jt]sx?|mts|cts)$/i, '');
}
