import path from 'node:path';
import type { ExportInfo } from '../types.js';

/**
 * Filename-keyword rules. Order matters: first match wins. Each predicate
 * runs against the lowercase basename without extension.
 */
const NAME_RULES: ReadonlyArray<{
  pred: (name: string) => boolean;
  label: string;
}> = [
  { pred: isTestFileName, label: 'Test file' },
  { pred: (name) => name.includes('config') || name.includes('rc'), label: 'Configuration file' },
  { pred: (name) => name === 'index', label: 'Module entry point / barrel file' },
  { pred: (name) => name === 'main' || name === 'app', label: 'Application entry point' },
  { pred: (name) => name.includes('route') || name.includes('router'), label: 'Route definitions' },
  { pred: (name) => name.includes('middleware'), label: 'Middleware handler' },
  { pred: (name) => name.includes('controller'), label: 'Request controller' },
  { pred: (name) => name.includes('service'), label: 'Service layer logic' },
  {
    pred: (name) => name.includes('model') || name.includes('schema'),
    label: 'Data model / schema definition',
  },
  { pred: (name) => name.includes('util') || name.includes('helper'), label: 'Utility functions' },
  { pred: (name) => name.includes('hook'), label: 'Custom hook' },
  {
    pred: (name) => name.includes('context') || name.includes('provider'),
    label: 'Context / state provider',
  },
  { pred: (name) => name.includes('type') || name.includes('interface'), label: 'Type definitions' },
  { pred: (name) => name.includes('constant'), label: 'Constants / configuration' },
  { pred: (name) => name.includes('migration'), label: 'Database migration' },
  { pred: (name) => name.includes('seed'), label: 'Database seed data' },
  { pred: (name) => name.includes('auth'), label: 'Authentication logic' },
  { pred: (name) => name.includes('api'), label: 'API endpoint handler' },
];

const TEST_NAME_TOKENS = new Set(['test', 'tests', 'spec', 'specs']);

const DIR_RULES: ReadonlyArray<{
  pred: (dir: string) => boolean;
  label: string;
}> = [
  { pred: (dir) => dir.includes('component') || dir.includes('pages'), label: 'UI component' },
  { pred: (dir) => dir.includes('service'), label: 'Service module' },
  { pred: (dir) => dir.includes('model'), label: 'Data model' },
  { pred: (dir) => dir.includes('util') || dir.includes('lib'), label: 'Library / utility module' },
];

export function inferPurpose(filePath: string, exports: ExportInfo[]): string {
  const name = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const dir = path.dirname(filePath).toLowerCase();
  for (const rule of NAME_RULES) if (rule.pred(name)) return rule.label;
  for (const rule of DIR_RULES) if (rule.pred(dir)) return rule.label;
  return inferPurposeFromExports(exports);
}

function isTestFileName(name: string): boolean {
  return name.split(/[\W_]+/).some((part) => TEST_NAME_TOKENS.has(part));
}

function inferPurposeFromExports(exports: ExportInfo[]): string {
  const exportTypes = exports.map((item) => item.type);
  if (exportTypes.includes('class')) return 'Class-based module';
  if (exportTypes.filter((type) => type === 'function').length > 2) return 'Function library';
  return 'Source module';
}
