import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../types.js';

/**
 * Lightweight parsing of Python project manifests. We do NOT pull a TOML
 * parser - regex-based extraction is good enough for the 80% case where
 * projects use standard layouts. More sophisticated parsing is deferred.
 */

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

export interface PythonProjectInfo {
  /** Directories under which `from pkg import ...` should resolve. */
  packageRoots: string[];
  /** pyproject.toml / setup.py / setup.cfg path (relative to repo root), if any. */
  manifestFiles: string[];
  /** Declared dependencies across all manifests. */
  declared: PythonDeclaredDep[];
  /** Lockfiles present (any of poetry.lock, Pipfile.lock, pdm.lock, uv.lock, conda-lock.yml, requirements.txt with pins). */
  hasLockfile: boolean;
}

const LOCKFILES = [
  'poetry.lock',
  'Pipfile.lock',
  'pdm.lock',
  'uv.lock',
  'conda-lock.yml',
  'conda-lock.yaml',
];

export async function detectPythonProject(
  rootPath: string,
  files: FileEntry[],
): Promise<PythonProjectInfo | null> {
  const hasPython = files.some((f) => f.extension === '.py' || f.extension === '.pyw');
  if (!hasPython) return null;

  const roots: string[] = [];
  const manifestFiles: string[] = [];
  const declared: PythonDeclaredDep[] = [];

  const pyprojectPath = path.join(rootPath, 'pyproject.toml');
  const pyprojectContent = await tryRead(pyprojectPath);
  if (pyprojectContent !== null) {
    manifestFiles.push('pyproject.toml');
    declared.push(...parsePyproject(pyprojectContent));
    roots.push(...extractPyprojectRoots(pyprojectContent));
  }

  const setupCfgContent = await tryRead(path.join(rootPath, 'setup.cfg'));
  if (setupCfgContent !== null) {
    manifestFiles.push('setup.cfg');
    declared.push(...parseSetupCfg(setupCfgContent));
  }

  const setupPyContent = await tryRead(path.join(rootPath, 'setup.py'));
  if (setupPyContent !== null) {
    manifestFiles.push('setup.py');
    declared.push(...parseSetupPyInstallRequires(setupPyContent));
  }

  // Read requirements*.txt at repo root.
  const reqFiles = files
    .filter(
      (f) =>
        (!f.directory || f.directory === '.') &&
        /^requirements(-.*)?\.txt$/i.test(path.basename(f.relativePath)),
    )
    .map((f) => f.relativePath);

  for (const rel of reqFiles) {
    const content = await tryRead(path.join(rootPath, rel));
    if (content === null) continue;
    manifestFiles.push(rel);
    const isDev = /requirements(-test|-dev|-lint)\.txt$/i.test(rel);
    declared.push(...parseRequirements(content, rel, isDev ? 'dev' : 'main'));
  }

  // Infer package roots from __init__.py placement if none declared.
  if (roots.length === 0) {
    roots.push(...inferRootsFromInitFiles(files));
  }

  // Always fall back to repo root.
  if (roots.length === 0) roots.push('.');

  // Lockfile detection.
  let hasLockfile = false;
  for (const name of LOCKFILES) {
    const lockPath = path.join(rootPath, name);
    if ((await tryRead(lockPath)) !== null) {
      hasLockfile = true;
      break;
    }
  }
  if (!hasLockfile) {
    // requirements.txt with pinned versions counts as a lockfile for us.
    for (const rel of reqFiles) {
      const content = await tryRead(path.join(rootPath, rel));
      if (content !== null && hasPinnedRequirements(content)) {
        hasLockfile = true;
        break;
      }
    }
  }

  return {
    packageRoots: dedupe(roots),
    manifestFiles,
    declared,
    hasLockfile,
  };
}

