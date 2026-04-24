import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Parser, Language } from 'web-tree-sitter';

/**
 * Tree-sitter grammar version pinned for stability. Any grammar upgrade is a
 * semver-minor that must re-run parser tests - see ROADMAP.
 */
export const TREE_SITTER_PYTHON_VERSION = '0.25.0';

let parserInitPromise: Promise<void> | null = null;
const languageCache = new Map<string, Promise<Language>>();

/**
 * Resolve the directory that ships our vendored .wasm files.
 * - Installed case: `dist/grammars/` alongside the compiled JS.
 * - Dev case (running ts-node / vitest on src/): node_modules of the repo root.
 * The loader probes both and picks the first that exists.
 */
function grammarDirs(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const distDir = path.resolve(here, '..', '..', 'grammars');
  const repoRoot = path.resolve(here, '..', '..', '..');
  const nodeModulesWebTs = path.join(repoRoot, 'node_modules', 'web-tree-sitter');
  const nodeModulesPy = path.join(repoRoot, 'node_modules', 'tree-sitter-python');
  return [distDir, nodeModulesWebTs, nodeModulesPy];
}

function findWasm(filename: string): string {
  for (const dir of grammarDirs()) {
    const candidate = path.join(dir, filename);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Could not locate ${filename}. Searched: ${grammarDirs().join(', ')}. ` +
      `Run \`npm run build\` to populate dist/grammars/.`,
  );
}

/** Initialize the web-tree-sitter runtime. Idempotent. */
export async function ensureParserInit(): Promise<void> {
  if (parserInitPromise) return parserInitPromise;
  parserInitPromise = Parser.init({
    locateFile(name: string): string {
      if (name.endsWith('.wasm')) return findWasm(name);
      return name;
    },
  });
  return parserInitPromise;
}

/** Load a named grammar (e.g. 'tree-sitter-python.wasm'). Cached. */
export async function loadLanguage(wasmFilename: string): Promise<Language> {
  await ensureParserInit();
  let cached = languageCache.get(wasmFilename);
  if (!cached) {
    cached = (async (): Promise<Language> => {
      const wasmPath = findWasm(wasmFilename);
      const buf = await readFile(wasmPath);
      return Language.load(buf);
    })();
    languageCache.set(wasmFilename, cached);
  }
  return cached;
}

/** Build a parser pre-configured for a given grammar. */
export async function createParserFor(wasmFilename: string): Promise<Parser> {
  const language = await loadLanguage(wasmFilename);
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}

/** Reset the global caches. Tests only. */
export function __resetLoaderForTests(): void {
  parserInitPromise = null;
  languageCache.clear();
}
