import type { ReportFormat } from '../types/config.js';

export const OUTPUT_FORMATS = [
  'console',
  'json',
  'markdown',
  'sarif',
  'html',
] as const satisfies readonly ReportFormat[];

export const COMMAND_FORMAT_SUPPORT = {
  'agent-brief': ['console', 'json'],
  analyze: ['console', 'json', 'markdown', 'sarif', 'html'],
  'apply-fix': ['console', 'json'],
  audit: ['console', 'json', 'markdown', 'sarif'],
  badge: ['console'],
  'bug-hunt': ['console', 'json'],
  ci: ['console', 'json', 'markdown', 'sarif'],
  claim: ['console', 'json'],
  'claim list': ['console', 'json'],
  'claim add': ['console', 'json'],
  'claim release': ['console', 'json'],
  'claim prune': ['console', 'json'],
  collisions: ['console', 'json'],
  coordinate: ['console', 'json'],
  'merge-risk': ['console', 'json'],
  route: ['console', 'json'],
  coupling: ['console', 'json', 'markdown', 'html'],
  coverage: ['console', 'json', 'markdown', 'html'],
  dependencies: ['console', 'json', 'markdown'],
  dataflow: ['console', 'json'],
  diagram: ['console', 'json', 'markdown'],
  diff: ['console', 'json', 'markdown'],
  doctor: ['console', 'json', 'markdown', 'sarif', 'html'],
  dogfood: ['console', 'json'],
  'evidence-pack': ['console', 'json'],
  feedback: ['console', 'json'],
  'feedback init': ['console', 'json'],
  'feedback add': ['console', 'json'],
  'feedback summary': ['console', 'json'],
  explain: ['console', 'json', 'markdown'],
  'explain-issue': ['console', 'json', 'markdown'],
  file: ['console', 'json', 'markdown'],
  'first-run': ['console', 'json'],
  fix: ['console'],
  'fix-suggest': ['console', 'json', 'markdown'],
  handoff: ['console', 'json'],
  help: ['console'],
  hotspots: ['console', 'json', 'markdown', 'html'],
  impact: ['console', 'json', 'markdown', 'html'],
  init: ['console'],
  'init github-action': ['console', 'json'],
  'init mcp': ['console', 'json'],
  'init policy': ['console', 'json'],
  'init team': ['console', 'json'],
  'install-hook': ['console'],
  mcp: ['console'],
  'mission-proof': ['console', 'json', 'markdown'],
  'mcp doctor': ['console', 'json'],
  memory: ['console', 'json'],
  'memory stable': ['console', 'json'],
  'memory runs': ['console', 'json'],
  'memory forget': ['console'],
  outdated: ['console', 'json', 'markdown', 'sarif'],
  'plugin list': ['console', 'json'],
  'plugin validate': ['console', 'json'],
  'plugin init': ['console', 'json'],
  'plugin test': ['console', 'json'],
  'plugin trust': ['console', 'json'],
  'plugin untrust': ['console', 'json'],
  preflight: ['console', 'json'],
  'privacy-check': ['console', 'json'],
  'pr-diff': ['console', 'json', 'markdown', 'html'],
  'quality-scorecard': ['console', 'json'],
  'release-train': ['console', 'json'],
  'regression-plan': ['console', 'json'],
  recipes: ['console', 'json'],
  review: ['console', 'json', 'markdown', 'html'],
  search: ['console', 'json', 'markdown'],
  'semantic-graph': ['console', 'json'],
  session: ['console', 'json'],
  start: ['console', 'json'],
  'session touched': ['console', 'json'],
  'session events': ['console', 'json'],
  'session reset': ['console', 'json'],
  structure: ['console', 'json', 'markdown'],
  taint: ['console', 'json'],
  trial: ['console', 'json'],
  understand: ['console', 'json'],
  telemetry: ['console', 'json'],
  'telemetry status': ['console', 'json'],
  'telemetry enable': ['console', 'json'],
  'telemetry disable': ['console', 'json'],
  'telemetry explain': ['console', 'json'],
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

export function formatSupportRows(): Array<{
  command: CommandFormatName;
  formats: readonly ReportFormat[];
}> {
  return Object.entries(COMMAND_FORMAT_SUPPORT).map(([command, formats]) => ({
    command: command as CommandFormatName,
    formats,
  }));
}
