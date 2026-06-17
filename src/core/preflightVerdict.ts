import type { PreflightReason, PreflightReport, PreflightVerdict } from '../types.js';

export function decidePreflightVerdict(reasons: PreflightReason[]): PreflightVerdict {
  if (reasons.some((reason) => reason.severity === 'error')) return 'block';
  if (reasons.some((reason) => reason.severity === 'warning')) return 'caution';
  return 'proceed';
}

export function summarizePreflight(report: PreflightReport): string {
  if (report.reasons.length === 0) {
    return `${report.verdict}: no blocking or cautionary signals found`;
  }
  if (report.evidence.releaseScale?.detected) {
    return `${report.verdict}: manual release sign-off recommended for large platform release risk`;
  }
  return `${report.verdict}: ${report.reasons[0].message}`;
}
