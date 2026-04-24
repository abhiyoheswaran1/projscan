import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry, Issue } from '../types.js';

const TEST_FRAMEWORKS = ['pytest', 'unittest', 'nose', 'nose2', 'ward'];

function isPythonTestFile(rel: string): boolean {
  const base = path.basename(rel);
  if (/^test_.+\.py$/.test(base)) return true;
  if (/^.+_test\.py$/.test(base)) return true;
  if (rel.startsWith('tests/') || rel.includes('/tests/')) return base.endsWith('.py');
  return false;
}

async function tryRead(absolutePath: string): Promise<string | null> {
  try {
    return await fs.readFile(absolutePath, 'utf-8');
  } catch {
    return null;
  }
}

export async function check(rootPath: string, files: FileEntry[]): Promise<Issue[]> {
  const hasPython = files.some((f) => f.extension === '.py' || f.extension === '.pyw');
  if (!hasPython) return [];

  const pyproject = await tryRead(path.join(rootPath, 'pyproject.toml'));
  const setupCfg = await tryRead(path.join(rootPath, 'setup.cfg'));
  const pytestIni = await tryRead(path.join(rootPath, 'pytest.ini'));
  const toxIni = await tryRead(path.join(rootPath, 'tox.ini'));

  // Collect all requirements*.txt contents into one searchable blob.
  const reqRels = files
    .filter(
      (f) =>
        (!f.directory || f.directory === '.') &&
        /^requirements(-.*)?\.txt$/i.test(path.basename(f.relativePath)),
    )
    .map((f) => f.relativePath);
  let requirementsBlob = '';
  for (const rel of reqRels) {
    const content = await tryRead(path.join(rootPath, rel));
    if (content) requirementsBlob += content + '\n';
  }

  let hasFramework = false;

  const manifestHaystack = [pyproject ?? '', setupCfg ?? '', requirementsBlob].join('\n');
  for (const fw of TEST_FRAMEWORKS) {
    // Use a word-boundary-ish match so "pytest" doesn't spuriously match "pytest-cov"
    // for purposes of "is pytest the framework?" - but we also accept pytest-*, so
    // a simple case-insensitive containment is fine in practice.
    const re = new RegExp(`(^|[\\s"'\`\\[\\],={}><~^!;])${fw}(\\b|[^a-zA-Z0-9_.-])`, 'im');
    if (re.test(manifestHaystack)) {
      hasFramework = true;
      break;
    }
  }

  if (!hasFramework && pytestIni !== null) hasFramework = true;
  if (!hasFramework && toxIni !== null && /\[pytest\]|\[tool:pytest\]|pytest/i.test(toxIni)) {
    hasFramework = true;
  }
  if (!hasFramework && pyproject !== null && /\[tool\.pytest\.ini_options\]/.test(pyproject)) {
    hasFramework = true;
  }

  // Last-resort detection: `import unittest` (or `from unittest ...`) inside a
  // pytest-conventional test file. Some projects rely on stdlib unittest and
  // never declare a framework in manifests.
  const testFiles = files.filter((f) => isPythonTestFile(f.relativePath));
  if (!hasFramework) {
    for (const f of testFiles) {
      const content = await tryRead(f.absolutePath);
      if (content && /^\s*(import\s+unittest|from\s+unittest\s+import)/m.test(content)) {
        hasFramework = true;
        break;
      }
    }
  }

  const issues: Issue[] = [];
  if (!hasFramework) {
    issues.push({
      id: 'missing-python-test-framework',
      title: 'No Python test framework detected',
      description:
        'No pytest/unittest configuration or dependency found. Testing is essential for code quality and reliability.',
      severity: 'warning',
      category: 'testing',
      fixAvailable: false,
    });
  } else if (testFiles.length === 0) {
    issues.push({
      id: 'no-python-test-files',
      title: 'No Python test files found',
      description:
        'A Python test framework is configured but no test files were found (expected test_*.py, *_test.py, or under tests/).',
      severity: 'info',
      category: 'testing',
      fixAvailable: false,
    });
  }

  return issues;
}
