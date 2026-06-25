import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

import type { ProofLedgerRecord, ProofLedgerWriteInput } from '../types/proofLedger.js';

export const DEFAULT_PROOF_LEDGER_PATH = '.projscan/proof-ledger.jsonl';

const MAX_SUMMARY_LENGTH = 240;
const REDACTION_PATTERNS = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\b(?:sk|pk|whsec|ghp|gho|github_pat)[_-][A-Za-z0-9_=-]{8,}/gi,
  /\b[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|PWD|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY)[A-Z0-9_]*\s*=\s*(?:"[^"]*"|'[^']*'|[^"'\s,;]+)/gi,
  /\b(password|passwd|pwd|token|secret|api[_-]?key)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^"'\s,;]+)/gi,
  /(--?(?:password|passwd|pwd|token|secret|api[_-]?key))\s+(?:"[^"]*"|'[^']*'|[^"'\s,;]+)/gi,
  /\b[A-Za-z_][A-Za-z0-9_]*\.env\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^"'\s,;]+)/gi,
];

export function normalizeProofCommand(command: string): string {
  return command.trim().replace(/\s+/g, ' ');
}

export function redactProofCommand(command: string): string {
  return redactProofOutput(command);
}

export async function changedFileFingerprint(rootPath: string, files: string[]): Promise<string> {
  const normalized = [...new Set(files.map(normalizePath).filter(Boolean))].sort();
  const entries = await Promise.all(normalized.map((file) => changedFileFingerprintEntry(rootPath, file)));
  return crypto.createHash('sha256').update(entries.join('\n')).digest('hex');
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
  const command = redactProofCommand(input.command);
  const record: ProofLedgerRecord = {
    schemaVersion: 1,
    id: proofRecordId(command, completedAt, input.exitCode),
    command,
    normalizedCommand: normalizeProofCommand(command),
    cwd: normalizePath(input.cwd ?? '.'),
    exitCode: input.exitCode,
    status: input.exitCode === 0 ? 'passed' : 'failed',
    startedAt,
    completedAt,
    durationMs,
    changedFileFingerprint: await changedFileFingerprint(rootPath, changedFiles),
    changedFiles,
    outputSummary: redactProofSummary(input.outputSummary),
    source: input.source ?? 'prove-record',
    ...(input.logPath ? { logPath: normalizeProofLogPath(input.logPath) } : {}),
  };

  const fullPath = resolveProofLedgerPath(rootPath, ledgerPath);
  await prepareProofArtifactWritePath(rootPath, fullPath);
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
    await prepareProofArtifactReadPath(rootPath, fullPath);
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

export async function readLatestProofLedgerRecords(
  rootPath: string,
  ledgerPath: string | undefined,
  commands: string[],
): Promise<ProofLedgerRecord[]> {
  const normalizedCommands = uniqueNormalizedCommands(commands);
  if (normalizedCommands.length === 0) return [];

  const fullPath = resolveProofLedgerPath(rootPath, ledgerPath);
  const latestByCommand = new Map<string, ProofLedgerRecord>();
  let stream: ReturnType<typeof createReadStream>;
  try {
    await prepareProofArtifactReadPath(rootPath, fullPath);
    await fs.access(fullPath);
    stream = createReadStream(fullPath, { encoding: 'utf-8' });
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) return [];
    throw error;
  }

  const lines = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });
  const requested = new Set(normalizedCommands);
  for await (const line of lines) {
    const record = parseProofLedgerRow(line);
    if (!record || !requested.has(record.normalizedCommand)) continue;
    const latest = latestByCommand.get(record.normalizedCommand);
    if (!latest || record.completedAt.localeCompare(latest.completedAt) >= 0) {
      latestByCommand.set(record.normalizedCommand, record);
    }
  }

  return normalizedCommands
    .map((command) => latestByCommand.get(command))
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

