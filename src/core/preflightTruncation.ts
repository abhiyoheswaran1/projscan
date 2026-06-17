import type { PreflightChangedFiles } from './preflightChangedFiles.js';
import { MAX_PREFLIGHT_EVIDENCE_FILES } from './preflightEvidence.js';
import type { PreflightEvidence } from '../types.js';

export function isPreflightReportTruncated(input: {
  evidence: PreflightEvidence;
  changedFiles: PreflightChangedFiles;
}): boolean {
  return (
    input.evidence.session?.truncated === true ||
    input.changedFiles.files.length > MAX_PREFLIGHT_EVIDENCE_FILES ||
    (input.evidence.hotspots?.touched.length ?? 0) > MAX_PREFLIGHT_EVIDENCE_FILES
  );
}
