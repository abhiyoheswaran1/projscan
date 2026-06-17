import { computeCoordination, type CoordinationSummary } from './coordination.js';
import { analyzeHotspots } from './hotspotAnalyzer.js';
import { loadSession } from './session.js';
import type { FileEntry, HotspotReport, Issue } from '../types.js';

export type { CoordinationSummary } from './coordination.js';

export interface PreflightSessionEvidence {
  id: string;
  touchedFiles: string[];
  eventCount: number;
}

export async function safeSession(rootPath: string): Promise<PreflightSessionEvidence> {
  const { session } = await loadSession(rootPath);
  const touchedFiles = Object.values(session.touchedFiles)
    .sort((a, b) => {
      const byTime = Date.parse(b.lastTouchedAt) - Date.parse(a.lastTouchedAt);
      return byTime !== 0 ? byTime : a.file.localeCompare(b.file);
    })
    .map((touch) => touch.file);
  return {
    id: session.id,
    touchedFiles,
    eventCount: session.events.length,
  };
}

export async function safeHotspots(
  rootPath: string,
  files: FileEntry[],
  issues: Issue[],
): Promise<HotspotReport | null> {
  try {
    return await analyzeHotspots(rootPath, files, issues, { limit: 20 });
  } catch {
    return null;
  }
}

/** Coordination evidence for preflight; null when no real cross-worktree read. */
export async function safeCoordination(
  rootPath: string,
  baseRef?: string,
): Promise<CoordinationSummary | null> {
  try {
    const summary = await computeCoordination(rootPath, baseRef ? { baseRef } : {});
    return summary.available ? summary : null;
  } catch {
    return null;
  }
}