export async function prepareProofArtifactWritePath(
  rootPath: string,
  fullPath: string,
): Promise<void> {
  const root = path.resolve(rootPath);
  const target = path.resolve(fullPath);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Proof artifact path must stay inside the project root.');
  }
  const parent = path.dirname(target);
  await assertNoSymlinkInExistingPath(root, parent);
  await fs.mkdir(parent, { recursive: true });
  await assertNoSymlinkInExistingPath(root, parent);
  await assertPathIsNotSymlink(target);
}

export async function prepareProofArtifactReadPath(
  rootPath: string,
  fullPath: string,
): Promise<void> {
  const root = path.resolve(rootPath);
  const target = path.resolve(fullPath);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Proof artifact path must stay inside the project root.');
  }
  await assertNoSymlinkInExistingPath(root, target);
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
  const normalizedRequested = normalizePath(relative);
  if (
    normalizedRequested !== DEFAULT_PROOF_LEDGER_PATH &&
    !/^\.projscan\/proof-ledgers\/[^/]+\.jsonl$/.test(normalizedRequested)
  ) {
    throw new Error('Proof ledger path must be .projscan/proof-ledger.jsonl or .projscan/proof-ledgers/<name>.jsonl.');
  }
  return fullPath;
}

async function changedFileFingerprintEntry(rootPath: string, file: string): Promise<string> {
  const fullPath = resolvePathInsideRoot(rootPath, file);
  if (!fullPath) return `${file}\0outside-root`;
  try {
    const stat = await fs.lstat(fullPath);
    if (stat.isSymbolicLink()) {
      const linkTarget = await fs.readlink(fullPath);
      const digest = crypto.createHash('sha256').update(linkTarget).digest('hex');
      return `${file}\0symlink\0${digest}`;
    }
    if (!stat.isFile()) return `${file}\0${stat.isDirectory() ? 'directory' : 'non-file'}`;
    const digest = crypto.createHash('sha256').update(await fs.readFile(fullPath)).digest('hex');
    return `${file}\0file\0${digest}`;
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) return `${file}\0missing`;
    throw error;
  }
}

function resolvePathInsideRoot(rootPath: string, file: string): string | null {
  const root = path.resolve(rootPath);
  const fullPath = path.resolve(root, file);
  const relative = path.relative(root, fullPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return fullPath;
}

function normalizeProofLogPath(logPath: string): string {
  const normalized = normalizePath(logPath);
  if (!/^\.projscan\/proof-logs\/[^/]+\.log$/.test(normalized)) {
    throw new Error('Proof log path must stay under .projscan/proof-logs/ and end with .log.');
  }
  return normalized;
}

async function assertNoSymlinkInExistingPath(root: string, target: string): Promise<void> {
  const relative = path.relative(root, target);
  const segments = relative.split(path.sep).filter(Boolean);
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error('Proof artifact paths must not contain symlinks.');
    } catch (error) {
      if (isNodeErrorCode(error, 'ENOENT')) return;
      throw error;
    }
  }
}

async function assertPathIsNotSymlink(target: string): Promise<void> {
  try {
    const stat = await fs.lstat(target);
    if (stat.isSymbolicLink()) throw new Error('Proof artifact paths must not contain symlinks.');
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) return;
    throw error;
  }
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

function uniqueNormalizedCommands(commands: string[]): string[] {
  return [...new Set(commands.map(normalizeProofCommand).filter(Boolean))];
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/').replace(/^\.\//, '');
}

function redactionReplacement(_match: string, ...args: unknown[]): string {
  const captures = args.slice(0, -2);
  const label = captures.find((value): value is string => typeof value === 'string' && value.length > 0);
  if (!label) {
    const assignment = /^([A-Za-z0-9_-]*(?:TOKEN|SECRET|PASSWORD|PASSWD|PWD|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY)[A-Za-z0-9_-]*)\s*[:=]/i.exec(
      _match,
    );
    if (assignment?.[1]) return `${assignment[1]}=[redacted]`;
  }
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