async function tryRead(absolutePath: string): Promise<string | null> {
  try {
    return await fs.readFile(absolutePath, 'utf-8');
  } catch {
    return null;
  }
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

// ── pyproject.toml ───────────────────────────────────────────

export function parsePyproject(content: string): PythonDeclaredDep[] {
  const out: PythonDeclaredDep[] = [];

  // [project.dependencies] as a list of PEP 508 strings OR
  // [project] dependencies = [ ... ]
  const pep621Deps = extractListBlock(content, /(?:^|\n)\s*dependencies\s*=\s*\[/);
  for (const { name, versionSpec, line } of pep621Deps) {
    out.push({ name, versionSpec, source: 'pyproject.toml', line, scope: 'main' });
  }

  // [project.optional-dependencies] groups → all treated as 'dev'.
  // Entries may be inline (`test = ["a", "b"]`) OR multiline; iterate over all
  // string literals in the block rather than splitting by lines.
  const optBlockRe = /\[project\.optional-dependencies\]([\s\S]*?)(?=\n\[|$)/;
  const optMatch = optBlockRe.exec(content);
  if (optMatch) {
    const blockStart = optMatch.index + optMatch[0].indexOf(optMatch[1]);
    const block = optMatch[1];
    const stringRe = /["']([^"'\n]+)["']/g;
    let sm: RegExpExecArray | null;
    while ((sm = stringRe.exec(block))) {
      const { name, versionSpec } = splitPep508(sm[1]);
      if (!name) continue;
      const line = offsetToLine(content, blockStart + sm.index);
      out.push({ name, versionSpec, source: 'pyproject.toml', line, scope: 'dev' });
    }
  }

  // [tool.poetry.dependencies] / [tool.poetry.group.<name>.dependencies]
  const poetryMainRe = /\[tool\.poetry\.dependencies\]([\s\S]*?)(?=\n\[|\n\Z|$)/;
  const poetryMainMatch = poetryMainRe.exec(content);
  if (poetryMainMatch) {
    const offset = offsetToLine(content, poetryMainMatch.index);
    for (const { name, versionSpec, line } of parsePoetryKv(poetryMainMatch[1], offset)) {
      if (name === 'python') continue;
      out.push({ name, versionSpec, source: 'pyproject.toml', line, scope: 'main' });
    }
  }
  const poetryGroupRe = /\[tool\.poetry\.group\.[\w.-]+\.dependencies\]([\s\S]*?)(?=\n\[|\n\Z|$)/g;
  let gm: RegExpExecArray | null;
  while ((gm = poetryGroupRe.exec(content))) {
    const offset = offsetToLine(content, gm.index);
    for (const { name, versionSpec, line } of parsePoetryKv(gm[1], offset)) {
      out.push({ name, versionSpec, source: 'pyproject.toml', line, scope: 'dev' });
    }
  }

  return out;
}

function extractPyprojectRoots(content: string): string[] {
  const roots: string[] = [];

  // [tool.setuptools.packages.find] where = ['src']
  const findWhereRe = /\[tool\.setuptools\.packages\.find\]([\s\S]*?)(?=\n\[|\n\Z|$)/;
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

function parsePoetryKv(block: string, lineOffset: number): { name: string; versionSpec: string; line: number }[] {
  const out: { name: string; versionSpec: string; line: number }[] = [];
  const lines = block.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/#.*$/, '').trim();
    if (!line) continue;
    // name = "^1.0.0" | name = { version = "...", ... }
    const m = /^([A-Za-z_][\w.-]*)\s*=\s*(.+)$/.exec(line);
    if (!m) continue;
    const name = m[1];
    let versionSpec = m[2].trim();
    if (versionSpec.startsWith('{')) {
      const vm = /version\s*=\s*["']([^"']+)["']/.exec(versionSpec);
      versionSpec = vm ? vm[1] : '';
    } else if (/^["']/.test(versionSpec)) {
      versionSpec = versionSpec.replace(/^["']|["']$/g, '');
    }
    out.push({ name, versionSpec, line: lineOffset + i + 1 });
  }
  return out;
}

function extractListBlock(
  content: string,
  opener: RegExp,
): { name: string; versionSpec: string; line: number }[] {
  const m = opener.exec(content);
  if (!m) return [];
  // Find the matching ']' by simple bracket-depth scan from the '['.
  const start = content.indexOf('[', m.index);
  if (start < 0) return [];
  let depth = 1;
  let end = start + 1;
  while (end < content.length && depth > 0) {
    const ch = content[end];
    if (ch === '[') depth++;
    else if (ch === ']') depth--;
    end++;
  }
  const inside = content.slice(start + 1, end - 1);
  const baseLine = offsetToLine(content, start + 1);
  return extractListValues(inside, baseLine);
}

function extractListValues(
  block: string,
  lineOffset: number,
): { name: string; versionSpec: string; line: number }[] {
  const out: { name: string; versionSpec: string; line: number }[] = [];
  const lines = block.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].replace(/#.*$/, '').trim();
    // Entries look like  "requests>=2.25.0",
    const m = /^["']([^"']+)["']/.exec(stripped);
    if (!m) continue;
    const { name, versionSpec } = splitPep508(m[1]);
    if (!name) continue;
    out.push({ name, versionSpec, line: lineOffset + i });
  }
  return out;
}

function extractStringList(fragment: string): string[] {
  const out: string[] = [];
  const re = /["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment))) out.push(m[1]);
  return out;
}

function offsetToLine(content: string, offset: number): number {
  let line = 0;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') line++;
  }
  return line + 1;
}

// ── setup.py / setup.cfg ──────────────────────────────────────

function parseSetupPyInstallRequires(content: string): PythonDeclaredDep[] {
  const out: PythonDeclaredDep[] = [];
  const m = /install_requires\s*=\s*\[([\s\S]*?)\]/.exec(content);
  if (!m) return out;
  const inside = m[1];
  const baseLine = offsetToLine(content, m.index + m[0].indexOf('['));
  for (const { name, versionSpec, line } of extractListValues(inside, baseLine)) {
    out.push({ name, versionSpec, source: 'setup.py', line, scope: 'main' });
  }
  return out;
}

function parseSetupCfg(content: string): PythonDeclaredDep[] {
  const out: PythonDeclaredDep[] = [];
  const m = /\[options\][\s\S]*?install_requires\s*=\s*([\s\S]*?)(?=\n\[|\n\n|\n\Z|$)/.exec(content);
  if (!m) return out;
  const baseLine = offsetToLine(content, m.index + m[0].indexOf('install_requires'));
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].replace(/#.*$/, '').trim();
    if (!stripped) continue;
    const { name, versionSpec } = splitPep508(stripped);
    if (!name) continue;
    out.push({ name, versionSpec, source: 'setup.cfg', line: baseLine + i + 1, scope: 'main' });
  }
  return out;
}

// ── requirements.txt ──────────────────────────────────────────

export function parseRequirements(content: string, sourceFile: string, scope: 'main' | 'dev'): PythonDeclaredDep[] {
  const out: PythonDeclaredDep[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const stripped = raw.replace(/\s+#.*$/, '').trim();
    if (!stripped || stripped.startsWith('#')) continue;
    if (stripped.startsWith('-')) continue; // -r, -e, -c, etc.
    const { name, versionSpec } = splitPep508(stripped);
    if (!name) continue;
    out.push({ name, versionSpec, source: sourceFile, line: i + 1, scope });
  }
  return out;
}

function hasPinnedRequirements(content: string): boolean {
  for (const raw of content.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#') || line.startsWith('-')) continue;
    if (/==/.test(line)) return true;
  }
  return false;
}

// ── PEP 508 splitter ──────────────────────────────────────────

export function splitPep508(spec: string): { name: string; versionSpec: string } {
  // Strip environment markers: `foo; python_version < "3.10"`.
  const semi = spec.indexOf(';');
  let core = semi >= 0 ? spec.slice(0, semi) : spec;
  // Strip extras: `foo[extra1,extra2]`.
  core = core.replace(/\[[^\]]*\]/, '');
  core = core.trim();
  // Name is up to the first version-spec character or whitespace.
  const m = /^([A-Za-z_][\w.-]*)(.*)$/.exec(core);
  if (!m) return { name: '', versionSpec: '' };
  return { name: m[1].toLowerCase(), versionSpec: m[2].trim() };
}

// ── __init__.py-walk fallback ─────────────────────────────────

function inferRootsFromInitFiles(files: FileEntry[]): string[] {
  // Find every dir that contains __init__.py, then take the SHALLOWEST ones
  // whose parent is not itself an __init__.py holder - those parents are the
  // candidate source roots.
  const initDirs = new Set<string>();
  for (const f of files) {
    if (path.basename(f.relativePath) === '__init__.py') {
      initDirs.add(f.directory === '.' ? '' : f.directory);
    }
  }
  if (initDirs.size === 0) return [];

  const candidateParents = new Set<string>();
  for (const dir of initDirs) {
    const parent = dir === '' ? '.' : path.posix.dirname(dir);
    const parentKey = parent === '.' ? '' : parent;
    // Skip if parent also has __init__.py (that's a nested package).
    if (initDirs.has(parentKey)) continue;
    candidateParents.add(parent === '' ? '.' : parent);
  }
  return [...candidateParents];
}
