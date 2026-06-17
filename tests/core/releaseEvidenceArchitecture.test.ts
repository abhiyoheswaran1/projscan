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
});
