import { parse, type ParserOptions } from '@babel/parser';
import type {
  File,
  ImportDeclaration,
  ExportNamedDeclaration,
  ExportAllDeclaration,
  Statement,
  VariableDeclaration,
  FunctionDeclaration,
  ClassDeclaration,
  TSInterfaceDeclaration,
  TSTypeAliasDeclaration,
  TSEnumDeclaration,
  Identifier,
  StringLiteral,
  Node,
} from '@babel/types';
import path from 'node:path';

export type SymbolKind =
  | 'function'
  | 'class'
  | 'variable'
  | 'type'
  | 'interface'
  | 'enum'
  | 'default'
  | 'unknown';

export interface AstImport {
  source: string;
  kind: 'static' | 'dynamic' | 'require' | 'reexport';
  specifiers: string[];
  typeOnly: boolean;
  line: number;
}

export interface AstExport {
  name: string;
  kind: SymbolKind;
  typeOnly: boolean;
  line: number;
}

export interface AstResult {
  ok: boolean;
  reason?: string;
  imports: AstImport[];
  exports: AstExport[];
  callSites: string[];
  lineCount: number;
}

const EMPTY: AstResult = {
  ok: false,
  reason: 'unparsed',
  imports: [],
  exports: [],
  callSites: [],
  lineCount: 0,
};

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
]);

/** Is this a file we should try to AST-parse at all? */
export function isParseable(filePath: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Parse a source file and extract imports, exports, and call sites.
 *
 * Uses @babel/parser with generous options so we accept real-world code:
 * TypeScript, JSX, decorators, top-level await, class properties, etc.
 *
 * Failures return ok:false with a reason - callers decide whether to fall
 * back to regex or skip the file. Never throws.
 */
export function parseSource(filePath: string, content: string): AstResult {
  if (!isParseable(filePath)) {
    return { ...EMPTY, reason: 'non-source extension' };
  }

  const ext = path.extname(filePath).toLowerCase();
  const isTypeScript = ext === '.ts' || ext === '.tsx' || ext === '.mts' || ext === '.cts';
  const isJSX = ext === '.tsx' || ext === '.jsx';

  const plugins: ParserOptions['plugins'] = [];
  if (isTypeScript) plugins.push('typescript');
  if (isJSX) plugins.push('jsx');
  plugins.push('decorators-legacy', 'dynamicImport', 'topLevelAwait');

  let ast: File;
  try {
    ast = parse(content, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
      errorRecovery: true,
      plugins,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...EMPTY, reason: `parse error: ${msg.slice(0, 120)}` };
  }

  const imports: AstImport[] = [];
  const exports: AstExport[] = [];
  const callSites: string[] = [];

  for (const node of ast.program.body) {
    visitTopLevel(node, imports, exports);
  }

  // Second pass: extract dynamic imports + call sites. Walk the whole tree
  // (cheap - we already have the AST in memory).
  walk(ast.program, (n) => {
    if (n.type === 'CallExpression') {
      const callee = n.callee;
      if (callee.type === 'Identifier') {
        callSites.push(callee.name);
      } else if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
        callSites.push(callee.property.name);
      } else if (callee.type === 'Import' && n.arguments[0] && n.arguments[0].type === 'StringLiteral') {
        imports.push({
          source: n.arguments[0].value,
          kind: 'dynamic',
          specifiers: [],
          typeOnly: false,
          line: n.loc?.start.line ?? 0,
        });
      }
      // CommonJS require()
      if (
        callee.type === 'Identifier' &&
        callee.name === 'require' &&
        n.arguments[0] &&
        n.arguments[0].type === 'StringLiteral'
      ) {
        imports.push({
          source: n.arguments[0].value,
          kind: 'require',
          specifiers: [],
          typeOnly: false,
          line: n.loc?.start.line ?? 0,
        });
      }
    }
  });

  return {
    ok: true,
    imports,
    exports,
    callSites: [...new Set(callSites)],
    lineCount: content ? content.split('\n').length : 0,
  };
}

function visitTopLevel(
  node: Statement,
  imports: AstImport[],
  exports: AstExport[],
): void {
  switch (node.type) {
    case 'ImportDeclaration': {
      imports.push(importFromNode(node));
      return;
    }
    case 'ExportNamedDeclaration': {
      collectNamedExport(node, exports, imports);
      return;
    }
    case 'ExportDefaultDeclaration': {
      exports.push({
        name: 'default',
        kind: 'default',
        typeOnly: false,
        line: node.loc?.start.line ?? 0,
      });
      return;
    }
    case 'ExportAllDeclaration': {
      const source = (node as ExportAllDeclaration).source.value;
      imports.push({
        source,
        kind: 'reexport',
        specifiers: [],
        typeOnly: Boolean((node as { exportKind?: string }).exportKind === 'type'),
        line: node.loc?.start.line ?? 0,
      });
      return;
    }
    default:
      return;
  }
}

