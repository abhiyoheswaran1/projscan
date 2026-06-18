import type { CodeGraph } from './codeGraph.js';
import type { DataflowReport, FileEntry, Issue, SemanticGraphReport } from '../types.js';
import type { PluginAnalyzerManifest } from './pluginManifestValidation.js';

export interface PluginAnalyzerContext {
  schemaVersion: 1;
  getCodeGraph: () => Promise<CodeGraph>;
  getSemanticGraph: () => Promise<SemanticGraphReport>;
  getDataflow: () => Promise<DataflowReport>;
}

export interface PluginAnalyzerExports {
  check: (
    rootPath: string,
    files: FileEntry[],
    context?: PluginAnalyzerContext,
  ) => Promise<Issue[]> | Issue[];
}

export interface LoadedPlugin {
  manifest: PluginAnalyzerManifest;
  /** Absolute path to the manifest file on disk. */
  manifestPath: string;
  /** Absolute path to the resolved module entry point. */
  modulePath: string;
  exports: PluginAnalyzerExports;
}
