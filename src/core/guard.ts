import { computeProve } from './prove.js';
import type { ComputeGuardOptions, GuardReport, GuardReviewerAction, GuardStatus } from '../types/guard.js';
import type { ProveReceipt } from '../types/prove.js';

export async function computeGuard(
  rootPath: string,
  options: ComputeGuardOptions = {},
): Promise<GuardReport> {
  const report = await computeProve(rootPath, {
    changed: true,
    contractPath: options.contractPath,
    baseRef: options.baseRef,
    ledgerPath: options.ledgerPath,
  });
  const receipt = report.receipt;
  const status = guardStatus(receipt);
  const reviewerAction = guardReviewerAction(status, receipt);
  return {
    schemaVersion: 1,
    kind: 'agent-scope-guard',
    status,
    exitCode: exitCodeFor(status),
    summary: guardSummary(status, receipt),
    reviewerAction,
    drift: {
      status: receipt?.scope.status ?? 'missing-contract',
      files: driftFiles(receipt),
      forbiddenTouched: receipt?.scope.forbiddenTouched ?? [],
      outsideAllowed: receipt?.scope.outsideAllowed ?? [],
      changedAfterProof: receipt?.proofReplay?.changedAfterProof ?? [],
    },
    proof: {
      status: receipt?.proofStatus.status ?? 'missing',
      ...(receipt?.proofSufficiency?.status ? { sufficiencyStatus: receipt.proofSufficiency.status } : {}),
      missingCommands: receipt?.proofStatus.missingCommands ?? [],
      failedCommands: receipt?.proofStatus.failedCommands ?? [],
      staleCommands: receipt?.proofStatus.staleCommands ?? [],
    },
    mutatedFiles: [],
    ...(receipt ? { receipt } : {}),
  };
}

function guardStatus(receipt: ProveReceipt | undefined): GuardStatus {
  if (!receipt || receipt.scope.status === 'missing-contract') return 'blocked';
  if (
    receipt.scope.status === 'drifted' ||
    receipt.scope.forbiddenTouched.length > 0 ||
    receipt.scope.outsideAllowed.length > 0 ||
    (receipt.proofReplay?.changedAfterProof.length ?? 0) > 0
  ) {
    return 'drift';
  }
  if (receipt.proofStatus.status === 'failed') return 'blocked';
  if (
    receipt.proofStatus.status === 'missing' ||
    receipt.proofStatus.status === 'not-run' ||
    receipt.proofStatus.status === 'partial' ||
    receipt.proofStatus.status === 'stale' ||
    receipt.proofSufficiency?.status === 'missing' ||
    receipt.proofSufficiency?.status === 'weak' ||
    receipt.proofSufficiency?.status === 'stale' ||
    receipt.proofSufficiency?.status === 'failed'
  ) {
    return 'attention';
  }
  return 'clear';
}

function guardReviewerAction(status: GuardStatus, receipt: ProveReceipt | undefined): GuardReviewerAction {
  if (status === 'drift' || !receipt || receipt.scope.status === 'missing-contract') {
    return 'stop-and-recontract';
  }
  if (status === 'blocked' || receipt.proofStatus.status === 'failed') return 'rerun-proof';
  if (status === 'attention') {
    return receipt.proofStatus.status === 'stale' ? 'rerun-proof' : 'run-proof';
  }
  return 'continue';
}

function guardSummary(status: GuardStatus, receipt: ProveReceipt | undefined): string {
  if (!receipt) return 'blocked: no Proof Contract is available for guard evaluation.';
  if (status === 'drift') {
    const files = driftFiles(receipt);
    return files.length > 0
      ? `drift: ${files.join(', ')} changed outside the approved proof boundary.`
      : 'drift: proof is stale because files changed after proof ran.';
  }
  if (status === 'blocked') return 'blocked: proof failed or the Proof Contract is missing.';
  if (status === 'attention') return `attention: proof is ${receipt.proofStatus.status}.`;
  return 'clear: scope and proof satisfy the current Proof Contract.';
}

function driftFiles(receipt: ProveReceipt | undefined): string[] {
  if (!receipt) return [];
  return unique([
    ...receipt.scope.forbiddenTouched,
    ...receipt.scope.outsideAllowed,
    ...(receipt.proofReplay?.changedAfterProof ?? []),
  ]);
}

function exitCodeFor(status: GuardStatus): number {
  if (status === 'clear') return 0;
  if (status === 'attention') return 1;
  if (status === 'drift') return 2;
  return 3;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
