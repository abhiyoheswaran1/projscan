import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('bug hunt maintainability', () => {
  it('keeps preflight finding conversion out of the bug hunt orchestrator', () => {
    const bugHuntSource = fs.readFileSync('src/core/bugHunt.ts', 'utf8');
    expect(bugHuntSource).not.toContain('function preflightReasonToFinding');
    expect(bugHuntSource).not.toContain('function preflightReasonTitle');
    expect(bugHuntSource).not.toContain('function filesFromPreflightEvidence');
    expect(bugHuntSource).not.toContain('function isActionablePreflightReason');
    expect(bugHuntSource).not.toContain('function isBranchOnlyReleaseScaleReason');
    expect(bugHuntSource).not.toContain('function sortReviewContextFiles');
    expect(bugHuntSource).not.toContain('const PACKAGE_METADATA_RANKS');
    expect(bugHuntSource).not.toContain('const REVIEW_CONTEXT_RANKS');
    expect(bugHuntSource).toMatch(
      /import\s*\{[^}]*filesFromPreflightEvidence[^}]*isActionablePreflightReason[^}]*preflightReasonToFinding[^}]*\}\s*from '\.\/bugHuntPreflightFindings\.js';/s,
    );

    const preflightSource = fs.readFileSync('src/core/bugHuntPreflightFindings.ts', 'utf8');
    expect(preflightSource).toContain('export function isActionablePreflightReason');
    expect(preflightSource).toContain('export function preflightReasonToFinding');
    expect(preflightSource).toContain('export function filesFromPreflightEvidence');
    expect(preflightSource).not.toContain("from './bugHunt.js'");
  });

  it('keeps report queue assembly out of the bug hunt orchestrator', () => {
    const bugHuntSource = fs.readFileSync('src/core/bugHunt.ts', 'utf8');
    expect(bugHuntSource).not.toContain('function rankFindings');
    expect(bugHuntSource).not.toContain('function bugHuntFixQueue');
    expect(bugHuntSource).not.toContain('function bugHuntTopSuspects');
    expect(bugHuntSource).not.toContain('function bugHuntReviewQueue');
    expect(bugHuntSource).not.toContain('function bugHuntIsTruncated');
    expect(bugHuntSource).not.toContain('function summarize');
    expect(bugHuntSource).toMatch(
      /import\s*\{[^}]*assembleBugHuntQueues[^}]*summarizeBugHunt[^}]*\}\s*from '\.\/bugHuntReportAssembly\.js';/s,
    );

    const assemblySource = fs.readFileSync('src/core/bugHuntReportAssembly.ts', 'utf8');
    expect(assemblySource).toContain('export function assembleBugHuntQueues');
    expect(assemblySource).toContain('export function summarizeBugHunt');
    expect(assemblySource).not.toContain("from './bugHunt.js'");
  });

  it('keeps source finding mappers out of the bug hunt orchestrator', () => {
    const bugHuntSource = fs.readFileSync('src/core/bugHunt.ts', 'utf8');
    expect(bugHuntSource).not.toContain('function issueToFinding');
    expect(bugHuntSource).not.toContain('function conflictToFinding');
    expect(bugHuntSource).not.toContain('function filesFromIssue');
    expect(bugHuntSource).not.toContain('function severityPriority');
    expect(bugHuntSource).toMatch(
      /import\s*\{[^}]*conflictToBugHuntFinding[^}]*issueToBugHuntFinding[^}]*\}\s*from '\.\/bugHuntSourceFindings\.js';/s,
    );

    const sourceFindingsSource = fs.readFileSync('src/core/bugHuntSourceFindings.ts', 'utf8');
    expect(sourceFindingsSource).toContain('export function issueToBugHuntFinding');
    expect(sourceFindingsSource).toContain('export function conflictToBugHuntFinding');
    expect(sourceFindingsSource).not.toContain("from './bugHunt.js'");
  });
});
