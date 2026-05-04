import path from 'node:path';
import type { FileEntry } from '../../types.js';
import type { AstResult } from '../ast.js';
import { createParserFor } from './treeSitterLoader.js';
import { extractPhpImports } from './phpImports.js';
import { extractPhpExports } from './phpExports.js';
import { extractPhpCyclomatic } from './phpCyclomatic.js';
import { extractPhpFunctions } from './phpFunctions.js';
import { extractPhpCallSites } from './phpCallSites.js';
import { detectPhpProject, type PhpProjectInfo } from './phpManifests.js';
import type {
  GraphFileLike,
  LanguageAdapter,
  LanguageResolveContext,
} from './LanguageAdapter.js';

const PHP_EXTENSIONS = new Set(['.php']);
const MAX_PHP_FILE = 1024 * 1024;

let parserPromise: Promise<import('web-tree-sitter').Parser> | null = null;
async function getParser(): Promise<import('web-tree-sitter').Parser> {
  if (!parserPromise) parserPromise = createParserFor('tree-sitter-php.wasm');
  return parserPromise;
}

export const phpAdapter: LanguageAdapter = {
  id: 'php',
  extensions: PHP_EXTENSIONS,
  sourceExtensions: PHP_EXTENSIONS,
  // PHP has no barrel-file convention.
  barrelBasenames: new Set(),
  maxFileSize: MAX_PHP_FILE,

  async parse(_filePath: string, content: string): Promise<AstResult> {
    try {
      const parser = await getParser();
      const tree = parser.parse(content);
      if (!tree || !tree.rootNode) {
        return {
          ok: false,
          reason: 'tree-sitter returned null tree',
          imports: [],
          exports: [],
          callSites: [],
          lineCount: content ? content.split('\n').length : 0,
          cyclomaticComplexity: 0,
          functions: [],
        };
      }
      const root = tree.rootNode as unknown as Parameters<typeof extractPhpImports>[0];
      const imports = extractPhpImports(root);
      const exports = extractPhpExports(root as Parameters<typeof extractPhpExports>[0]);
      const cyclomaticComplexity = extractPhpCyclomatic(
        root as Parameters<typeof extractPhpCyclomatic>[0],
      );
      const callSites = extractPhpCallSites(
        root as Parameters<typeof extractPhpCallSites>[0],
      );
      const functions = extractPhpFunctions(
        root as Parameters<typeof extractPhpFunctions>[0],
      );
      return {
        ok: true,
        imports,
        exports,
        callSites,
        lineCount: content ? content.split('\n').length : 0,
        cyclomaticComplexity,
        functions,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        reason: `php parse failure: ${msg.slice(0, 120)}`,
        imports: [],
        exports: [],
        callSites: [],
        lineCount: content ? content.split('\n').length : 0,
        cyclomaticComplexity: 0,
        functions: [],
      };
    }
  },

  resolveImport(
    importingFile: string,
    source: string,
    graphFiles: Map<string, GraphFileLike>,
    context: LanguageResolveContext,
  ): string | null {
    return resolvePhpImport(importingFile, source, graphFiles, context);
  },

  toPackageName(source: string): string | null {
    if (!source) return null;
    // Relative include paths (./, ../, /) are local; resolveImport handles them.
    if (source.startsWith('./') || source.startsWith('../') || source.startsWith('/')) return null;
    if (source.includes('.php')) return null; // bare include path with extension
    // Namespace import: take the first segment as the "package". Composer
    // package names are vendor/name; we approximate by taking the top namespace.
    return source.split('\\')[0];
  },

  async preparePackageRoots(
    rootPath: string,
    files: FileEntry[],
  ): Promise<LanguageResolveContext> {
    const info = await detectPhpProject(rootPath, files);
    if (!info) return { packageRoots: [], meta: undefined };
    const projectRel = path.relative(rootPath, info.projectRoot) || '.';
    return {
      packageRoots: [projectRel],
      meta: { phpProject: info },
    };
  },
};

/**
 * Resolve a PHP import to a repo-local file or null.
 *
 * Two import shapes:
 *   1. Namespace use: `use Foo\Bar\Baz;` — match the longest PSR-4 prefix
 *      from composer.json autoload, replace it with the prefix's source
 *      root, append the remaining segments as directories, append `.php`.
 *      Example with `psr-4: { "App\\": "src" }`:
 *        "App\\Models\\User"  →  src/Models/User.php
 *   2. Include path: `require 'path/to/file.php';` — relative to the
 *      including file's directory; literal probe.
 */
function resolvePhpImport(
  importingFile: string,
  source: string,
  graphFiles: Map<string, GraphFileLike>,
  context: LanguageResolveContext,
): string | null {
  if (!source) return null;

  // Include-path form (literal `.php` filename).
  if (source.endsWith('.php') || source.startsWith('./') || source.startsWith('../') || source.startsWith('/')) {
    const importingDir = path.posix.dirname(importingFile);
    const stripped = source.startsWith('/') ? source.slice(1) : source;
    const joined = path.posix.normalize(path.posix.join(importingDir, stripped));
    if (graphFiles.has(joined)) return joined;
    return null;
  }

  // Namespace use form. Resolve via PSR-4 if we have a Composer project.
  const project = (context.meta as { phpProject?: PhpProjectInfo } | undefined)?.phpProject;
  if (!project || project.psr4.length === 0) return null;

  // Composer namespaces use `\` as the separator; in JSON the convention is
  // `\\` (escaped). The grammar's qualified_name preserves single
  // backslashes. We compare against composer.json prefixes that are also
  // single-backslash because we already json-parsed them.
  for (const { prefix, root } of project.psr4) {
    if (source === prefix.replace(/\\$/, '')) {
      // Exact namespace - usually doesn't resolve to a file, but try
      // <root>/<index>.php as a courtesy.
      continue;
    }
    if (source.startsWith(prefix)) {
      const remainder = source.slice(prefix.length);
      const segments = remainder.split('\\').filter(Boolean);
      // Build the candidate. The composer root path is relative to the
      // project root; the project root is the first packageRoot.
      const projectRel = (context.packageRoots ?? ['.'])[0] ?? '.';
      const projectSegs = projectRel === '.' || projectRel === '' ? [] : projectRel.split('/').filter(Boolean);
      const rootSegs = root.split('/').filter(Boolean);
      const candidate = [...projectSegs, ...rootSegs, ...segments].join('/') + '.php';
      if (graphFiles.has(candidate)) return candidate;
    }
  }
  return null;
}
