import type {
  DataflowRiskConfidence,
  DataflowRiskKind,
  DataflowRiskSeverity,
  GraphEvidenceSummary,
} from './graph.js';
import type { PrDiffReport } from './prDiff.js';
import type { ReviewContractChange } from './reviewContract.js';

/**
 * One changed file enriched with risk signals. The agent calling
 * projscan_review uses these to decide which files need careful review.
 */
export interface ReviewFile {
  relativePath: string;
  status: 'added' | 'removed' | 'modified';
  /** Hotspot risk score for the head version. null when file isn't in the hotspot scope. */
  riskScore: number | null;
  /** Cyclomatic complexity at head. null when no AST adapter parsed it. */
  cyclomaticComplexity: number | null;
  /** Delta from the structural diff (mirrors FileAstDiff.cyclomaticDelta). null when file was added/removed. */
  cyclomaticDelta: number | null;
  /** Number of exports added in this PR. */
  exportsAdded: number;
  /** Number of exports removed in this PR. */
  exportsRemoved: number;
  /** Number of imports added. */
  importsAdded: number;
  /** Number of imports removed. */
  importsRemoved: number;
  /** 1.9+ - set when `projscan_review` was called with an `intent` arg. Absent otherwise. */
  intentAlignment?: 'expected' | 'unexpected' | 'out-of-scope' | 'unknown';
}

/**
 * A circular import that exists at head and either didn't exist at base or
 * grew. Surfaced separately from the file list so reviewers see at-a-glance
 * whether the PR introduces new architectural debt.
 */
export interface ReviewCycle {
  files: string[];
  size: number;
  /**
   * 'new' = no overlap with any base cycle; 'expanded' = at least one new
   * file added to an existing cycle.
   */
  classification: 'new' | 'expanded';
  /** 1.9+ - set when `projscan_review` was called with an `intent` arg. Absent otherwise. */
  intentAlignment?: 'expected' | 'unexpected' | 'out-of-scope' | 'unknown';
}

/**
 * A function whose CC newly crossed a worry threshold (>= 10) at head, or
 * was added with high CC, or jumped by 5+ since base.
 */
export interface ReviewFunction {
  file: string;
  name: string;
  line: number;
  endLine: number;
  cyclomaticComplexity: number;
  /** CC at base. null when the function did not exist at base. */
  baseCc: number | null;
  /** Why this function shows up. */
  reason: 'added' | 'jumped' | 'crossed-threshold';
  /** 1.9+ - set when `projscan_review` was called with an `intent` arg. Absent otherwise. */
  intentAlignment?: 'expected' | 'unexpected' | 'out-of-scope' | 'unknown';
}

/**
 * 1.6+ - A taint flow that is NEW at head (not present at base). Mirrors
 * the core TaintFlow shape but is intentionally light - review summaries
 * should be readable in a glance, so we drop the per-step file list and
 * keep only the source/sink, the function pair, and the path length.
 */
export interface ReviewTaintFlow {
  sourceFn: string;
  sinkFn: string;
  source: string;
  sink: string;
  /** Hop count from source function to sink function, inclusive of both ends. */
  pathLength: number;
  /** First and last files in the path; same value when length = 1. */
  files: string[];
  /** 1.9+ - set when `projscan_review` was called with an `intent` arg. Absent otherwise. */
  intentAlignment?: 'expected' | 'unexpected' | 'out-of-scope' | 'unknown';
}

/**
 * 3.0+ - Review-time dataflow risks that are not represented by legacy
 * taint reachability, especially bridge helpers that call both a source
 * wrapper and a sink wrapper.
 */
export interface ReviewDataflowRisk {
  kind: DataflowRiskKind;
  sourceFn: string;
  sinkFn: string;
  bridgeFn?: string;
  source: string;
  sink: string;
  pathLength: number;
  files: string[];
  severity: DataflowRiskSeverity;
  confidence: DataflowRiskConfidence;
  intentAlignment?: 'expected' | 'unexpected' | 'out-of-scope' | 'unknown';
}

