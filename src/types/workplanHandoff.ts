import type { PreflightVerdict } from './preflight.js';
import type { WorkplanCoordination, WorkplanMode } from './workplan.js';

export interface WorkplanHandoffPayload {
  summary: string;
  verdict: PreflightVerdict;
  mode: WorkplanMode;
  next: string[];
  verificationCommands: string[];
  coordination: WorkplanCoordination;
  markdown: string;
}
