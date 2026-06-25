import { computeProve } from './prove.js';
import type { ChangedFilesResult } from '../utils/changedFiles.js';
import type { EvidencePackProofEvidenceSources, EvidencePackProofReceiptSummary } from '../types.js';

export async function safeProofReceipt(
  rootPath: string,
  options: { baseRef?: string; changedFiles: ChangedFilesResult },
): Promise<EvidencePackProofReceiptSummary> {
  const command = 'projscan prove --changed --format markdown';
  try {
    const report = await computeProve(rootPath, {
      changed: true,
      baseRef: options.baseRef,
      changedFiles: options.changedFiles,
    });
    const receipt = report.receipt;
    if (!receipt || receipt.scope.status === 'missing-contract') {
      return {
        available: false,
        command,
        summary: 'No Proof Contract was available for this evidence pack.',
        proofStatus: 'missing',
        reviewerDecision: 'needs-focused-review',
        proofSufficiencyStatus: 'missing',
        proofReplayStatus: 'needs-proof',
        changedAfterProof: [],
        weakRequirements: [],
        missingRequirements: [],
        staleRequirements: [],
        failedRequirements: [],
        missingCommands: [],
        failedCommands: [],
        staleCommands: [],
        teamProofRecipes: [],
        requiredReviewers: [],
        recipeGaps: [],
        recipeDrift: [],
      };
    }
    const proofSufficiency = receipt.proofSufficiency;
    const proofReplay = receipt.proofReplay;
    if (!proofSufficiency || !proofReplay) {
      return {
        available: false,
        command,
        summary: 'Proof Receipt was missing replay or sufficiency evidence.',
        proofStatus: receipt.proofStatus.status,
        reviewerDecision: receipt.reviewerDecision,
        proofSufficiencyStatus: 'missing',
        proofReplayStatus: 'needs-proof',
        changedAfterProof: [],
        weakRequirements: [],
        missingRequirements: [],
        staleRequirements: [],
        failedRequirements: [],
        missingCommands: receipt.proofStatus.missingCommands,
        failedCommands: receipt.proofStatus.failedCommands,
        staleCommands: receipt.proofStatus.staleCommands,
        teamProofRecipes: [],
        requiredReviewers: [],
        recipeGaps: [],
        recipeDrift: [],
      };
    }
    return {
      available: true,
      command,
      summary: receipt.summary,
      proofStatus: receipt.proofStatus.status,
      reviewerDecision: receipt.reviewerDecision,
      scopeStatus: receipt.scope.status,
      riskDeltaDirection: receipt.riskDeltaDirection,
      proofSufficiencyStatus: proofSufficiency.status,
      proofReplayStatus: proofReplay.status,
      changedAfterProof: proofReplay.changedAfterProof,
      receiptFingerprint: proofReplay.receiptFingerprint,
      weakRequirements: proofSufficiency.weakRequirements,
      missingRequirements: proofSufficiency.missingRequirements,
      staleRequirements: proofSufficiency.staleRequirements,
      failedRequirements: proofSufficiency.failedRequirements,
      missingCommands: receipt.proofStatus.missingCommands,
      failedCommands: receipt.proofStatus.failedCommands,
      staleCommands: receipt.proofStatus.staleCommands,
      proofEvidenceSources: proofEvidenceSourcesFor(receipt.proofStatus.commandEvidence),
      teamProofRecipes: receipt.teamProofRecipes?.map((recipe) => recipe.id) ?? [],
      requiredReviewers: receipt.requiredReviewers ?? [],
      recipeGaps: receipt.recipeGaps ?? [],
      recipeDrift: receipt.recipeDrift ?? [],
    };
  } catch (error) {
    return {
      available: false,
      command,
      summary: `Proof Receipt unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      proofStatus: 'missing',
      reviewerDecision: 'needs-focused-review',
      proofSufficiencyStatus: 'missing',
      proofReplayStatus: 'needs-proof',
      changedAfterProof: [],
      weakRequirements: [],
      missingRequirements: [],
      staleRequirements: [],
      failedRequirements: [],
      missingCommands: [],
      failedCommands: [],
      staleCommands: [],
      teamProofRecipes: [],
      requiredReviewers: [],
      recipeGaps: [],
      recipeDrift: [],
    };
  }
}

function proofEvidenceSourcesFor(
  commandEvidence: Array<{ source?: string }>,
): EvidencePackProofEvidenceSources {
  const summary: EvidencePackProofEvidenceSources = {
    total: 0,
    executed: 0,
    recorded: 0,
    mission: 0,
    external: 0,
    unknown: 0,
  };
  for (const evidence of commandEvidence) {
    if (!evidence.source) continue;
    summary.total += 1;
    if (evidence.source === 'prove-run') {
      summary.executed += 1;
    } else if (evidence.source === 'prove-record') {
      summary.recorded += 1;
    } else if (evidence.source === 'mission') {
      summary.mission += 1;
    } else if (evidence.source === 'external') {
      summary.external += 1;
    } else {
      summary.unknown += 1;
    }
  }
  return summary;
}
