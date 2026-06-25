import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Mission Control policy architecture', () => {
  it('keeps route explanation and action-plan policy in a focused helper', () => {
    const policySource = readSource('src/core/startMissionPolicy.ts');
    const routingPath = path.join(process.cwd(), 'src/core/startMissionRoutingPolicy.ts');

    expect(policySource).toContain(
      "export { actionFromWorkflow, missionActionPlan, routedWhyNow } from './startMissionRoutingPolicy.js';",
    );
    expect(policySource).not.toContain('export function routedWhyNow');
    expect(policySource).not.toContain('export function missionActionPlan');
    expect(policySource).not.toContain('export function actionFromWorkflow');
    expect(policySource).not.toContain('function isDailySafeCommitIntent');
    expect(policySource).not.toContain('function actionFromFixFirst');

    expect(existsSync(routingPath)).toBe(true);
    const routingSource = readFileSync(routingPath, 'utf8');
    expect(routingSource).toContain('export function routedWhyNow');
    expect(routingSource).toContain('export function missionActionPlan');
    expect(routingSource).toContain('export function actionFromWorkflow');
    expect(routingSource).not.toContain("from './startMissionPolicy.js'");
  });

  it('keeps input and status policy in a focused helper', () => {
    const policySource = readSource('src/core/startMissionPolicy.ts');
    const inputStatusPath = path.join(process.cwd(), 'src/core/startMissionInputStatusPolicy.ts');

    expect(policySource).toContain(
      "export { headlineForStatus, missionReadyActions, missionStatus, missionUnresolvedInputs } from './startMissionInputStatusPolicy.js';",
    );
    expect(policySource).not.toContain('export function missionStatus');
    expect(policySource).not.toContain('export function missionUnresolvedInputs');
    expect(policySource).not.toContain('export function missionReadyActions');
    expect(policySource).not.toContain('export function headlineForStatus');
    expect(policySource).not.toContain('function placeholderInstruction');
    expect(policySource).not.toContain('function dedupeUnresolvedInputs');

    expect(existsSync(inputStatusPath)).toBe(true);
    const inputStatusSource = readFileSync(inputStatusPath, 'utf8');
    expect(inputStatusSource).toContain('export function missionStatus');
    expect(inputStatusSource).toContain('export function missionUnresolvedInputs');
    expect(inputStatusSource).toContain('export function missionReadyActions');
    expect(inputStatusSource).toContain('export function headlineForStatus');
    expect(inputStatusSource).toContain('function placeholderInstruction');
    expect(inputStatusSource).not.toContain("from './startMissionPolicy.js'");
  });

  it('keeps risk assembly policy in a focused helper', () => {
    const policySource = readSource('src/core/startMissionPolicy.ts');
    const riskPath = path.join(process.cwd(), 'src/core/startMissionRiskPolicy.ts');

    expect(policySource).toContain("export { combineRisks } from './startMissionRiskPolicy.js';");
    expect(policySource).not.toContain('export function combineRisks');
    expect(policySource).not.toContain('function workplanRiskToStartRisk');
    expect(policySource).not.toContain('function isActionableStartQualityRisk');
    expect(policySource).not.toContain('function dedupeRisks');

    expect(existsSync(riskPath)).toBe(true);
    const riskSource = readFileSync(riskPath, 'utf8');
    expect(riskSource).toContain('export function combineRisks');
    expect(riskSource).toContain('function workplanRiskToStartRisk');
    expect(riskSource).toContain('function isActionableStartQualityRisk');
    expect(riskSource).not.toContain("from './startMissionPolicy.js'");
  });

  it('keeps proof command and guardrail policy in a focused helper', () => {
    const policySource = readSource('src/core/startMissionPolicy.ts');
    const proofPath = path.join(process.cwd(), 'src/core/startMissionProofPolicy.ts');

    expect(policySource).toContain(
      "export { dedupeActions, missionGuardrails, missionProofCommands } from './startMissionProofPolicy.js';",
    );
    expect(policySource).not.toContain('export function missionGuardrails');
    expect(policySource).not.toContain('export function missionProofCommands');
    expect(policySource).not.toContain('export function dedupeActions');
    expect(policySource).not.toContain('function releaseCandidateProofCommands');

    expect(existsSync(proofPath)).toBe(true);
    const proofSource = readFileSync(proofPath, 'utf8');
    expect(proofSource).toContain('export function missionGuardrails');
    expect(proofSource).toContain('export function missionProofCommands');
    expect(proofSource).toContain('export function dedupeActions');
    expect(proofSource).toContain('function releaseCandidateProofCommands');
    expect(proofSource).not.toContain("from './startMissionPolicy.js'");
  });
});

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}
