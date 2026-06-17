import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('release evidence architecture', () => {
  it('keeps baseline trend collection isolated from evidence pack orchestration', () => {
    const evidenceSource = readFileSync(
      path.join(process.cwd(), 'src/core/releaseEvidence.ts'),
      'utf8',
    );

    expect(evidenceSource).toContain("from './releaseEvidenceBaseline.js'");
    expect(evidenceSource).not.toContain('function safeBaselineTrend');
    expect(evidenceSource).not.toContain('loadBaseline');
    expect(evidenceSource).not.toContain('scanRepository');
    expect(evidenceSource).not.toContain('collectIssues');

    const baselineSource = readFileSync(
      path.join(process.cwd(), 'src/core/releaseEvidenceBaseline.ts'),
      'utf8',
    );
    expect(baselineSource).toContain('export async function safeBaselineTrend');
    expect(baselineSource).toContain('loadBaseline');
    expect(baselineSource).toContain('scanRepository');
  });

  it('keeps evidence comment exports on the existing runtime import edge', () => {
    const evidenceSource = readFileSync(
      path.join(process.cwd(), 'src/core/releaseEvidence.ts'),
      'utf8',
    );

    const evidenceCommentEdges = evidenceSource.match(/from '\.\/evidenceComment\.js'/g) ?? [];
    expect(evidenceCommentEdges).toHaveLength(1);
    expect(evidenceSource).toContain(
      'export { renderEvidencePackPrComment, validateEvidencePackPrComment };',
    );
  });

  it('keeps artifact assembly isolated from evidence pack orchestration', () => {
    const evidenceSource = readFileSync(
      path.join(process.cwd(), 'src/core/releaseEvidence.ts'),
      'utf8',
    );

    expect(evidenceSource).toContain("from './releaseEvidenceArtifacts.js'");
    expect(evidenceSource).not.toContain('function buildArtifacts');
    expect(evidenceSource).not.toContain('function bugHuntQueueEvidence');
    expect(evidenceSource).not.toContain('function statusFromPreflight');

    const artifactsSource = readFileSync(
      path.join(process.cwd(), 'src/core/releaseEvidenceArtifacts.ts'),
      'utf8',
    );
    expect(artifactsSource).toContain('export function buildEvidencePackArtifacts');
    expect(artifactsSource).toContain('export function statusFromPreflight');
  });

  it('keeps verdict and approval decisions isolated from evidence pack orchestration', () => {
    const evidenceSource = readFileSync(
      path.join(process.cwd(), 'src/core/releaseEvidence.ts'),
      'utf8',
    );

    expect(evidenceSource).toContain("from './releaseEvidenceVerdict.js'");
    expect(evidenceSource).not.toContain('function blockingEvidence');
    expect(evidenceSource).not.toContain('function packVerdict');
    expect(evidenceSource).not.toContain('function calibrateEvidencePackVerdict');
    expect(evidenceSource).not.toContain('function summarize');
    expect(evidenceSource).not.toContain('function approvalRecommendation');

    const verdictSource = readFileSync(
      path.join(process.cwd(), 'src/core/releaseEvidenceVerdict.ts'),
      'utf8',
    );
    expect(verdictSource).toContain('export function blockingEvidence');
    expect(verdictSource).toContain('export function evidencePackVerdict');
    expect(verdictSource).toContain('export function calibrateEvidencePackVerdict');
    expect(verdictSource).toContain('export function summarizeEvidencePack');
    expect(verdictSource).toContain('export function approvalRecommendation');
  });
});
