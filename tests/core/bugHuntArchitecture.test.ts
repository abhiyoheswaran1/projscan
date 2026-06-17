import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('bug hunt maintainability', () => {
  it('keeps preflight finding conversion out of the bug hunt orchestrator', () => {
    const bugHuntSource = fs.readFileSync('src/core/bugHunt.ts', 'utf8');
    expect(bugHuntSource).not.toContain('function preflightReasonToFinding');
    expect(bugHuntSource).not.toContain('function preflightReasonTitle');
    expect(bugHuntSource).not.toContain('function filesFromPreflightEvidence');
    expect(bugHuntSource).not.toContain('function sortReviewContextFiles');
    expect(bugHuntSource).not.toContain('const PACKAGE_METADATA_RANKS');
    expect(bugHuntSource).not.toContain('const REVIEW_CONTEXT_RANKS');
    expect(bugHuntSource).toMatch(
      /import\s*\{[^}]*filesFromPreflightEvidence[^}]*preflightReasonToFinding[^}]*\}\s*from '\.\/bugHuntPreflightFindings\.js';/s,
    );

    const preflightSource = fs.readFileSync('src/core/bugHuntPreflightFindings.ts', 'utf8');
    expect(preflightSource).toContain('export function preflightReasonToFinding');
    expect(preflightSource).toContain('export function filesFromPreflightEvidence');
    expect(preflightSource).not.toContain("from './bugHunt.js'");
  });
});
