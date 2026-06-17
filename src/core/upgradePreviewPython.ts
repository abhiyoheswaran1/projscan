import type { FileEntry, UpgradePreview } from '../types.js';
import { drift as semverDrift } from '../utils/semver.js';
import { buildCodeGraph } from './codeGraph.js';
import {
  detectPythonProject,
  type PythonDeclaredDep,
  type PythonLockedDep,
} from './languages/pythonManifests.js';

export async function previewPythonUpgrade(
  rootPath: string,
  pkgName: string,
  files: FileEntry[],
): Promise<UpgradePreview | null> {
  const project = await detectPythonProject(rootPath, files);
  if (!project) return null;

  const dep = findPythonDeclaredDep(project.declared, pkgName);
  if (!dep) return unavailablePythonUpgrade(pkgName);

  const graph = await buildCodeGraph(rootPath, files);
  const importers = pythonFilesImporting(graph.packageImporters, pkgName);
  const locked = findPythonLockedDep(project.locked, pkgName);
  return pythonUpgradePreview(pkgName, dep, locked, importers);
}

function unavailablePythonUpgrade(pkgName: string): UpgradePreview {
  return {
    available: false,
    reason: `Python package "${pkgName}" not found in pyproject.toml, setup.cfg, setup.py, requirements*.txt, or requirements*.in`,
    name: pkgName,
    ecosystem: 'python',
    declared: null,
    installed: null,
    latest: null,
    drift: 'unknown',
    breakingMarkers: [],
    importers: [],
  };
}

function pythonUpgradePreview(
  pkgName: string,
  dep: PythonDeclaredDep,
  locked: PythonLockedDep | null,
  importers: string[],
): UpgradePreview {
  const currentVersion = locked?.version ?? null;

  return {
    available: true,
    name: pkgName,
    ecosystem: 'python',
    declared: dep.versionSpec || null,
    installed: currentVersion,
    latest: currentVersion,
    drift: currentVersion ? semverDrift(dep.versionSpec || null, currentVersion) : 'unknown',
    breakingMarkers: [],
    importers,
    declaredSource: dep.source,
    ...(dep.line > 0 ? { declaredLine: dep.line } : {}),
    declaredScope: dep.scope,
    ...(locked ? { installedSource: locked.source } : {}),
    ...(locked && locked.line > 0 ? { installedLine: locked.line } : {}),
  };
}

function findPythonDeclaredDep(deps: PythonDeclaredDep[], pkgName: string): PythonDeclaredDep | null {
  const normalized = normalizePythonPackageName(pkgName);
  return deps.find((dep) => normalizePythonPackageName(dep.name) === normalized) ?? null;
}

function findPythonLockedDep(deps: PythonLockedDep[], pkgName: string): PythonLockedDep | null {
  const normalized = normalizePythonPackageName(pkgName);
  return deps.find((dep) => normalizePythonPackageName(dep.name) === normalized) ?? null;
}

function pythonFilesImporting(packageImporters: Map<string, Set<string>>, pkgName: string): string[] {
  const normalized = normalizePythonPackageName(pkgName);
  const out = new Set<string>();
  for (const [pkg, importers] of packageImporters) {
    if (normalizePythonPackageName(pkg) !== normalized) continue;
    for (const file of importers) out.add(file);
  }
  return [...out].sort();
}

function normalizePythonPackageName(name: string): string {
  return name.trim().toLowerCase().replace(/[-_.]+/g, '-');
}
