import type { Issue, IssueSeverity } from './common.js';

export interface PluginTestResult {
  schemaVersion: 1;
  manifestPath: string;
  ok: boolean;
  diagnostics: Array<{ code: string; severity: IssueSeverity; message: string }>;
  trust: {
    localOnly: true;
    previewFlag: 'PROJSCAN_PLUGINS_PREVIEW=1';
    reminder: string;
  };
  commands: {
    validate: string;
    test: string;
    execute: string;
    enable: string;
  };
  execution: {
    requested: boolean;
    executed: boolean;
    mode: 'static' | 'execute';
    note: string;
  };
  context: {
    requested: boolean;
    capabilities: Array<'semanticGraph' | 'dataflow'>;
    note: string;
  };
  analyzer?: { issues: Issue[] };
  reporter?: { outputs: Array<{ command: string; text: string }> };
}
