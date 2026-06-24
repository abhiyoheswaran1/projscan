import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { ProofLedgerRecord, ProofLedgerWriteInput } from '../types/proofLedger.js';

export const DEFAULT_PROOF_LEDGER_PATH = '.projscan/proof-ledger.jsonl';

const MAX_SUMMARY_LENGTH = 240;
const REDACTION_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\b(?:sk|pk|whsec|ghp|gho|github_pat)_[A-Za-z0-9_=-]{8,}/gi,
  /\b(password|passwd|pwd|token|secret|api[_-]?key)\s*[:=]\s*["']?[^"'\s,;]+/gi,
  /\b(--?(?:password|passwd|pwd|token|secret|api[_-]?key))\s+[^"'\s,;]+/gi,
  /\b[A-Za-z_][A-Za-z0-9_]*\.env\s*[:=]\s*[^"'\s,;]+/gi,
];

export function normalizeProofCommand(command: string): string {
  return command.trim().replace(/\s+/g, ' ');
}

export function changedFileFingerprint(files: string[]): string {
  const normalized = [...new Set(files.map(normalizePath).filter(Boolean))].sort();
  return crypto.createHash('sha256').update(normalized.join('\n')).digest('hex');
}

export function redactProofSummary(value: string | undefined): string {
  let summary = redactProofOutput(value ?? '').replace(/\s+/g, ' ').trim();
  if (summary.length === 0) summary = 'No proof output summary supplied.';
  if (summary.length > MAX_SUMMARY_LENGTH) {
    return `${summary.slice(0, MAX_SUMMARY_LENGTH - 1)}...`;
  }
  return summary;
}

export function redactProofOutput(value: string): string {
  let output = value;
  for (const pattern of REDACTION_PATTERNS) {
    output = output.replace(pattern, redactionReplacement);
  }
  return output;
}

export async function appendProofLedgerRecord(
  rootPath: string,
  ledgerPath: string | undefined,
  input: ProofLedgerWriteInput,
): Promise<ProofLedgerRecord> {
  const completedAt = input.completedAt ?? new Date().toISOString();
  const durationMs = Math.max(0, Math.round(input.durationMs));
  const completedMs = Date.parse(completedAt);
  const startedAt = Number.isFinite(completedMs)
    ? new Date(completedMs - durationMs).toISOString()
    : completedAt;
  const changedFiles = [...new Set(input.changedFiles.map(normalizePath).filter(Boolean))].sort();
  const record: ProofLedgerRecord = {
    schemaVersion: 1,
    id: proofRecordId(input.command, completedAt, input.exitCode),
    command: input.command,
    normalizedCommand: normalizeProofCommand(input.command),
    cwd: normalizePath(input.cwd ?? '.'),
    exitCode: input.exitCode,
    status: input.exitCode === 0 ? 'passed' : 'failed',
    startedAt,
    completedAt,
    durationMs,
    changedFileFingerprint: changedFileFingerprint(changedFiles),
    changedFiles,
    outputSummary: redactProofSummary(input.outputSummary),
    source: input.source ?? 'prove-record',
    ...(input.logPath ? { logPath: normalizePath(input.logPath) } : {}),
  };

  const fullPath = resolveProofLedgerPath(rootPath, ledgerPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.appendFile(fullPath, `${JSON.stringify(record)}\n`, 'utf-8');
  return record;
}

export async function readProofLedger(
  rootPath: string,
  ledgerPath: string | undefined,
): Promise<ProofLedgerRecord[]> {
  const fullPath = resolveProofLedgerPath(rootPath, ledgerPath);
  let raw: string;
  try {
    raw = await fs.readFile(fullPath, 'utf-8');
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) return [];
    throw error;
  }
  return raw
    .split('\n')
    .map(parseProofLedgerRow)
    .filter((record): record is ProofLedgerRecord => Boolean(record));
}

export function latestProofRecordFor(
  records: ProofLedgerRecord[],
  command: string,
): ProofLedgerRecord | undefined {
  const normalized = normalizeProofCommand(command);
  let latest: ProofLedgerRecord | undefined;
  for (const record of records) {
    if (record.normalizedCommand !== normalized) continue;
    if (!latest || record.completedAt.localeCompare(latest.completedAt) >= 0) latest = record;
  }
  return latest;
}

function proofRecordId(command: string, completedAt: string, exitCode: number): string {
  const digest = crypto
    .createHash('sha256')
    .update(`${normalizeProofCommand(command)}\n${completedAt}\n${exitCode}`)
    .digest('hex')
    .slice(0, 12);
  return `proof-ledger-${digest}`;
}

function resolveProofLedgerPath(rootPath: string, ledgerPath: string | undefined): string {
  const root = path.resolve(rootPath);
  const requested = ledgerPath?.trim() ? ledgerPath : DEFAULT_PROOF_LEDGER_PATH;
  const fullPath = path.resolve(root, requested);
  const relative = path.relative(root, fullPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Proof ledger path must stay inside the project root.');
  }
  return fullPath;
}

function parseProofLedgerRow(line: string): ProofLedgerRecord | undefined {
  const trimmed = line.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as Partial<ProofLedgerRecord>;
    return isProofLedgerRecord(parsed) ? parsed : undefined;
  } catch {
    // Ignore malformed local ledger rows; receipts can still report missing proof.
    return undefined;
  }
}

function isProofLedgerRecord(value: Partial<ProofLedgerRecord>): value is ProofLedgerRecord {
  return (
    value.schemaVersion === 1 &&
    typeof value.command === 'string' &&
    typeof value.normalizedCommand === 'string' &&
    typeof value.exitCode === 'number'
  );
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/').replace(/^\.\//, '');
}

function redactionReplacement(_match: string, ...args: unknown[]): string {
  const captures = args.slice(0, -2);
  const label = captures.find((value): value is string => typeof value === 'string' && value.length > 0);
  return label ? `${label}=[redacted]` : '[redacted]';
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
