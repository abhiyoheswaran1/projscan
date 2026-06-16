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
