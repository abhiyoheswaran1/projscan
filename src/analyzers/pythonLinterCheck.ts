import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry, Issue } from '../types.js';

const LINTER_CONFIG_FILES = [
  'ruff.toml',
  '.ruff.toml',
  '.flake8',
  '.pylintrc',
  'pylintrc',
];

const FORMATTER_CONFIG_FILES = [
  '.autopep8',
  '.yapfrc',
  'yapf.ini',
];

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

  const rootBasenames = new Set(
    files
      .filter((f) => !f.directory || f.directory === '.')
      .map((f) => path.basename(f.relativePath)),
  );

  const pyproject = await tryRead(path.join(rootPath, 'pyproject.toml'));
  const setupCfg = await tryRead(path.join(rootPath, 'setup.cfg'));
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
  const manifestHaystack = [pyproject ?? '', setupCfg ?? '', requirementsBlob].join('\n');

  // ── Linter detection ──
  let hasLinter = false;
  for (const f of LINTER_CONFIG_FILES) {
    if (rootBasenames.has(f)) {
      hasLinter = true;
      break;
    }
  }
  if (!hasLinter && pyproject) {
    if (/\[tool\.ruff\]|\[tool\.flake8\]|\[tool\.pylint\]|\[tool\.pylint\./.test(pyproject)) {
      hasLinter = true;
    }
  }
  if (!hasLinter && setupCfg) {
    if (/\[flake8\]|\[pylint\]/.test(setupCfg)) hasLinter = true;
  }
  if (!hasLinter) {
    for (const name of ['ruff', 'flake8', 'pylint', 'pyflakes']) {
      const re = new RegExp(
        `(^|[\\s"'\`\\[\\],={}><~^!;])${name}(\\b|[^a-zA-Z0-9_.-])`,
        'im',
      );
      if (re.test(manifestHaystack)) {
        hasLinter = true;
        break;
      }
    }
  }

  // ── Formatter detection ──
  // ruff also formats (ruff format), so if linter is ruff that satisfies formatter.
  let hasFormatter = false;
  for (const f of FORMATTER_CONFIG_FILES) {
    if (rootBasenames.has(f)) {
      hasFormatter = true;
      break;
    }
  }
  if (!hasFormatter && pyproject) {
    if (/\[tool\.black\]|\[tool\.autopep8\]|\[tool\.yapf\]|\[tool\.ruff\.format\]|\[tool\.ruff\]/.test(pyproject)) {
      hasFormatter = true;
    }
  }
  if (!hasFormatter && setupCfg) {
    if (/\[yapf\]/.test(setupCfg)) hasFormatter = true;
  }
  if (!hasFormatter) {
    for (const name of ['black', 'ruff', 'autopep8', 'yapf']) {
      const re = new RegExp(
        `(^|[\\s"'\`\\[\\],={}><~^!;])${name}(\\b|[^a-zA-Z0-9_.-])`,
        'im',
      );
      if (re.test(manifestHaystack)) {
        hasFormatter = true;
        break;
      }
    }
  }

  const issues: Issue[] = [];
  if (!hasLinter) {
    issues.push({
      id: 'missing-python-linter',
      title: 'No Python linter configured',
      description:
        'No ruff / flake8 / pylint configuration or dependency found. A linter catches bugs and enforces style.',
      severity: 'warning',
      category: 'linting',
      fixAvailable: false,
    });
  }
  if (!hasFormatter) {
    issues.push({
      id: 'missing-python-formatter',
      title: 'No Python formatter configured',
      description:
        'No black / ruff-format / autopep8 / yapf configuration or dependency found. A formatter ensures consistent code style.',
      severity: 'warning',
      category: 'formatting',
      fixAvailable: false,
    });
  }

  return issues;
}
