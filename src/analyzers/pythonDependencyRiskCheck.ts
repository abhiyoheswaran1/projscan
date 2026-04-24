import type { FileEntry, Issue, IssueSeverity } from '../types.js';
import { detectPythonProject } from '../core/languages/pythonManifests.js';

// Small, conservative seed lists. Easy to extend later.
const DEPRECATED_WARNING = new Set([
  'nose',
  'simplejson',
  'pycrypto',
  'mysql-python',
]);

const DEPRECATED_INFO = new Set([
  'python-dateutil',
]);

const HEAVY_INFO = new Set([
  'pandas',
  'numpy',
  'torch',
  'tensorflow',
]);

const DEPRECATION_REASONS: Record<string, string> = {
  nose: 'nose is retired. Use pytest instead.',
  simplejson: 'simplejson is no longer needed; the stdlib json module is equivalent for most use cases.',
  pycrypto: 'pycrypto is unmaintained. Use pycryptodome as a drop-in replacement.',
  'mysql-python': 'mysql-python is Python 2 only. Use mysqlclient or PyMySQL.',
  'python-dateutil': 'python-dateutil is heavy. Many use cases are now covered by stdlib datetime.',
};

const HEAVY_REASONS: Record<string, string> = {
  pandas: 'pandas is a heavy dependency (~30MB). Reach for it only if you actually need dataframes.',
  numpy: 'numpy is a heavy dependency (~15MB). Only pull it if you need numerical arrays.',
  torch: 'torch is a very heavy dependency. Consider torch-cpu if GPU is not needed.',
  tensorflow: 'tensorflow is a very heavy dependency. Consider tensorflow-cpu for inference-only use.',
};

export async function check(rootPath: string, files: FileEntry[]): Promise<Issue[]> {
  const info = await detectPythonProject(rootPath, files);
  if (!info) return [];

  const issues: Issue[] = [];
  const seen = new Set<string>();

  for (const dep of info.declared) {
    const id = `dep-risk-${dep.name}`;
    if (seen.has(id)) continue;

    if (DEPRECATED_WARNING.has(dep.name)) {
      seen.add(id);
      issues.push({
        id,
        title: `Deprecated Python package: ${dep.name}`,
        description: DEPRECATION_REASONS[dep.name] ?? `${dep.name} is deprecated.`,
        severity: 'error',
        category: 'dependencies',
        fixAvailable: false,
        locations: [{ file: dep.source, line: dep.line }],
      });
      continue;
    }

    if (DEPRECATED_INFO.has(dep.name)) {
      seen.add(id);
      issues.push({
        id,
        title: `Consider alternatives to ${dep.name}`,
        description: DEPRECATION_REASONS[dep.name] ?? `${dep.name} may be avoidable.`,
        severity: 'info',
        category: 'dependencies',
        fixAvailable: false,
        locations: [{ file: dep.source, line: dep.line }],
      });
      continue;
    }

    if (HEAVY_INFO.has(dep.name)) {
      seen.add(id);
      issues.push({
        id,
        title: `Heavy Python dependency: ${dep.name}`,
        description: HEAVY_REASONS[dep.name] ?? `${dep.name} is a heavy dependency.`,
        severity: 'info',
        category: 'dependencies',
        fixAvailable: false,
        locations: [{ file: dep.source, line: dep.line }],
      });
      continue;
    }

    // Wildcard / unpinned: only flag entries that came from a requirements file
    // (pyproject.toml dependency strings without a version spec are common and
    // not a smell). An empty versionSpec from requirements.txt IS a smell.
    if (
      dep.source.endsWith('.txt') &&
      (dep.versionSpec === '' || dep.versionSpec === '*')
    ) {
      seen.add(id);
      issues.push({
        id,
        title: `Unpinned Python dependency: ${dep.name}`,
        description: `\`${dep.name}\` in ${dep.source} has no version constraint. Pin to a specific version (==X.Y.Z) for reproducible builds.`,
        severity: 'error',
        category: 'dependencies',
        fixAvailable: false,
        locations: [{ file: dep.source, line: dep.line }],
      });
    }
  }

  // No-lockfile: only emit if there ARE declared deps AND no lockfile-like
  // thing exists. pyproject-only projects without a lockfile are fine for
  // library-style packages, so this is a warning not an error.
  if (!info.hasLockfile && info.declared.length > 0) {
    const severity: IssueSeverity = 'warning';
    issues.push({
      id: 'dep-risk-no-python-lockfile',
      title: 'No Python lockfile detected',
      description:
        'No lockfile (poetry.lock / Pipfile.lock / pdm.lock / uv.lock / conda-lock.yml) or pinned requirements.txt found. Builds may resolve different versions over time.',
      severity,
      category: 'dependencies',
      fixAvailable: false,
      locations: [{ file: info.manifestFiles[0] ?? 'pyproject.toml' }],
    });
  }

  return issues;
}
