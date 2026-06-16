import type { ReviewContractChange } from '../types/reviewContract.js';
import type {
  ReviewCycle,
  ReviewDataflowRisk,
  ReviewDependencyChange,
  ReviewFile,
  ReviewFunction,
  ReviewReport,
  ReviewTaintFlow,
} from '../types/review.js';

const RISK_VERDICT_BLOCK_SCORE = 80;
const RISK_VERDICT_REVIEW_SCORE = 40;

type ReviewVerdict = ReviewReport['verdict'];

interface VerdictDecision {
  verdict: ReviewVerdict;
  summary: string[];
}

export function decideVerdict(
  changedFiles: ReviewFile[],
  newCycles: ReviewCycle[],
  riskyFunctions: ReviewFunction[],
  depChanges: ReviewDependencyChange[],
  contractChanges: ReviewContractChange[],
  newTaintFlows: ReviewTaintFlow[],
  newDataflowRisks: ReviewDataflowRisk[],
): VerdictDecision {
  const decision: VerdictDecision = { verdict: 'ok', summary: [] };
  const maxRisk = maxChangedFileRisk(changedFiles);
  applyRiskScoreSignal(decision, maxRisk);
  applyCycleSignal(decision, newCycles);
  applyRiskyFunctionSignal(decision, riskyFunctions);
  applyTaintFlowSignal(decision, newTaintFlows);
  applyDataflowRiskSignal(decision, newDataflowRisks);
  appendDependencySummary(decision.summary, depChanges);
  appendManualReleaseSignOff(decision, {
    maxRisk,
    newCycles,
    riskyFunctions,
    contractChanges,
    newTaintFlows,
    newDataflowRisks,
  });
  appendFallbackSummary(decision, changedFiles.length);
  return decision;
}

function maxChangedFileRisk(changedFiles: ReviewFile[]): number {
  return Math.max(0, ...changedFiles.map((file) => file.riskScore ?? 0));
}

function applyRiskScoreSignal(decision: VerdictDecision, maxRisk: number): void {
  if (maxRisk >= RISK_VERDICT_BLOCK_SCORE) {
    decision.verdict = 'block';
    decision.summary.push(
      `Maximum changed-file risk score is ${maxRisk.toFixed(1)} (>= ${RISK_VERDICT_BLOCK_SCORE}).`,
    );
    return;
  }
  if (maxRisk >= RISK_VERDICT_REVIEW_SCORE) {
    decision.verdict = bumpTo(decision.verdict, 'review');
    decision.summary.push(
      `Maximum changed-file risk score is ${maxRisk.toFixed(1)} (>= ${RISK_VERDICT_REVIEW_SCORE}).`,
    );
  }
}

function applyCycleSignal(decision: VerdictDecision, newCycles: ReviewCycle[]): void {
  if (newCycles.length === 0) return;
  const newOnly = newCycles.filter((cycle) => cycle.classification === 'new');
  if (newOnly.length > 0) {
    decision.verdict = 'block';
    decision.summary.push(`${newOnly.length} new import cycle(s) introduced.`);
    return;
  }
  decision.verdict = bumpTo(decision.verdict, 'review');
  decision.summary.push(`${newCycles.length} cycle(s) expanded.`);
}

function applyRiskyFunctionSignal(
  decision: VerdictDecision,
  riskyFunctions: ReviewFunction[],
): void {
  if (riskyFunctions.length === 0) return;
  decision.verdict = bumpTo(decision.verdict, 'review');
  decision.summary.push(`${riskyFunctions.length} function(s) flagged: high CC added or jumped.`);
}

function applyTaintFlowSignal(decision: VerdictDecision, newTaintFlows: ReviewTaintFlow[]): void {
  if (newTaintFlows.length === 0) return;
  decision.verdict = 'block';
  const sample = newTaintFlows
    .slice(0, 3)
    .map((flow) => `${flow.source}→${flow.sink} (${flow.sourceFn}${flow.pathLength > 1 ? '…' : ''})`)
    .join(', ');
  decision.summary.push(
    `${newTaintFlows.length} new taint flow(s) detected: ${sample}${newTaintFlows.length > 3 ? ', …' : ''}.`,
  );
}

function applyDataflowRiskSignal(
  decision: VerdictDecision,
  newDataflowRisks: ReviewDataflowRisk[],
): void {
  if (newDataflowRisks.length === 0) return;
  decision.verdict = 'block';
  const sample = newDataflowRisks
    .slice(0, 3)
    .map((risk) => `${risk.source}→${risk.sink} (${risk.bridgeFn ?? risk.sourceFn})`)
    .join(', ');
  decision.summary.push(
    `${newDataflowRisks.length} new dataflow risk(s) detected: ${sample}${newDataflowRisks.length > 3 ? ', …' : ''}.`,
  );
}

function appendDependencySummary(
  summary: string[],
  depChanges: ReviewDependencyChange[],
): void {
  if (depChanges.length === 0) return;
  const totals = dependencyTotals(depChanges);
  if (totals.added + totals.removed + totals.bumped === 0) return;
  summary.push(`Dependency changes: +${totals.added} -${totals.removed} ~${totals.bumped}.`);
}

function dependencyTotals(depChanges: ReviewDependencyChange[]): {
  added: number;
  removed: number;
  bumped: number;
} {
  return depChanges.reduce(
    (acc, change) => {
      acc.added += change.added.length;
      acc.removed += change.removed.length;
      acc.bumped += change.bumped.length;
      return acc;
    },
    { added: 0, removed: 0, bumped: 0 },
  );
}

function appendManualReleaseSignOff(
  decision: VerdictDecision,
  signals: {
    maxRisk: number;
    newCycles: ReviewCycle[];
    riskyFunctions: ReviewFunction[];
    contractChanges: ReviewContractChange[];
    newTaintFlows: ReviewTaintFlow[];
    newDataflowRisks: ReviewDataflowRisk[];
  },
): void {
  if (!isManualReleaseSignOffBlock(decision.verdict, signals)) return;
  decision.summary.push(
    'Manual release sign-off required: review blocks on release-scale risk signals, not concrete cycle, risky-function, contract, taint, or dataflow defects.',
  );
}

function isManualReleaseSignOffBlock(
  verdict: ReviewVerdict,
  signals: {
    maxRisk: number;
    newCycles: ReviewCycle[];
    riskyFunctions: ReviewFunction[];
    contractChanges: ReviewContractChange[];
    newTaintFlows: ReviewTaintFlow[];
    newDataflowRisks: ReviewDataflowRisk[];
  },
): boolean {
  const concreteSignals = [
    signals.newCycles,
    signals.riskyFunctions,
    signals.contractChanges,
    signals.newTaintFlows,
    signals.newDataflowRisks,
  ];
  return (
    verdict === 'block' &&
    signals.maxRisk >= RISK_VERDICT_BLOCK_SCORE &&
    concreteSignals.every((entries) => entries.length === 0)
  );
}

function appendFallbackSummary(decision: VerdictDecision, changedFileCount: number): void {
  if (changedFileCount === 0 && decision.summary.length === 0) {
    decision.summary.push('No structural changes detected between base and head.');
    return;
  }
  if (decision.verdict === 'ok' && decision.summary.length === 0) {
    decision.summary.push(`${changedFileCount} file(s) changed; no risk signals.`);
  }
}

function bumpTo(current: ReviewVerdict, target: ReviewVerdict): ReviewVerdict {
  const order: Record<ReviewVerdict, number> = { ok: 0, review: 1, block: 2 };
  return order[target] > order[current] ? target : current;
}
