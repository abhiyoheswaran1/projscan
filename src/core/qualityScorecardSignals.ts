import { buildCodeGraph } from './codeGraph.js';
import { analyzeHotspots } from './hotspotAnalyzer.js';
import { collectIssues } from './issueEngine.js';
import { scanRepository } from './repositoryScanner.js';
import { buildRiskNow, type ProjectSignals } from './sessionResources.js';
import { applyConfigToIssues, loadConfig } from '../utils/config.js';
import { calculateScore } from '../utils/scoreCalculator.js';
import type { Issue } from '../types/common.js';
import type { FileHotspot } from '../types/hotspots.js';
import type { FileEntry } from '../types/scanning.js';
import type { SessionConflict } from '../types/session.js';

const RISK_NOW_HOTSPOT_LIMIT = 50;

export interface QualityScorecardHotspotSignals {
  available: boolean;
  hotspots: FileHotspot[];
  projectSignals?: ProjectSignals;
}

export interface QualityScorecardSignals {
  issues: Issue[];
  health: ReturnType<typeof calculateScore>;
  hotspots: QualityScorecardHotspotSignals;
  riskNow: { touchedFiles: string[]; conflicts: SessionConflict[] };
}

export async function collectQualityScorecardSignals(
  rootPath: string,
  maxRisks: number,
): Promise<QualityScorecardSignals> {
  const configResult = await loadConfig(rootPath).catch(() => ({ config: { ignore: [] } }));
  const scan = await scanRepository(rootPath, {
    ignore: configResult.config.ignore,
    countIgnoredFiles: false,
  });
  const issues = applyConfigToIssues(
    await collectIssues(rootPath, scan.files),
    configResult.config,
  );
  const health = calculateScore(issues);
  const hotspots = await safeHotspots(rootPath, scan.files, issues, maxRisks);
  const riskNow = await safeRiskNow(rootPath, hotspots.projectSignals);

  return { issues, health, hotspots, riskNow };
}

async function safeRiskNow(
  rootPath: string,
  projectSignals?: ProjectSignals,
): Promise<{ touchedFiles: string[]; conflicts: SessionConflict[] }> {
  try {
    return await buildRiskNow(rootPath, projectSignals ? { projectSignals } : {});
  } catch {
    return { touchedFiles: [], conflicts: [] };
  }
}

async function safeHotspots(
  rootPath: string,
  files: FileEntry[],
  issues: Issue[],
  limit: number,
): Promise<QualityScorecardHotspotSignals> {
  try {
    const graph = await buildCodeGraph(rootPath, files).catch(() => undefined);
    const report = await analyzeHotspots(rootPath, files, issues, {
      limit: Math.max(limit, RISK_NOW_HOTSPOT_LIMIT),
      ...(graph ? { graph } : {}),
    });
    const projectSignals: ProjectSignals = {
      issues,
      hotspots: report.available
        ? report.hotspots.map((hotspot) => ({
            file: hotspot.relativePath,
            riskScore: hotspot.riskScore,
          }))
        : null,
      staleSignals: report.available
        ? []
        : [`hotspots unavailable: ${report.reason ?? 'unknown reason'}`],
      ...(graph ? { graph } : {}),
    };
    return {
      available: report.available,
      hotspots: report.hotspots.slice(0, limit),
      projectSignals,
    };
  } catch {
    return { available: false, hotspots: [] };
  }
}
