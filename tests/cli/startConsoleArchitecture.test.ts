import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('start console architecture', () => {
  it('keeps execution and resume rendering in a focused helper', () => {
    const consoleSource = readSource('src/cli/commands/startConsole.ts');
    const executionPath = path.join(process.cwd(), 'src/cli/commands/startConsoleExecution.ts');

    expect(consoleSource).toContain(
      "export { formatConsoleChecklistItem } from './startConsoleExecution.js';",
    );
    expect(consoleSource).not.toContain('function printExecutionPlan');
    expect(consoleSource).not.toContain('function printExecutionCursor');
    expect(consoleSource).not.toContain('function printResumeChecklist');
    expect(consoleSource).not.toContain('function formatConsoleChecklistItem');
    expect(consoleSource).not.toContain('function executionStepLine');

    expect(existsSync(executionPath)).toBe(true);
    const executionSource = readFileSync(executionPath, 'utf8');
    expect(executionSource).toContain('export function printExecutionPlan');
    expect(executionSource).toContain('export function printResumeChecklist');
    expect(executionSource).toContain('export function formatConsoleChecklistItem');
    expect(executionSource).toContain('export function formatConsoleToolCall');
    expect(executionSource).toContain('function executionStepLine');
    expect(executionSource).not.toContain("from './startConsole.js'");
  });

  it('keeps Mission Control console rendering in a focused helper', () => {
    const consoleSource = readSource('src/cli/commands/startConsole.ts');
    const missionPath = path.join(process.cwd(), 'src/cli/commands/startConsoleMission.ts');

    expect(consoleSource).toContain("import { printMissionControl } from './startConsoleMission.js';");
    expect(consoleSource).not.toContain('function printMissionControl');
    expect(consoleSource).not.toContain('function printMissionRoute');
    expect(consoleSource).not.toContain('function printMissionProof');
    expect(consoleSource).not.toContain('function printReviewGate');
    expect(consoleSource).not.toContain('function formatConsoleProofItem');

    expect(existsSync(missionPath)).toBe(true);
    const missionSource = readFileSync(missionPath, 'utf8');
    expect(missionSource).toContain('export function printMissionControl');
    expect(missionSource).toContain('function printMissionRoute');
    expect(missionSource).toContain('function printMissionProof');
    expect(missionSource).toContain('function printReviewGate');
    expect(missionSource).toContain('function formatConsoleProofItem');
    expect(missionSource).not.toContain("from './startConsole.js'");
  });
});

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}
