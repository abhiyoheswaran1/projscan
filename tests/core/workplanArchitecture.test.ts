import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('workplan architecture', () => {
  it('keeps mode-specific task recipes in a focused helper', () => {
    const workplanSource = readSource('src/core/workplan.ts');
    const modeTasksPath = path.join(process.cwd(), 'src/core/workplanModeTasks.ts');

    expect(workplanSource).toContain("import { modeTasks } from './workplanModeTasks.js';");
    expect(workplanSource).not.toContain('function modeTasks');
    expect(workplanSource).not.toContain("id: 'wp-bug-hunt-hotspots'");
    expect(workplanSource).not.toContain("id: 'wp-release-readiness'");
    expect(workplanSource).not.toContain("id: 'wp-hardening-gate'");

    expect(existsSync(modeTasksPath)).toBe(true);
    const modeTasksSource = readFileSync(modeTasksPath, 'utf8');
    expect(modeTasksSource).toContain('export function modeTasks');
    expect(modeTasksSource).toContain("id: 'wp-bug-hunt-hotspots'");
    expect(modeTasksSource).toContain("id: 'wp-release-readiness'");
    expect(modeTasksSource).toContain("id: 'wp-hardening-gate'");
    expect(modeTasksSource).not.toContain("from './workplan.js'");
  });

  it('keeps preflight-derived task recipes in a focused helper', () => {
    const workplanSource = readSource('src/core/workplan.ts');
    const preflightTasksPath = path.join(process.cwd(), 'src/core/workplanPreflightTasks.ts');

    expect(workplanSource).toContain(
      "import { tasksFromPreflight } from './workplanPreflightTasks.js';",
    );
    expect(workplanSource).not.toContain('function tasksFromPreflight');
    expect(workplanSource).not.toContain("id: 'wp-supply-chain-1'");
    expect(workplanSource).not.toContain("id: 'wp-review-gate'");
    expect(workplanSource).not.toContain("id: 'wp-health-policy'");
    expect(workplanSource).not.toContain("id: 'wp-git-scope'");

    expect(existsSync(preflightTasksPath)).toBe(true);
    const preflightTasksSource = readFileSync(preflightTasksPath, 'utf8');
    expect(preflightTasksSource).toContain('export function tasksFromPreflight');
    expect(preflightTasksSource).toContain("id: 'wp-supply-chain-1'");
    expect(preflightTasksSource).toContain("id: 'wp-review-gate'");
    expect(preflightTasksSource).toContain("id: 'wp-health-policy'");
    expect(preflightTasksSource).toContain("id: 'wp-git-scope'");
    expect(preflightTasksSource).not.toContain("from './workplan.js'");
  });

  it('keeps coordination task policy in a focused helper', () => {
    const workplanSource = readSource('src/core/workplan.ts');
    const coordinationPath = path.join(process.cwd(), 'src/core/workplanCoordinationTasks.ts');

    expect(workplanSource).toContain(
      "import { buildCoordination, tasksFromCoordination } from './workplanCoordinationTasks.js';",
    );
    expect(workplanSource).not.toContain('function buildCoordination');
    expect(workplanSource).not.toContain('function tasksFromCoordination');
    expect(workplanSource).not.toContain("id: 'wp-session-handoff'");
    expect(workplanSource).not.toContain('preflight agent: run the safety gate');

    expect(existsSync(coordinationPath)).toBe(true);
    const coordinationSource = readFileSync(coordinationPath, 'utf8');
    expect(coordinationSource).toContain('export function buildCoordination');
    expect(coordinationSource).toContain('export function tasksFromCoordination');
    expect(coordinationSource).toContain("id: 'wp-session-handoff'");
    expect(coordinationSource).toContain('preflight agent: run the safety gate');
    expect(coordinationSource).not.toContain("from './workplan.js'");
  });

  it('keeps risk and owner policy in a focused helper', () => {
    const workplanSource = readSource('src/core/workplan.ts');
    const riskOwnershipPath = path.join(process.cwd(), 'src/core/workplanRiskOwnership.ts');

    expect(workplanSource).toContain(
      "import { annotateTasksWithOwners, annotateTopRisksWithOwners, buildTopRisks } from './workplanRiskOwnership.js';",
    );
    expect(workplanSource).not.toContain('function buildTopRisks');
    expect(workplanSource).not.toContain('function annotateTasksWithOwners');
    expect(workplanSource).not.toContain('function annotateTopRisksWithOwners');
    expect(workplanSource).not.toContain('function ownerForTask');
    expect(workplanSource).not.toContain('function ownerForFiles');

    expect(existsSync(riskOwnershipPath)).toBe(true);
    const riskOwnershipSource = readFileSync(riskOwnershipPath, 'utf8');
    expect(riskOwnershipSource).toContain('export function buildTopRisks');
    expect(riskOwnershipSource).toContain('export function annotateTasksWithOwners');
    expect(riskOwnershipSource).toContain('export function annotateTopRisksWithOwners');
    expect(riskOwnershipSource).toContain('Owner: ${owner}.');
    expect(riskOwnershipSource).not.toContain("from './workplan.js'");
  });

  it('keeps quality-scorecard signal policy in a focused helper', () => {
    const workplanSource = readSource('src/core/workplan.ts');
    const qualitySignalsPath = path.join(process.cwd(), 'src/core/workplanQualitySignals.ts');

    expect(workplanSource).toContain(
      "import { safeQualitySignals } from './workplanQualitySignals.js';",
    );
    expect(workplanSource).not.toContain('function safeQualitySignals');
    expect(workplanSource).not.toContain('function qualityRiskToWorkplanRisk');
    expect(workplanSource).not.toContain('function workplanSourceFromQualityRisk');

    expect(existsSync(qualitySignalsPath)).toBe(true);
    const qualitySignalsSource = readFileSync(qualitySignalsPath, 'utf8');
    expect(qualitySignalsSource).toContain('export async function safeQualitySignals');
    expect(qualitySignalsSource).toContain('function qualityRiskToWorkplanRisk');
    expect(qualitySignalsSource).toContain('function workplanSourceFromQualityRisk');
    expect(qualitySignalsSource).not.toContain("from './workplan.js'");
  });

  it('keeps suggested-action policy in a focused helper', () => {
    const workplanSource = readSource('src/core/workplan.ts');
    const suggestedActionsPath = path.join(process.cwd(), 'src/core/workplanSuggestedActions.ts');

    expect(workplanSource).toContain(
      "import { buildWorkplanSuggestedActions } from './workplanSuggestedActions.js';",
    );
    expect(workplanSource).not.toContain('function taskToSuggestedActions');
    expect(workplanSource).not.toContain('function commandForSuggestedTool');
    expect(workplanSource).not.toContain('function dedupeActions');

    expect(existsSync(suggestedActionsPath)).toBe(true);
    const suggestedActionsSource = readFileSync(suggestedActionsPath, 'utf8');
    expect(suggestedActionsSource).toContain('export function buildWorkplanSuggestedActions');
    expect(suggestedActionsSource).toContain('function commandForSuggestedTool');
    expect(suggestedActionsSource).toContain('function dedupeActions');
    expect(suggestedActionsSource).not.toContain("from './workplan.js'");
  });

  it('keeps report shaping and task ranking in a focused helper', () => {
    const workplanSource = readSource('src/core/workplan.ts');
    const reportPath = path.join(process.cwd(), 'src/core/workplanReport.ts');

    expect(workplanSource).toContain("from './workplanReport.js';");
    expect(workplanSource).toContain('buildWorkplanHandoffPayload');
    expect(workplanSource).toContain('rankWorkplanTasks');
    expect(workplanSource).toContain('summarizeWorkplan');
    expect(workplanSource).not.toContain('function renderWorkplanHandoffMarkdown');
    expect(workplanSource).not.toContain('function strongestEvidenceRank');
    expect(workplanSource).not.toContain('function priorityRank');
    expect(workplanSource).not.toContain('function summarizeWorkplan');

    expect(existsSync(reportPath)).toBe(true);
    const reportSource = readFileSync(reportPath, 'utf8');
    expect(reportSource).toContain('export function buildWorkplanHandoffPayload');
    expect(reportSource).toContain('export function rankWorkplanTasks');
    expect(reportSource).toContain('export function summarizeWorkplan');
    expect(reportSource).toContain('function renderWorkplanHandoffMarkdown');
    expect(reportSource).toContain('function strongestEvidenceRank');
    expect(reportSource).not.toContain("from './workplan.js'");
  });
});

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}
