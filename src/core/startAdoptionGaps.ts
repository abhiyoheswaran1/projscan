import type { FirstRunDiagnostic } from './adoption.js';
import type { StartAdoptionGap } from '../types/start.js';

export function buildStartAdoptionGaps(
  diagnostics: FirstRunDiagnostic[],
): StartAdoptionGap[] {
  return diagnostics
    .filter((diagnostic) => diagnostic.status === 'warn' || diagnostic.status === 'fail')
    .map(
      (diagnostic): StartAdoptionGap => ({
        id: diagnostic.id,
        status: diagnostic.status as StartAdoptionGap['status'],
        title: diagnostic.label,
        summary: diagnostic.summary,
        ...(diagnostic.command ? { command: diagnostic.command } : {}),
      }),
    );
}
