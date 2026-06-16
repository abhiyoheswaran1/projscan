import type { IssueLocation, IssueSeverity } from './common.js';

/**
 * Structured action prompt the agent can paste into its plan. Returned by
 * projscan_fix_suggest. projscan does not run an LLM - this is rule-driven
 * guidance with the issue, the location, and a one-paragraph instruction
 * the agent (LLM) is expected to act on.
 */
export interface FixSuggestion {
  /** Echoes the input issue id when matched. */
  issueId: string;
  /** Severity level passed through from the source issue. */
  severity: IssueSeverity;
  /** Issue category passed through. */
  category: string;
  /** One-line "what is wrong". */
  headline: string;
  /** 2-4 sentences of why this matters. Severity-anchored. */
  why: string;
  /** Affected locations (mirrors Issue.locations when known). */
  where: IssueLocation[];
  /** One-paragraph instruction for the driving agent. */
  instruction: string;
  /** Optional "verify the fix by..." note. */
  suggestedTest?: string;
  /** Optional related files (importers, peer rules) for context. */
  relatedFiles?: string[];
  /** Optional documentation links. */
  references?: string[];
}

/**
 * Markdown-rendered deep dive for a single issue. Returned by
 * projscan_explain_issue. Includes the surrounding code excerpt and any
 * git-log evidence of similar fixes already merged in this repo.
 */
export interface IssueExplanation {
  issueId: string;
  title: string;
  severity: IssueSeverity;
  category: string;
  headline: string;
  /** Source-code excerpt around the primary location. Empty when no location. */
  excerpt: { file: string; startLine: number; endLine: number; lines: string[] } | null;
  /** Other open issues touching the same file (id + title pairs). */
  relatedIssues: Array<{ id: string; title: string }>;
  /**
   * Git log references where this issue id (or its rule prefix) appears in a
   * commit message - hints at how teammates have addressed it before.
   * Empty when none found or git history unavailable.
   */
  similarFixes: Array<{ sha: string; subject: string; date: string }>;
  /** The full FixSuggestion if a template matched; null otherwise. */
  fix: FixSuggestion | null;
}

export interface Fix {
  id: string;
  title: string;
  description: string;
  issueId: string;
  apply: (rootPath: string) => Promise<void>;
}

export interface FixResult {
  fix: Fix;
  success: boolean;
  error?: string;
}
