import path from 'node:path';
import type { FileEntry } from '../../types.js';

export function extractPyprojectRoots(content: string): string[] {
  const roots: string[] = [];

  // [tool.setuptools.packages.find] where = ['src']
  const findWhereRe = /\[tool\.setuptools\.packages\.find\]([\s\S]*?)(?=\n\[|$)/;
  const findMatch = findWhereRe.exec(content);
  if (findMatch) {
    const whereRe = /where\s*=\s*\[\s*([^\]]+?)\s*\]/;
    const whereMatch = whereRe.exec(findMatch[1]);
    if (whereMatch) {
      for (const s of extractStringList(whereMatch[1])) roots.push(s);
    }
  }

  // [tool.setuptools] package-dir or [tool.setuptools.package-dir] { '' = 'src' }
  const pkgDirRe = /package[-_]dir\s*=\s*\{[^}]*""\s*=\s*["']([^"']+)["']/;
  const pkgDirMatch = pkgDirRe.exec(content);
  if (pkgDirMatch) roots.push(pkgDirMatch[1]);

  // Poetry explicit packages: [tool.poetry] packages = [{ include = "foo", from = "src" }]
  const poetryPackagesRe = /\[tool\.poetry\][\s\S]*?packages\s*=\s*\[([\s\S]*?)\]/;
  const poetryPkg = poetryPackagesRe.exec(content);
  if (poetryPkg) {
    const fromRe = /from\s*=\s*["']([^"']+)["']/g;
    let m: RegExpExecArray | null;
    while ((m = fromRe.exec(poetryPkg[1]))) roots.push(m[1]);
  }

  return dedupe(roots);
}

export function inferRootsFromInitFiles(files: FileEntry[]): string[] {
  const initDirs = initDirectories(files);
  if (initDirs.size === 0) return [];
  return candidateRootParents(initDirs);
}

function initDirectories(files: FileEntry[]): Set<string> {
  const dirs = new Set<string>();
  for (const f of files) {
    if (isPackageInit(f)) dirs.add(normalizedPackageDir(f));
  }
  return dirs;
}

function isPackageInit(file: FileEntry): boolean {
  return path.basename(file.relativePath) === '__init__.py';
}

function normalizedPackageDir(file: FileEntry): string {
  return file.directory === '.' ? '' : file.directory;
}

function candidateRootParents(initDirs: Set<string>): string[] {
  const candidateParents = new Set<string>();
  for (const dir of initDirs) {
    appendCandidateRootParent(candidateParents, initDirs, dir);
  }
  return [...candidateParents];
}

function appendCandidateRootParent(
  candidateParents: Set<string>,
  initDirs: Set<string>,
  dir: string,
): void {
  const parent = packageParent(dir);
  if (initDirs.has(packageRootKey(parent))) return;
  candidateParents.add(parent);
}

function packageParent(dir: string): string {
  if (dir === '') return '.';
  return path.posix.dirname(dir);
}

function packageRootKey(parent: string): string {
  return parent === '.' ? '' : parent;
}

function extractStringList(fragment: string): string[] {
  const out: string[] = [];
  const re = /["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment))) out.push(m[1]);
  return out;
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}