/** Workspace-package-scoped dependency change. Aggregates root + workspaces. */
export interface ReviewDependencyChange {
  /** Workspace name; '' for the root manifest. */
  workspace: string;
  manifestFile: string;
  added: Array<{ name: string; version: string; kind: 'dep' | 'dev' }>;
  removed: Array<{ name: string; version: string; kind: 'dep' | 'dev' }>;
  bumped: Array<{ name: string; from: string; to: string; kind: 'dep' | 'dev' }>;
  /** 1.9+ - set when `projscan_review` was called with an `intent` arg. Absent otherwise. */
  intentAlignment?: 'expected' | 'unexpected' | 'out-of-scope' | 'unknown';
}

/**
 * 1.5+ - `projscan_review` can shape its response at three tiers based
 * on a `max_cost_tokens` budget passed by the caller: full (no budget
 * or large budget), summary (3K-7K tokens), verdict-only (<3K).
 * Selected by `selectReviewTier` and surfaced as the `tier` field on
 * the response.
 */
export type ReviewTier = 'full' | 'summary' | 'verdict-only';

export interface ReviewReport {
  available: boolean;
  reason?: string;
  base: { ref: string; resolvedSha: string | null };
  head: { ref: string; resolvedSha: string | null };
  /** The structural diff (same shape as projscan_pr_diff). */
  prDiff: PrDiffReport;
  /** Each changed file annotated with risk + CC + delta. Sorted by risk desc. */
  changedFiles: ReviewFile[];
  /** Cycles introduced or expanded by this PR. Empty when none. */
  newCycles: ReviewCycle[];
  /** Functions that meaningfully grew or were added with high CC. Sorted by CC desc. */
  riskyFunctions: ReviewFunction[];
  /** package.json deltas across root + workspaces. */
  dependencyChanges: ReviewDependencyChange[];
  /**
   * 2.1+ - additive public contract changes such as export and package
   * entrypoint changes. Empty or absent when no contract signal is available.
   */
  contractChanges?: ReviewContractChange[];
  /**
   * 1.6+ - NEW source-to-sink taint flows introduced by this PR. Each
   * entry is a flow that exists at head but didn't exist at base
   * (matched by sourceFn + sinkFn pair). Empty when taint is unavailable
   * (no per-function callSites at either side).
   */
  newTaintFlows: ReviewTaintFlow[];
  /**
   * 3.0+ - NEW dataflow risks introduced by this PR that are outside the
   * legacy source-to-sink taint flow list. Empty when unavailable or clean.
   */
  newDataflowRisks: ReviewDataflowRisk[];
  /** 3.5+ - compact graph/dataflow evidence for review consumers. */
  graphEvidence?: GraphEvidenceSummary;
  /** 'ok' = ship it; 'review' = needs careful look; 'block' = strongly suggests rework. */
  verdict: 'ok' | 'review' | 'block';
  /** One-line bullets explaining the verdict. */
  summary: string[];
  /**
   * 1.5+ - which tier this report was shaped at. Absent when the full
   * report is returned without budget shaping.
   */
  tier?: ReviewTier;
  /**
   * 1.9+ - the parsed intent the agent passed (if any). Echo of the
   * raw string + the parser's classified action + extracted scope
   * tokens. Absent when `intent` arg wasn't provided.
   */
  intent?: {
    raw: string;
    action:
      | 'feature'
      | 'fix'
      | 'refactor'
      | 'perf'
      | 'test'
      | 'docs'
      | 'chore'
      | 'remove'
      | 'unknown';
    scopeTokens: string[];
  };
  /**
   * 1.9+ - per-alignment totals across all findings + a small sample
   * of "notable" (unexpected / out-of-scope) findings. Absent when
   * no intent was provided. Verdict is NOT affected by intent -
   * verdict stays structural.
   */
  intentAnalysis?: {
    totals: Record<'expected' | 'unexpected' | 'out-of-scope' | 'unknown', number>;
    notable: Array<{
      kind: 'file' | 'function' | 'cycle' | 'taint' | 'dataflow' | 'dependency';
      label: string;
      alignment: 'expected' | 'unexpected' | 'out-of-scope' | 'unknown';
      reason: string;
    }>;
  };
}