function importFromNode(node: ImportDeclaration): AstImport {
  const specifiers = node.specifiers.map((s) => {
    if (s.type === 'ImportDefaultSpecifier') return 'default';
    if (s.type === 'ImportNamespaceSpecifier') return '*';
    if (s.type === 'ImportSpecifier') {
      const imported = s.imported;
      if (imported.type === 'Identifier') return imported.name;
      return (imported as StringLiteral).value;
    }
    return '';
  });
  return {
    source: (node.source as StringLiteral).value,
    kind: 'static',
    specifiers: specifiers.filter(Boolean),
    typeOnly: node.importKind === 'type',
    line: node.loc?.start.line ?? 0,
  };
}

function collectNamedExport(
  node: ExportNamedDeclaration,
  exports: AstExport[],
  imports: AstImport[],
): void {
  // Re-export: export { X } from 'source'
  if (node.source) {
    imports.push({
      source: (node.source as StringLiteral).value,
      kind: 'reexport',
      specifiers: node.specifiers.map((s) => {
        if (s.type === 'ExportSpecifier') {
          const exported = s.exported;
          return exported.type === 'Identifier' ? exported.name : (exported as StringLiteral).value;
        }
        return '';
      }).filter(Boolean),
      typeOnly: node.exportKind === 'type',
      line: node.loc?.start.line ?? 0,
    });
  }

  // Inline declaration: export function foo() {} / export const x = ... / etc.
  if (node.declaration) {
    const typeOnly = node.exportKind === 'type';
    const line = node.declaration.loc?.start.line ?? node.loc?.start.line ?? 0;
    switch (node.declaration.type) {
      case 'FunctionDeclaration': {
        const name = (node.declaration as FunctionDeclaration).id?.name;
        if (name) exports.push({ name, kind: 'function', typeOnly, line });
        return;
      }
      case 'ClassDeclaration': {
        const name = (node.declaration as ClassDeclaration).id?.name;
        if (name) exports.push({ name, kind: 'class', typeOnly, line });
        return;
      }
      case 'VariableDeclaration': {
        for (const decl of (node.declaration as VariableDeclaration).declarations) {
          if (decl.id.type === 'Identifier') {
            exports.push({ name: (decl.id as Identifier).name, kind: 'variable', typeOnly, line });
          }
        }
        return;
      }
      case 'TSInterfaceDeclaration': {
        const name = (node.declaration as TSInterfaceDeclaration).id.name;
        exports.push({ name, kind: 'interface', typeOnly: true, line });
        return;
      }
      case 'TSTypeAliasDeclaration': {
        const name = (node.declaration as TSTypeAliasDeclaration).id.name;
        exports.push({ name, kind: 'type', typeOnly: true, line });
        return;
      }
      case 'TSEnumDeclaration': {
        const name = (node.declaration as TSEnumDeclaration).id.name;
        exports.push({ name, kind: 'enum', typeOnly, line });
        return;
      }
      default:
        return;
    }
  }

  // Named re-export of local symbols: export { foo, bar }
  for (const spec of node.specifiers) {
    if (spec.type !== 'ExportSpecifier') continue;
    const exported = spec.exported;
    const name = exported.type === 'Identifier' ? exported.name : (exported as StringLiteral).value;
    exports.push({
      name,
      kind: 'unknown',
      typeOnly: node.exportKind === 'type',
      line: spec.loc?.start.line ?? node.loc?.start.line ?? 0,
    });
  }
}

/**
 * Lightweight AST walker. We only care about recursing through node properties
 * to find CallExpressions (for call sites + dynamic imports + require).
 * Avoids the full babel-traverse dependency.
 */
function walk(node: Node, visit: (n: Node) => void): void {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'range' || key === 'leadingComments' || key === 'trailingComments') continue;
    const child = (node as unknown as Record<string, unknown>)[key];
    if (!child) continue;
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && 'type' in item) {
          walk(item as Node, visit);
        }
      }
    } else if (typeof child === 'object' && 'type' in child) {
      walk(child as Node, visit);
    }
  }
}
