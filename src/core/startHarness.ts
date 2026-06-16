import fs from 'node:fs/promises';
import path from 'node:path';
import type { SessionCoordinationHint } from '../types.js';

export async function detectStartHarnessHints(
  rootPath: string,
): Promise<SessionCoordinationHint[]> {
  const [agentLoopFiles, agentFlightFiles] = await Promise.all([
    existingRootFiles(rootPath, ['AGENTLOOP.md', 'agentloop.config.json']),
    existingRootFiles(rootPath, ['.agentflight/config.json']),
  ]);
  const hints: SessionCoordinationHint[] = [];
  if (agentLoopFiles.length > 0) {
    hints.push({
      id: 'agentloop-task-contract',
      label: 'Start with the AgentLoop task contract',
      message: `Local AgentLoop harness detected (${agentLoopFiles.join(', ')}); inspect the active task contract before changing code.`,
      command: 'npm exec agentloop -- status',
    });
  }
  if (agentFlightFiles.length > 0) {
    hints.push({
      id: 'agentflight-verification',
      label: 'Run AgentFlight verification evidence',
      message: `Local AgentFlight harness detected (${agentFlightFiles.join(', ')}); run local verification before handoff.`,
      command: 'npm exec agentflight -- verify',
    });
  }
  return hints;
}

export function prioritizeStartHarnessHints(
  coordinationHints: SessionCoordinationHint[],
): SessionCoordinationHint[] {
  const harnessHints = coordinationHints.filter(isHarnessCoordinationHint);
  const otherHints = coordinationHints.filter((hint) => !isHarnessCoordinationHint(hint));
  return [...harnessHints, ...otherHints].slice(0, 3);
}

function isHarnessCoordinationHint(hint: SessionCoordinationHint): boolean {
  return hint.id === 'agentloop-task-contract' || hint.id === 'agentflight-verification';
}

async function existingRootFiles(rootPath: string, files: string[]): Promise<string[]> {
  const checks = await Promise.all(
    files.map(async (file) => {
      try {
        await fs.access(path.join(rootPath, file));
        return file;
      } catch {
        return undefined;
      }
    }),
  );
  return checks.filter((file): file is string => typeof file === 'string');
}
