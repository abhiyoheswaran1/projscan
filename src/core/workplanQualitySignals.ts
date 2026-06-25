import { computeQualityScorecard } from './qualityScorecard.js';
import type { QualityScorecardRisk } from '../types/qualityScorecard.js';
import type { WorkplanEvidence, WorkplanMode, WorkplanTopRisk } from '../types.js';

export interface WorkplanQualitySignals {
  files: string[];
  evidence: WorkplanEvidence[];
  topRisks: WorkplanTopRisk[];
}

export async function safeQualitySignals(
  rootPath: string,
  mode: WorkplanMode,
  maxTopRisks = 8,
): Promise<WorkplanQualitySignals> {
  if (mode !== 'bug_hunt') return emptyQualitySignals();
  try {
    const report = await computeQualityScorecard(rootPath, { maxRisks: maxTopRisks });
    const topRisks = report.topRisks
      .map(qualityRiskToWorkplanRisk)
      .filter((risk): risk is WorkplanTopRisk => risk !== undefined);
    return {
      files: unique(report.topRisks.flatMap((risk) => risk.files)),
      evidence: topRisks.map((risk) => ({
        source: risk.source,
        message: risk.message,
        ...(risk.severity ? { severity: risk.severity } : {}),
        ...(risk.file ? { file: risk.file } : {}),
        ...(risk.issueId ? { issueId: risk.issueId } : {}),
        ...(risk.tool ? { tool: risk.tool } : {}),
      })),
      topRisks,
    };
  } catch {
    return emptyQualitySignals();
  }
}

function emptyQualitySignals(): WorkplanQualitySignals {
  return { files: [], evidence: [], topRisks: [] };
}

function qualityRiskToWorkplanRisk(risk: QualityScorecardRisk): WorkplanTopRisk | undefined {
  if (risk.files.length === 0) return undefined;
  const tool = toolFromCommand(risk.command);
  return {
    source: workplanSourceFromQualityRisk(risk.source),
    message: risk.title,
    priority: risk.priority,
    file: risk.files[0],
    ...(tool ? { tool } : {}),
  };
}

function workplanSourceFromQualityRisk(
  source: QualityScorecardRisk['source'],
): WorkplanEvidence['source'] {
  if (source === 'hotspot') return 'hotspots';
  if (source === 'coordination') return 'coordination';
  return 'doctor';
}

function toolFromCommand(command: string): string | undefined {
  if (command.startsWith('projscan file ')) return 'projscan_file';
  if (command.startsWith('projscan doctor ')) return 'projscan_doctor';
  if (command.startsWith('projscan session ')) return 'projscan_session';
  if (command.startsWith('projscan quality-scorecard ')) return 'projscan_quality_scorecard';
  return undefined;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
