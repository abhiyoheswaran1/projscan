import type { FileEntry } from '../../types.js';
import { parseSource, type AstResult } from '../ast.js';
import type { GraphFileLike, LanguageAdapter, LanguageResolveContext } from './LanguageAdapter.js';
import { javascriptAdapter } from './javascriptAdapter.js';

/**
 * Single-file component formats whose script blocks are JavaScript/TypeScript.
 * These files import project modules, so they must contribute import edges to
 * the code graph — otherwise a module imported only from an `.astro` page reads
 * as orphaned and dead-code analysis reports a false positive.
 */
const COMPONENT_EXTENSIONS = new Set(['.astro', '.vue', '.svelte']);

/**
 * The script region of a component is real code, but the component file itself
 * is never a dead-code candidate: framework routers and template usage make its
 * "exports" reachable in ways the graph can't see. An empty `sourceExtensions`
 * says "parse me, never flag me".
 */
const NO_SOURCE_EXTENSIONS: ReadonlySet<string> = new Set();

/** Astro frontmatter: a `---` fence pair at the very top of the file. */
const ASTRO_FRONTMATTER = /^\s*---\r?\n([\s\S]*?)\r?\n?---/;

/** `<script>` … `</script>` blocks, as used by Vue and Svelte (and Astro). */
const SCRIPT_BLOCK = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;

/**
 * Extract script regions while preserving every byte offset: non-script
 * characters become spaces, newlines stay put. Keeping the original line and
 * column numbers means any location we report points at the right line of the
 * real component file rather than an offset into a stripped fragment.
 */
export function extractComponentScript(content: string): string {
  const kept = new Array<string>(content.length).fill(' ');
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n' || content[i] === '\r') kept[i] = content[i];
  }

  let found = false;
  const keepRegion = (start: number, end: number): void => {
    found = true;
    for (let i = start; i < end; i++) kept[i] = content[i];
  };

  const frontmatter = ASTRO_FRONTMATTER.exec(content);
  if (frontmatter && frontmatter[1] !== undefined) {
    const start = content.indexOf(frontmatter[1], frontmatter.index);
    if (start >= 0) keepRegion(start, start + frontmatter[1].length);
  }

  SCRIPT_BLOCK.lastIndex = 0;
  for (let match = SCRIPT_BLOCK.exec(content); match; match = SCRIPT_BLOCK.exec(content)) {
    const body = match[1];
    if (body === undefined) continue;
    const start = match.index + match[0].indexOf(body);
    keepRegion(start, start + body.length);
  }

  return found ? kept.join('') : '';
}

export const componentAdapter: LanguageAdapter = {
  id: 'component',
  extensions: COMPONENT_EXTENSIONS,
  sourceExtensions: NO_SOURCE_EXTENSIONS,
  barrelBasenames: new Set(),

  parse(filePath: string, content: string): AstResult {
    const script = extractComponentScript(content);
    // Parse as TypeScript: Astro frontmatter and `<script lang="ts">` are both
    // TS, and TS syntax in a plain `<script>` block is harmless to accept.
    return parseSource(`${filePath}.ts`, script);
  },

  resolveImport(
    importingFile: string,
    source: string,
    graphFiles: Map<string, GraphFileLike>,
    context: LanguageResolveContext,
  ): string | null {
    return javascriptAdapter.resolveImport(importingFile, source, graphFiles, context);
  },

  toPackageName(specifier: string): string | null {
    return javascriptAdapter.toPackageName(specifier);
  },

  preparePackageRoots(
    rootPath: string,
    files: FileEntry[],
  ): Promise<LanguageResolveContext> | LanguageResolveContext {
    // Component imports honour the same tsconfig/jsconfig path aliases as the
    // JS/TS files they sit beside.
    return javascriptAdapter.preparePackageRoots(rootPath, files);
  },
};
