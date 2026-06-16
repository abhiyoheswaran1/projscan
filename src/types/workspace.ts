export type WorkspaceKind = 'npm' | 'yarn' | 'pnpm' | 'nx' | 'turbo' | 'lerna' | 'none';

export interface WorkspacePackage {
  /** package.json `name` field, or directory basename when missing. */
  name: string;
  /** Workspace-relative path of the package root (no leading `/`, no trailing `/`). */
  relativePath: string;
  /** package.json `version` if available. */
  version?: string;
  /** True when this is the workspace root itself. */
  isRoot: boolean;
}

export interface WorkspaceInfo {
  kind: WorkspaceKind;
  /** All packages, including the root if it has its own package.json. */
  packages: WorkspacePackage[];
  /** Source manifest used to discover packages, e.g. "package.json#workspaces" or "pnpm-workspace.yaml". */
  source?: string;
}
