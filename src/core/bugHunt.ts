import { analyzeHotspots } from './hotspotAnalyzer.js';
import { collectIssues } from './issueEngine.js';
import { fixFirstFromBugHuntFinding } from './fixFirst.js';
import { hotspotToFinding } from './bugHuntHotspotFindings.js';
import {
  filesFromPreflightEvidence,
  isActionablePreflightReason,
  preflightReasonToFinding,
} from './bugHuntPreflightFindings.js';
import {
  assembleBugHuntQueues,
  buildBugHuntVerificationMatrix,
  summarizeBugHunt,
} from './bugHuntReportAssembly.js';
import {
  conflictToBugHuntFinding,
  issueToBugHuntFinding,
} from './bugHuntSourceFindings.js';
import { computePreflight } from './preflight.js';
import { scanRepository } from './repositoryScanner.js';
import { buildRiskNow } from './sessionResources.js';
import { buildCodeGraph } from './codeGraph.js';
import { loadConfig, applyConfigToIssues } from '../utils/config.js';
import { calculateScore } from '../utils/scoreCalculator.js';
import type {
  BugHuntFinding,
  BugHuntReport,
  SessionConflict,
} from '../types.js';

export interface ComputeBugHuntOptions {
  maxFindings?: number;
  since?: string;
}

const DEFAULT_MAX_FINDINGS = 10;

export async function computeBugHunt(
  rootPath: string,
  options: ComputeBugHuntOptions = {},
): Promise<BugHuntReport> {
  const maxFindings = normalizeMax(options.maxFindings);
  const configResult = await loadConfig(rootPath).catch(() => ({ config: { ignore: [] } }));
  const scan = await scanRepository(rootPath, {
    ignore: configResult.config.ignore,
    countIgnoredFiles: false,
  });
  const issues = applyConfigToIssues(
    await collectIssues(rootPath, scan.files),
    configResult.config,
  );
  const health = calculateScore(issues);
  const preflight = await computePreflight(rootPath, { mode: 'before_commit' });
  const actionablePreflightReasons = preflight.reasons.filter((reason) =>
    isActionablePreflightReason(reason, preflight.evidence),
  );
  const ignoredPreflightReasonCount = Math.max(
    0,
    preflight.reasons.length - actionablePreflightReasons.length,
  );
  const preflightChangedFiles = filesFromPreflightEvidence(
    preflight.evidence.changedFiles?.files ?? [],
  );
  const riskNow = await safeRiskNow(rootPath);
  const graph = await buildCodeGraph(rootPath, scan.files).catch(() => undefined);
  const hotspots = await analyzeHotspots(rootPath, scan.files, issues, {
    limit: maxFindings,
    since: options.since,
    ...(graph ? { graph } : {}),
  });

  const queues = assembleBugHuntQueues({
    findings: [
      ...issues.map(issueToBugHuntFinding),
      ...actionablePreflightReasons.map((reason, index) =>
        preflightReasonToFinding(reason, index, preflightChangedFiles),
      ),
      ...riskNow.conflicts.map(conflictToBugHuntFinding),
      ...hotspotFindings(hotspots),
    ],
    issues,
    actionablePreflightReasons,
    maxFindings,
  });
  const fixFirst = fixFirstFromBugHuntFinding(queues.fixQueue[0]);

  return {
    schemaVersion: 1,
    verdict: queues.verdict,
    summary: summarizeBugHunt(queues.verdict, queues.fixQueue, queues.reviewQueue),
    health,
    evidence: bugHuntEvidence(
      health,
      hotspots.available ? hotspots.hotspots.length : 0,
      preflight.verdict,
      actionablePreflightReasons.length,
      ignoredPreflightReasonCount,
      riskNow,
    ),
    topSuspects: queues.topSuspects,
    fixQueue: queues.fixQueue,
    reviewQueue: queues.reviewQueue,
    ...(fixFirst ? { fixFirst } : {}),
    verificationMatrix: buildBugHuntVerificationMatrix(queues.verdict, queues.fixQueue),
    ...(queues.truncated ? { truncated: true } : {}),
  };
}

function hotspotFindings(
  hotspots: Awaited<ReturnType<typeof analyzeHotspots>>,
): BugHuntFinding[] {
  return hotspots.available ? hotspots.hotspots.map(hotspotToFinding) : [];
}

function bugHuntEvidence(
  health: BugHuntReport['health'],
  hotspotCount: number,
  preflightVerdict: BugHuntReport['evidence']['preflightVerdict'],
  preflightActionableReasonCount: number,
  preflightIgnoredReasonCount: number,
  riskNow: { touchedFiles: string[]; conflicts: SessionConflict[] },
): BugHuntReport['evidence'] {
  return {
    issueCounts: {
      errors: health.errors,
      warnings: health.warnings,
      infos: health.infos,
    },
    hotspotCount,
    preflightVerdict,
    preflightActionableReasonCount,
    preflightIgnoredReasonCount,
    touchedFiles: riskNow.touchedFiles,
    conflicts: riskNow.conflicts.length,
  };
}

async function safeRiskNow(
  rootPath: string,
): Promise<{ touchedFiles: string[]; conflicts: SessionConflict[] }> {
  try {
    return await buildRiskNow(rootPath);
  } catch {
    return { touchedFiles: [], conflicts: [] };
  }
}

function normalizeMax(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MAX_FINDINGS;
  return Math.max(1, Math.min(25, Math.floor(value)));
}
