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

test('package entrypoint re-exports public types through a type-only star export', () => {
  const indexSource = readFileSync(new URL('../../src/index.ts', import.meta.url), 'utf-8');

  expect(probeKey).toBe('scan');
  expect(indexSource).toContain("export type * from './types.js';");
  expect(indexSource).not.toContain('export type {\n  ScanResult,');
});
