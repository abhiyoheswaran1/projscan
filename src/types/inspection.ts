import type { ExportInfo, ImportInfo, Issue } from './common.js';
import type { FileHotspot } from './hotspots.js';
import type { PreflightSuggestedAction } from './preflight.js';

export interface FileInspection {
  relativePath: string;
  exists: boolean;
  reason?: string;
  purpose: string;
  lineCount: number;
  sizeBytes: number;
  imports: ImportInfo[];
  exports: ExportInfo[];
  potentialIssues: string[];
  hotspot: FileHotspot | null;
  issues: Issue[];
  /** AST-derived McCabe complexity. null when no language adapter parsed this file. */
  cyclomaticComplexity?: number | null;
  /** Number of files that import this one. null when graph unavailable. */
  fanIn?: number | null;
  /** Number of locally-resolved imports this file makes. null when graph unavailable. */
  fanOut?: number | null;
  /** Adapter id (e.g. 'javascript', 'python'). Set when the graph was available. */
  language?: string;
  /** Concise follow-up commands for the inspected file. */
  suggestedNextActions?: PreflightSuggestedAction[];
  /**
   * Per-function McCabe CC (0.13.0+). Sorted by cyclomaticComplexity desc.
   * Empty array when the file has no functions or the adapter doesn't yet
   * support per-function granularity.
   */
  functions?: FunctionDetail[];
}

/**
 * Per-function CC entry exposed via projscan_file. Mirrors the internal
 * `FunctionInfo` from `core/ast.ts` but is part of the stable API surface.
 */
export interface FunctionDetail {
  name: string;
  /** 1-based start line. */
  line: number;
  /** 1-based end line. */
  endLine: number;
  cyclomaticComplexity: number;
  /**
   * Approximate fan-in (0.15.0+): count of other files whose `callSites`
   * include this function's bare name. Name-based and approximate; absent
   * when the graph couldn't compute it.
   */
  fanIn?: number;
}
