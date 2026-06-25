import crypto from 'node:crypto';

import type {
  ProveProofCommandEvidence,
  ProveProofReplay,
  ProveProofReplayEvent,
  ProveProofReplayStatus,
  ProveProofSufficiency,
  ProveProofSufficiencyStatus,
  ProveReceipt,
  ProveReviewerDecision,
  ProveRiskDeltaDirection,
} from '../types/prove.js';
import { proofRelevantChangedFiles } from './proofSufficiency.js';

export function buildProofReplay(input: {
  scope: ProveReceipt['scope'];
  proofStatus: ProveReceipt['proofStatus'];
  proofSufficiency: ProveProofSufficiency;
  riskDeltaDirection: ProveRiskDeltaDirection;
  reviewerDecision: ProveReviewerDecision;
  replayCommand: string;
}): ProveProofReplay {
  const currentChangedFiles = proofRelevantChangedFiles(input.scope.changedFiles);
  const changedAfterProof = changedAfterProofForCommands(
    currentChangedFiles,
    input.proofStatus.commandEvidence,
  );
  const status = proofReplayStatus({
    scopeStatus: input.scope.status,
    proofStatus: input.proofStatus.status,
    proofSufficiencyStatus: input.proofSufficiency.status,
  });
  const events = proofReplayEvents({
    status,
    scope: input.scope,
    proofStatus: input.proofStatus,
    proofSufficiency: input.proofSufficiency,
    currentChangedFiles,
    changedAfterProof,
  });
  return {
    status,
    summary: proofReplaySummary(status, changedAfterProof),
    events,
    changedAfterProof,
    replayCommand: input.replayCommand,
    receiptFingerprint: receiptFingerprint({
      status,
      scopeStatus: input.scope.status,
      changedFiles: input.scope.changedFiles,
      proofStatus: input.proofStatus.status,
      proofSufficiencyStatus: input.proofSufficiency.status,
      proofSufficiencyRequirements: input.proofSufficiency.requirements.map((requirement) => ({
        id: requirement.id,
        status: requirement.status,
        matchedCommands: requirement.matchedCommands,
      })),
      commandEvidence: input.proofStatus.commandEvidence.map((entry) => ({
        command: entry.command,
        status: entry.status,
        fresh: entry.fresh,
        source: entry.source,
        exitCode: entry.exitCode,
        completedAt: entry.completedAt,
        recordedChangedFileFingerprint: entry.recordedChangedFileFingerprint,
      })),
      changedAfterProof,
      riskDeltaDirection: input.riskDeltaDirection,
      reviewerDecision: input.reviewerDecision,
    }),
  };
}

function proofReplayStatus(input: {
  scopeStatus: ProveReceipt['scope']['status'];
  proofStatus: ProveReceipt['proofStatus']['status'];
  proofSufficiencyStatus: ProveProofSufficiencyStatus;
}): ProveProofReplayStatus {
  if (input.proofStatus === 'failed' || input.proofSufficiencyStatus === 'failed') return 'failed';
  if (input.proofStatus === 'stale' || input.proofSufficiencyStatus === 'stale') return 'stale';
  if (input.scopeStatus === 'drifted') return 'drifted';
  if (
    input.scopeStatus === 'missing-contract' ||
    input.proofStatus === 'missing' ||
    input.proofStatus === 'partial' ||
    input.proofSufficiencyStatus === 'missing' ||
    input.proofSufficiencyStatus === 'weak'
  ) {
    return 'needs-proof';
  }
  return 'verified';
}

