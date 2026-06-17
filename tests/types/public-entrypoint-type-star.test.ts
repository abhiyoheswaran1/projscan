import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import type {
  AgentBriefReport,
  AnalysisReport,
  BugHuntReport,
  FileEntry,
  ImpactReport,
  McpToolDefinition,
  MissionProofReport,
  QualityScorecardReport,
  ReviewReport,
  ScanResult,
  StartReport,
  WorkplanReport,
} from '../../src/index.js';

type PublicEntrypointTypeProbe = {
  agentBrief: AgentBriefReport;
  analysis: AnalysisReport;
  bugHunt: BugHuntReport;
  file: FileEntry;
  impact: ImpactReport;
  mcpTool: McpToolDefinition;
  missionProof: MissionProofReport;
  qualityScorecard: QualityScorecardReport;
  review: ReviewReport;
  scan: ScanResult;
  start: StartReport;
  workplan: WorkplanReport;
};

const probeKey: keyof PublicEntrypointTypeProbe = 'scan';
const publicEntrypointModules = [
  './publicCore.js',
  './publicAgent.js',
  './publicMcp.js',
  './publicLanguages.js',
];

test('package entrypoint re-exports public types through a type-only star export', () => {
  const indexSource = readFileSync(new URL('../../src/index.ts', import.meta.url), 'utf-8');

  expect(probeKey).toBe('scan');
  expect(indexSource).toContain("export type * from './types.js';");
  expect(indexSource).not.toContain('export type {\n  ScanResult,');
});

test('package entrypoint delegates value exports through grouped public entry modules', () => {
  const indexSource = readFileSync(new URL('../../src/index.ts', import.meta.url), 'utf-8');

  for (const moduleSpecifier of publicEntrypointModules) {
    expect(indexSource).toContain(`export * from '${moduleSpecifier}';`);
  }

  expect(indexSource).not.toContain("from './core/repositoryScanner.js'");
  expect(indexSource).not.toContain("from './mcp/server.js'");
  expect(indexSource).not.toContain("from './core/languages/LanguageAdapter.js'");
  expect(indexSource.split('\n').filter((line) => line.trim()).length).toBeLessThanOrEqual(6);
});

test('legacy public type barrel re-exports focused modules through type-only stars', () => {
  const typesSource = readFileSync(new URL('../../src/types.ts', import.meta.url), 'utf-8');

  expect(typesSource).toContain("export type * from './types/common.js';");
  expect(typesSource).toContain("export type * from './types/start.js';");
  expect(typesSource).not.toContain('export type {\n  ExportInfo,');
});

test('grouped public entry modules keep type specifiers on existing export edges', () => {
  const publicSource = publicEntrypointModules
    .map((moduleSpecifier) =>
      readFileSync(
        new URL(`../../src/${moduleSpecifier.replace('./', '').replace('.js', '.ts')}`, import.meta.url),
        'utf-8',
      ),
    )
    .join('\n');

  for (const source of [
    './core/ast.js',
    './core/watcher.js',
    './core/semanticSearch.js',
    './core/adoption.js',
    './core/languages/LanguageAdapter.js',
  ]) {
    expect(moduleSpecifierCount(publicSource, source)).toBe(1);
  }
});

function moduleSpecifierCount(source: string, moduleSpecifier: string): number {
  return source.split(`from '${moduleSpecifier}'`).length - 1;
}
