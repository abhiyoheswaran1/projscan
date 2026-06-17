import type { AstExport, AstImport, FunctionInfo } from './ast.js';

export interface GraphFile {
  relativePath: string;
  imports: AstImport[];
  exports: AstExport[];
  callSites: string[];
  lineCount: number;
  /** File-level McCabe cyclomatic complexity from the adapter. 0 when unparsed. */
  cyclomaticComplexity: number;
  /**
   * Per-function McCabe CC from the adapter (0.13.0+). Optional for
   * backward compatibility with code paths that build GraphFile records
   * without function metadata. Treat absence as "no per-function data".
   */
  functions?: FunctionInfo[];
  mtimeMs: number;
  parseOk: boolean;
  parseReason?: string;
  /** Adapter id that parsed this file. */
  adapterId?: string;
}

export interface CodeGraph {
  files: Map<string, GraphFile>;
  packageImporters: Map<string, Set<string>>;
  localImporters: Map<string, Set<string>>;
  symbolDefs: Map<string, Set<string>>;
  scannedFiles: number;
}
