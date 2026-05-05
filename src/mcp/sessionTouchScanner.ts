/**
 * Walk an arbitrary tool-result value and pull out repo-relative file
 * paths. Used by the MCP server dispatcher to auto-record session
 * touches after every tools/call response.
 *
 * Heuristic: collect string values found under any of TOUCH_KEYS, in
 * arrays whose keys are TOUCH_KEYS, or as top-level entries in objects
 * keyed by TOUCH_KEYS. Filter out paths that look absolute, contain
 * `..`, are URLs, or are clearly not source files (no `/` and no
 * recognized extension).
 *
 * The goal isn't to find *every* mention — it's to recognize the file
 * paths that projscan tools structurally surface (relativePath fields,
 * `paths` arrays from notifications, importer lists, etc.).
 */

const TOUCH_KEYS = new Set([
  'file',
  'files',
  'filePath',
  'path',
  'paths',
  'relativePath',
  'relativePaths',
  'from',
  'to',
  'definitions',
  'importers',
  'reachable',
  'changed',
  'added',
  'removed',
  'modified',
]);

const KNOWN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.py',
  '.go',
  '.java',
  '.rb',
  '.rs',
  '.php',
  '.cs',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.md',
]);

const MAX_DEPTH = 8;
const MAX_PATHS = 200;

export function extractTouchedPaths(value: unknown): string[] {
  const out = new Set<string>();
  walk(value, /* keyHint */ null, /* depth */ 0, out);
  return [...out].slice(0, MAX_PATHS);
}

function walk(value: unknown, keyHint: string | null, depth: number, out: Set<string>): void {
  if (out.size >= MAX_PATHS) return;
  if (depth > MAX_DEPTH) return;
  if (value == null) return;

  if (typeof value === 'string') {
    if (keyHint && TOUCH_KEYS.has(keyHint) && looksLikePath(value)) {
      out.add(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    // For an array, propagate the parent's key hint so `paths: [...]`
    // captures every entry.
    for (const item of value) walk(item, keyHint, depth + 1, out);
    return;
  }

  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      walk(v, k, depth + 1, out);
    }
  }
}

function looksLikePath(s: string): boolean {
  if (s.length === 0 || s.length > 1024) return false;
  if (s.includes('..')) return false;
  if (s.startsWith('/')) return false;
  if (s.startsWith('http://') || s.startsWith('https://')) return false;
  if (s.startsWith('file://')) return false;
  // Disallow shell control chars and newlines.
  if (/[\n\r\t]/.test(s)) return false;
  // Accept either: contains `/` (suggests a path) OR has a known extension.
  const dot = s.lastIndexOf('.');
  const hasKnownExt = dot >= 0 && KNOWN_EXTENSIONS.has(s.slice(dot).toLowerCase());
  if (hasKnownExt) return true;
  if (s.includes('/') && /^[A-Za-z0-9._/@-]+$/.test(s)) return true;
  return false;
}
