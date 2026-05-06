import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Cross-repo workspace (1.6+).
 *
 * A workspace is a collection of registered sibling repos under a
 * common root directory. Used for multi-repo intelligence — e.g.
 * "what consumer apps import this SDK function?" or "did this PR
 * to the SDK introduce a taint flow that reaches consumer X?"
 *
 * Disambiguation: this is DIFFERENT from `src/core/monorepo.ts`'s
 * `WorkspaceInfo`, which detects intra-repo packages (npm/yarn/pnpm/
 * Lerna/Nx) within a single repo. The cross-repo workspace lives at
 * `<cwd>/.projscan-workspace.json`; the monorepo workspace is
 * detected from package.json/pnpm-workspace.yaml/etc.
 *
 * Local-only state. No network. Schema-versioned. Best-effort writes
 * (mirrors the session and memory modules' posture).
 */

export const WORKSPACE_SCHEMA_VERSION = 1;
const WORKSPACE_FILENAME = '.projscan-workspace.json';

export interface WorkspaceRepo {
  /** Absolute path to the registered repo's root. */
  path: string;
  /** Optional human-readable name. Defaults to basename(path). */
  name: string;
}

export interface Workspace {
  schemaVersion: number;
  /** ISO 8601 timestamp of workspace creation. */
  createdAt: string;
  /**
   * Registered sibling repos. Order is insertion order; first-registered
   * appears first. Duplicates (by absolute path) are rejected at add time.
   */
  repos: WorkspaceRepo[];
}

/**
 * Load the workspace at `rootPath` (the directory whose
 * `.projscan-workspace.json` we read). Returns null if the file is
 * missing, corrupt, or schema-mismatched. Never throws.
 */
export async function loadWorkspace(rootPath: string): Promise<Workspace | null> {
  const filePath = workspaceFilePath(rootPath);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isWorkspaceShape(parsed) || parsed.schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
    return null;
  }
  return parsed;
}

/**
 * Load the workspace, or create a fresh empty one. Useful for the
 * `add` flow where the file may not yet exist.
 */
export async function loadOrCreateWorkspace(rootPath: string): Promise<Workspace> {
  const loaded = await loadWorkspace(rootPath);
  if (loaded) return loaded;
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    repos: [],
  };
}

/**
 * Add a sibling repo to the workspace. `repoPath` is resolved to an
 * absolute path. Duplicate detection is by absolute path. Returns
 * the resulting repo entry; throws on validation errors.
 */
export function addRepo(workspace: Workspace, repoPath: string, name?: string): WorkspaceRepo {
  if (typeof repoPath !== 'string' || repoPath.length === 0) {
    throw new Error('Repo path is required.');
  }
  const absolute = path.resolve(repoPath);
  const existing = workspace.repos.find((r) => r.path === absolute);
  if (existing) {
    throw new Error(`Repo "${absolute}" is already registered (as "${existing.name}").`);
  }
  const repoName = (name && name.trim()) || path.basename(absolute);
  if (workspace.repos.some((r) => r.name === repoName)) {
    throw new Error(
      `A repo named "${repoName}" is already registered. Pass --name <new-name> to disambiguate.`,
    );
  }
  const entry: WorkspaceRepo = { path: absolute, name: repoName };
  workspace.repos.push(entry);
  return entry;
}

/**
 * Remove a sibling repo by absolute path or by name. Returns the
 * removed entry, or null if no match was found.
 */
export function removeRepo(workspace: Workspace, pathOrName: string): WorkspaceRepo | null {
  if (typeof pathOrName !== 'string' || pathOrName.length === 0) return null;
  const absoluteCandidate = path.isAbsolute(pathOrName) ? pathOrName : path.resolve(pathOrName);
  const idx = workspace.repos.findIndex(
    (r) => r.path === absoluteCandidate || r.name === pathOrName,
  );
  if (idx < 0) return null;
  const [removed] = workspace.repos.splice(idx, 1);
  return removed;
}

/**
 * Persist the workspace. Best-effort — failures are swallowed so a
 * transient disk error doesn't break the calling tool. Mirrors the
 * session / memory modules.
 */
export async function saveWorkspace(rootPath: string, workspace: Workspace): Promise<void> {
  try {
    const filePath = workspaceFilePath(rootPath);
    await fs.writeFile(filePath, JSON.stringify(workspace, null, 2), 'utf-8');
  } catch {
    // best-effort
  }
}

function workspaceFilePath(rootPath: string): string {
  return path.join(rootPath, WORKSPACE_FILENAME);
}

function isWorkspaceShape(value: unknown): value is Workspace {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.schemaVersion === 'number' &&
    typeof v.createdAt === 'string' &&
    Array.isArray(v.repos) &&
    v.repos.every(
      (r: unknown) =>
        r !== null &&
        typeof r === 'object' &&
        typeof (r as Record<string, unknown>).path === 'string' &&
        typeof (r as Record<string, unknown>).name === 'string',
    )
  );
}
