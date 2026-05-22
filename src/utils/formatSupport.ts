import type { ReportFormat } from '../types.js';

export const OUTPUT_FORMATS = ['console', 'json', 'markdown', 'sarif', 'html'] as const satisfies readonly ReportFormat[];

export const COMMAND_FORMAT_SUPPORT = {
  analyze: ['console', 'json', 'markdown', 'sarif', 'html'],
  'apply-fix': ['console', 'json'],
  audit: ['console', 'json', 'markdown', 'sarif'],
  badge: ['console'],
  'bug-hunt': ['console', 'json'],
  ci: ['console', 'json', 'markdown', 'sarif'],
  coupling: ['console', 'json', 'markdown', 'html'],
  coverage: ['console', 'json', 'markdown', 'html'],
  dependencies: ['console', 'json', 'markdown'],
  diagram: ['console', 'json', 'markdown'],
  diff: ['console', 'json', 'markdown'],
  doctor: ['console', 'json', 'markdown', 'sarif', 'html'],
  explain: ['console', 'json', 'markdown'],
  'explain-issue': ['console', 'json', 'markdown'],
  file: ['console', 'json', 'markdown'],
  fix: ['console'],
  'fix-suggest': ['console', 'json', 'markdown'],
  handoff: ['console', 'json'],
  help: ['console'],
  hotspots: ['console', 'json', 'markdown', 'html'],
  impact: ['console', 'json', 'markdown', 'html'],
  init: ['console'],
  'install-hook': ['console'],
  mcp: ['console'],
  memory: ['console', 'json'],
  'memory stable': ['console', 'json'],
  'memory runs': ['console', 'json'],
  'memory forget': ['console'],
  outdated: ['console', 'json', 'markdown', 'sarif'],
  'plugin list': ['console', 'json'],
  'plugin validate': ['console', 'json'],
  'plugin init': ['console', 'json'],
  'plugin test': ['console', 'json'],
  preflight: ['console', 'json'],
  'pr-diff': ['console', 'json', 'markdown', 'html'],
  'release-train': ['console', 'json'],
  review: ['console', 'json', 'markdown', 'html'],
  search: ['console', 'json', 'markdown'],
  session: ['console', 'json'],
  'session touched': ['console', 'json'],
  'session events': ['console', 'json'],
  'session reset': ['console', 'json'],
  structure: ['console', 'json', 'markdown'],
  taint: ['console', 'json'],
  upgrade: ['console', 'json', 'markdown'],
  watch: ['console'],
  'workspace list': ['console', 'json'],
  'workspace add': ['console'],
  'workspace remove': ['console'],
  workspaces: ['console', 'json', 'markdown'],
  workplan: ['console', 'json'],
} as const satisfies Record<string, readonly ReportFormat[]>;

export type CommandFormatName = keyof typeof COMMAND_FORMAT_SUPPORT;

export function formatList(formats: readonly ReportFormat[] = OUTPUT_FORMATS): string {
  return formats.join(', ');
}

export function getCommandFormatSupport(commandName: string): readonly ReportFormat[] | undefined {
  return (COMMAND_FORMAT_SUPPORT as Record<string, readonly ReportFormat[]>)[commandName];
}

export function formatSupportRows(): Array<{ command: CommandFormatName; formats: readonly ReportFormat[] }> {
  return Object.entries(COMMAND_FORMAT_SUPPORT).map(([command, formats]) => ({
    command: command as CommandFormatName,
    formats,
  }));
}
