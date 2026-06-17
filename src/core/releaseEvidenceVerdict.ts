import { concreteDefectMessages } from './releaseEvidencePrSummary.js';
import type {
  BugHuntReport,
  EvidencePackArtifact,
  EvidencePackPrSummary,
  EvidencePackVerdict,
  PreflightReport,
  WorkplanReport,
} from '../types.js';

export function blockingEvidence(
  preflight: PreflightReport,
  bugHunt: BugHuntReport,
  workplan: WorkplanReport,
): string[] {
  return dedupeStrings([
    ...(concreteDefectMessages(preflight).length > 0
      ? concreteDefectMessages(preflight)
      : preflight.verdict === 'block' && preflight.evidence.releaseScale?.detected
        ? [preflight.evidence.releaseScale.explanation]
        : []),
    ...(bugHunt.verdict === 'block'
      ? bugHunt.fixQueue
          .filter((finding) => finding.priority === 'p0')
          .map((finding) => finding.title)
      : []),
    ...(workplan.verdict === 'block'
      ? workplan.topRisks.filter((risk) => risk.priority === 'p0').map((risk) => risk.message)
      : []),
  ]).slice(0, 10);
}

export function evidencePackVerdict(artifacts: EvidencePackArtifact[]): EvidencePackVerdict {
  if (artifacts.some((artifact) => artifact.status === 'blocked')) return 'blocked';
  if (artifacts.some((artifact) => artifact.status === 'caution')) return 'caution';
  return 'ready';
}

export function calibrateEvidencePackVerdict(
  verdict: EvidencePackVerdict,
  prSummary: EvidencePackPrSummary,
): EvidencePackVerdict {
  if (
    verdict === 'blocked' &&
    prSummary.trust.verdict === 'manual_review' &&
    prSummary.trust.concreteBlockers.length === 0
  ) {
    return 'caution';
  }
  return verdict;
}

export function summarizeEvidencePack(
  verdict: EvidencePackVerdict,
  currentVersion: string | null | undefined,
  blockingReasons: string[],
): string {
  const version = currentVersion ?? 'current version';
  if (verdict === 'blocked') {
    return `blocked: ${blockingReasons[0] ?? 'product evidence still contains blocking signals'}`;
  }
  if (verdict === 'caution') {
    return `caution: ${version} evidence is assembled but still needs explicit review`;
  }
  return `ready: ${version} evidence is assembled for approval`;
}

export function approvalRecommendation(verdict: EvidencePackVerdict): string {
  if (verdict === 'blocked')
    return 'Do not approve launch until p0 evidence is cleared or accepted.';
  if (verdict === 'caution')
    return 'Review cautions, then approve only after the regression plan passes.';
  return 'Approval can proceed after the recorded regression commands pass.';
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
