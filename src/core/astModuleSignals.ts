import type {
  ClassDeclaration,
  ExportAllDeclaration,
  ExportNamedDeclaration,
  FunctionDeclaration,
  Identifier,
  ImportDeclaration,
  Statement,
  StringLiteral,
  TSEnumDeclaration,
  TSInterfaceDeclaration,
  TSTypeAliasDeclaration,
  VariableDeclaration,
} from '@babel/types';
import type { AstExport, AstImport, SymbolKind } from './astTypes.js';

export function visitTopLevel(node: Statement, imports: AstImport[], exports: AstExport[]): void {
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
  const reexport = namedReexportImport(node);
  if (reexport) imports.push(reexport);

  if (node.declaration) {
    const typeOnly = node.exportKind === 'type';
    const line = node.declaration.loc?.start.line ?? node.loc?.start.line ?? 0;
    collectInlineExportDeclaration(node.declaration, exports, typeOnly, line);
    return;
  }

  collectLocalExportSpecifiers(node, exports);
}

function namedReexportImport(node: ExportNamedDeclaration): AstImport | null {
  if (!node.source) return null;
  return {
    source: (node.source as StringLiteral).value,
    kind: 'reexport',
    specifiers: exportSpecifierNames(node.specifiers),
    typeOnly: node.exportKind === 'type',
    line: node.loc?.start.line ?? 0,
  };
}

function exportSpecifierNames(specifiers: ExportNamedDeclaration['specifiers']): string[] {
  return specifiers.flatMap((specifier) => {
    const name = exportSpecifierName(specifier);
    return name ? [name] : [];
  });
}

function exportSpecifierName(
  specifier: ExportNamedDeclaration['specifiers'][number],
): string | null {
  if (specifier.type !== 'ExportSpecifier') return null;
  const exported = specifier.exported;
  return exported.type === 'Identifier' ? exported.name : (exported as StringLiteral).value;
}

function collectInlineExportDeclaration(
  declaration: NonNullable<ExportNamedDeclaration['declaration']>,
  exports: AstExport[],
  typeOnly: boolean,
  line: number,
): void {
  switch (declaration.type) {
    case 'FunctionDeclaration':
      pushIdExport(exports, (declaration as FunctionDeclaration).id?.name, 'function', typeOnly, line);
      return;
    case 'ClassDeclaration':
      pushIdExport(exports, (declaration as ClassDeclaration).id?.name, 'class', typeOnly, line);
      return;
    case 'VariableDeclaration':
      collectVariableExports(declaration as VariableDeclaration, exports, typeOnly, line);
      return;
    case 'TSInterfaceDeclaration':
      pushIdExport(exports, (declaration as TSInterfaceDeclaration).id.name, 'interface', true, line);
      return;
    case 'TSTypeAliasDeclaration':
      pushIdExport(exports, (declaration as TSTypeAliasDeclaration).id.name, 'type', true, line);
      return;
    case 'TSEnumDeclaration':
      pushIdExport(exports, (declaration as TSEnumDeclaration).id.name, 'enum', typeOnly, line);
      return;
    default:
      return;
  }
}

function collectVariableExports(
  declaration: VariableDeclaration,
  exports: AstExport[],
  typeOnly: boolean,
  line: number,
): void {
  for (const decl of declaration.declarations) {
    if (decl.id.type === 'Identifier') {
      pushIdExport(exports, (decl.id as Identifier).name, 'variable', typeOnly, line);
    }
  }
}

function collectLocalExportSpecifiers(node: ExportNamedDeclaration, exports: AstExport[]): void {
  for (const spec of node.specifiers) {
    const name = exportSpecifierName(spec);
    if (!name) continue;
    exports.push({
      name,
      kind: 'unknown',
      typeOnly: node.exportKind === 'type',
      line: spec.loc?.start.line ?? node.loc?.start.line ?? 0,
    });
  }
}

function pushIdExport(
  exports: AstExport[],
  name: string | undefined,
  kind: SymbolKind,
  typeOnly: boolean,
  line: number,
): void {
  if (name) exports.push({ name, kind, typeOnly, line });
}
