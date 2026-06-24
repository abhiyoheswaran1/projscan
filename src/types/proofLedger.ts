export type ProofLedgerSource = 'prove-record' | 'prove-run' | 'mission' | 'external';
export type ProofLedgerStatus = 'passed' | 'failed';

export interface ProofLedgerRecord {
  schemaVersion: 1;
  id: string;
  command: string;
  normalizedCommand: string;
  cwd: string;
  exitCode: number;
  status: ProofLedgerStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  changedFileFingerprint: string;
  changedFiles: string[];
  outputSummary: string;
  source: ProofLedgerSource;
  logPath?: string;
}

export interface ProofLedgerWriteInput {
  command: string;
  cwd?: string;
  exitCode: number;
  durationMs: number;
  changedFiles: string[];
  outputSummary?: string;
  source?: ProofLedgerSource;
  logPath?: string;
  completedAt?: string;
}
