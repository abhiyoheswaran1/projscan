import path from 'node:path';
import type { FileEntry } from '../../types.js';

const REQUIREMENTS_FILE_RE = /^requirements(-.*)?\.txt$/i;
const CONSTRAINTS_FILE_RE = /^constraints(-.*)?\.txt$/i;
const ROOT_PYTHON_MANIFEST_NAMES = new Set([
  'pyproject.toml',
  'setup.py',
  'setup.cfg',
  'poetry.lock',
  'Pipfile.lock',
  'pdm.lock',
  'uv.lock',
  'conda-lock.yml',
  'conda-lock.yaml',
]);

export function hasPythonProjectEvidence(files: FileEntry[]): boolean {
  return files.some(hasPythonEvidenceFile);
}

function hasPythonEvidenceFile(file: FileEntry): boolean {
  return file.extension === '.py' || file.extension === '.pyw' || isRootPythonManifestFile(file);
}

function isRootPythonManifestFile(file: FileEntry): boolean {
  if (file.directory && file.directory !== '.') return false;
  const name = path.basename(file.relativePath);
  return (
    ROOT_PYTHON_MANIFEST_NAMES.has(name) ||
    REQUIREMENTS_FILE_RE.test(name) ||
    CONSTRAINTS_FILE_RE.test(name)
  );
}
