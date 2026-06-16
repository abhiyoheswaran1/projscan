import type { ExportInfo } from '../types.js';

export function mapExportType(kind: string): ExportInfo['type'] {
  switch (kind) {
    case 'function':
    case 'class':
    case 'variable':
    case 'type':
    case 'interface':
    case 'default':
      return kind;
    case 'enum':
      return 'type';
    default:
      return 'unknown';
  }
}
