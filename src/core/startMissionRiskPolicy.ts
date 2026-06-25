import { escapeDoubleQuoted } from './startShellArgs.js';
import type { StartRisk } from '../types/start.js';
import type { QualityScorecardRisk } from '../types/qualityScorecard.js';
import type { WorkplanReport, WorkplanTopRisk } from '../types/workplan.js';

export function combineRisks(
  workplan: WorkplanReport,
  qualityRisks: QualityScorecardRisk[],
  maxRisks: number,
): StartRisk[] {
  const fromWorkplan = workplan.topRisks.map(workplanRiskToStartRisk);
  const fromQuality = qualityRisks
    .filter(isActionableStartQualityRisk)
    .map(qualityRiskToStartRisk);
  const risks = dedupeRisks([...fromWorkplan, ...fromQuality]).slice(0, maxRisks);
  if (risks.length > 0) return risks;
  return [
    {
      id: 'start-baseline',
      priority: 'p2',
      title: 'Preserve the clean baseline',
      source: 'baseline',
      files: [],
      command: 'projscan start --format json',
    },
  ];
}

function workplanRiskToStartRisk(risk: WorkplanTopRisk, index: number): StartRisk {
  return {
    id: `start-workplan-${index + 1}`,
    priority: risk.priority,
    title: startRiskTitle(risk),
    source: risk.source,
    files: risk.file ? [risk.file] : [],
    command: workplanRiskCommand(risk),
  };
}

function workplanRiskCommand(risk: WorkplanTopRisk): string {
  if (risk.tool === 'projscan_review') return 'projscan review --format json';
  if (risk.tool === 'projscan_file' && risk.file)
    return `projscan file "${escapeDoubleQuoted(risk.file)}" --format json`;
  return 'projscan preflight --format json';
}

function startRiskTitle(risk: WorkplanTopRisk): string {
  if (risk.source !== 'release') return risk.message;
  if (/large handoff review risk|manual review sign-off/iu.test(risk.message)) {
    return 'Manual review sign-off required for large handoff risk';
  }
  if (/large platform release risk|manual release sign-off/iu.test(risk.message)) {
    return 'Manual release sign-off required for large platform release risk';
  }
  return risk.message;
}

function qualityRiskToStartRisk(risk: QualityScorecardRisk): StartRisk {
  return {
    id: `start-quality-${risk.id}`,
    priority: risk.priority,
    title: risk.title,
    source: risk.source,
    files: risk.files,
    command: risk.command,
  };
}

function isActionableStartQualityRisk(risk: QualityScorecardRisk): boolean {
  if (risk.source !== 'hotspot' || risk.priority !== 'p2') return true;
  return risk.files.length === 0 || !risk.files.every(isLowSignalHotspotFile);
}

function isLowSignalHotspotFile(file: string): boolean {
  return isTestFile(file) || isTypeBarrel(file);
}

function isTestFile(file: string): boolean {
  return /(^|\/)(__tests__|test|tests)\//u.test(file) || /\.(spec|test)\.[cm]?[jt]sx?$/u.test(file);
}

function isTypeBarrel(file: string): boolean {
  return /(^|\/)types(\.d)?\.ts$/u.test(file) || /(^|\/)types\/index(\.d)?\.ts$/u.test(file);
}

function dedupeRisks(risks: StartRisk[]): StartRisk[] {
  const seen = new Set<string>();
  const result: StartRisk[] = [];
  for (const risk of risks) {
    const key = `${risk.title}:${risk.files.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(risk);
  }
  return result;
}
