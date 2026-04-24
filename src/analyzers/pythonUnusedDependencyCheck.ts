import type { FileEntry, Issue } from '../types.js';
import { detectPythonProject } from '../core/languages/pythonManifests.js';
import { buildCodeGraph } from '../core/codeGraph.js';

// Packages whose presence in manifests is implicit (build-time, test-time,
// or tooling) and which typically won't appear in `import` statements.
const IMPLICIT_USE = new Set([
  'pytest',
  'pytest-cov',
  'pytest-mock',
  'pytest-asyncio',
  'pytest-xdist',
  'ruff',
  'black',
  'mypy',
  'coverage',
  'wheel',
  'build',
  'setuptools',
  'setuptools-scm',
  'pip',
  'pip-tools',
  'twine',
  'flake8',
  'pylint',
  'pyflakes',
  'isort',
  'bandit',
  'tox',
  'pre-commit',
  'hatch',
  'hatchling',
  'poetry-core',
  'maturin',
]);

/**
 * Normalize a package name for comparison. PyPI names are case-insensitive
 * and `_` / `-` / `.` are interchangeable per PEP 503.
 */
function normalize(name: string): string {
  return name.toLowerCase().replace(/[_.]/g, '-');
}

export async function check(rootPath: string, files: FileEntry[]): Promise<Issue[]> {
  const info = await detectPythonProject(rootPath, files);
  if (!info || info.declared.length === 0) return [];

  const pythonFiles = files.filter((f) => f.extension === '.py' || f.extension === '.pyw');
  if (pythonFiles.length === 0) return [];

  const graph = await buildCodeGraph(rootPath, pythonFiles);
  const usedPackages = new Set<string>();
  for (const pkg of graph.packageImporters.keys()) {
    usedPackages.add(normalize(pkg));
  }

  const issues: Issue[] = [];
  const seen = new Set<string>();

  for (const dep of info.declared) {
    const norm = normalize(dep.name);
    if (seen.has(norm)) continue;
    if (IMPLICIT_USE.has(norm)) continue;
    if (usedPackages.has(norm)) continue;

    seen.add(norm);
    issues.push({
      id: `unused-python-dependency-${dep.name}`,
      title: `Unused Python dependency: ${dep.name}`,
      description: `\`${dep.name}\` is declared in ${dep.source} but no source file imports it. Either remove it or add it to the implicit-use allowlist.`,
      severity: dep.scope === 'dev' ? 'info' : 'warning',
      category: 'dependencies',
      fixAvailable: false,
      locations: [{ file: dep.source, line: dep.line }],
    });
  }

  return issues;
}
