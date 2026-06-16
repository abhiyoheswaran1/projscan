export interface PythonDeclaredDep {
  name: string;
  /** Raw version spec from the manifest (may be empty if unpinned). */
  versionSpec: string;
  /** Which file declared this dep. */
  source: string;
  /** 1-based line in the source file, or 0 if unknown. */
  line: number;
  /** main (runtime) vs dev (test/lint groups). */
  scope: 'main' | 'dev';
}

export interface PythonLockedDep {
  name: string;
  version: string;
  /** Lockfile or pinned requirements file that supplied this version. */
  source: string;
  /** 1-based line in the source file, or 0 if unknown. */
  line: number;
}

export interface PythonProjectInfo {
  /** Directories under which `from pkg import ...` should resolve. */
  packageRoots: string[];
  /** pyproject.toml / setup.py / setup.cfg path (relative to repo root), if any. */
  manifestFiles: string[];
  /** Declared dependencies across all manifests. */
  declared: PythonDeclaredDep[];
  /** Resolved/current versions from supported local lockfiles, pinned requirements, or constraints. */
  locked: PythonLockedDep[];
  /** Lockfiles present (poetry/Pipfile/PDM/uv/Conda locks, pinned requirements, or pinned constraints). */
  hasLockfile: boolean;
}