function proofReplayEvents(input: {
  status: ProveProofReplayStatus;
  scope: ProveReceipt['scope'];
  proofStatus: ProveReceipt['proofStatus'];
  proofSufficiency: ProveProofSufficiency;
  currentChangedFiles: string[];
  changedAfterProof: string[];
}): ProveProofReplayEvent[] {
  return [
    contractEvent(input.scope),
    {
      kind: 'change-set',
      status: input.scope.status === 'within-contract' ? 'passed' : input.scope.status,
      summary: `${input.scope.changedFiles.length} changed file(s) replayed against the Proof Contract.`,
      changedFiles: input.scope.changedFiles,
    },
    ...input.proofStatus.commandEvidence.map((entry) =>
      proofCommandEvent(entry, input.currentChangedFiles),
    ),
    {
      kind: 'proof-sufficiency',
      status: input.proofSufficiency.status,
      summary: input.proofSufficiency.summary,
    },
    {
      kind: 'receipt',
      status: input.status,
      summary: proofReplaySummary(input.status, input.changedAfterProof),
    },
  ];
}

function contractEvent(scope: ProveReceipt['scope']): ProveProofReplayEvent {
  if (scope.status === 'missing-contract') {
    return {
      kind: 'contract',
      status: 'missing',
      summary: 'No saved Proof Contract was available for replay.',
    };
  }
  if (scope.status === 'drifted') {
    return {
      kind: 'contract',
      status: 'drifted',
      summary: 'Changed files drifted outside the Proof Contract.',
      changedFiles: scope.outsideAllowed,
    };
  }
  return {
    kind: 'contract',
    status: 'passed',
    summary: 'Changed files stayed inside the Proof Contract.',
  };
}

function proofCommandEvent(
  entry: ProveProofCommandEvidence,
  currentChangedFiles: string[],
): ProveProofReplayEvent {
  const changedAfterProof = changedAfterProofForCommand(currentChangedFiles, entry);
  return {
    kind: 'proof-command',
    status: entry.status,
    summary: proofCommandSummary(entry, changedAfterProof),
    command: entry.command,
    completedAt: entry.completedAt,
    ...(entry.source ? { source: entry.source } : {}),
    ...(entry.recordedChangedFiles ? { changedFiles: entry.recordedChangedFiles } : {}),
    ...(changedAfterProof.length > 0 ? { changedAfterProof } : {}),
  };
}

function proofCommandSummary(
  entry: ProveProofCommandEvidence,
  changedAfterProof: string[],
): string {
  if (entry.status === 'missing') return 'No ledger record exists for this required command.';
  if (entry.status === 'failed') return 'The latest ledger record for this command failed.';
  if (entry.status === 'stale') {
    const files = changedAfterProof.length > 0 ? ` ${changedAfterProof.length} file(s) appeared after proof.` : '';
    return `The latest ledger record no longer matches the current changed-file set.${files}`;
  }
  return 'The latest ledger record passed and matches the current changed-file set.';
}

function changedAfterProofForCommands(
  currentChangedFiles: string[],
  evidence: ProveProofCommandEvidence[],
): string[] {
  return unique(evidence.flatMap((entry) => changedAfterProofForCommand(currentChangedFiles, entry)));
}

function changedAfterProofForCommand(
  currentChangedFiles: string[],
  evidence: ProveProofCommandEvidence,
): string[] {
  if (!evidence.recordedChangedFiles || evidence.recordedChangedFiles.length === 0) return [];
  const recorded = new Set(evidence.recordedChangedFiles);
  return currentChangedFiles.filter((file) => !recorded.has(file)).sort();
}

function proofReplaySummary(status: ProveProofReplayStatus, changedAfterProof: string[]): string {
  if (status === 'verified') return 'Proof replay is verified: scope and proof evidence match.';
  if (status === 'failed') return 'Proof replay found failed proof evidence.';
  if (status === 'drifted') return 'Proof replay found scope drift outside the contract.';
  if (status === 'stale') {
    return changedAfterProof.length > 0
      ? `Proof replay is stale: ${changedAfterProof.length} file(s) appeared after proof.`
      : 'Proof replay is stale: recorded proof no longer matches the current changed-file set.';
  }
  return 'Proof replay needs more evidence before reviewer approval.';
}

function receiptFingerprint(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
