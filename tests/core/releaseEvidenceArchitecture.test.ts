import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('release evidence architecture', () => {
  it('keeps Proof Receipt summarization in a focused helper', () => {
    const releaseEvidenceSource = readSource('src/core/releaseEvidence.ts');
    const proofReceiptPath = path.join(process.cwd(), 'src/core/releaseEvidenceProofReceipt.ts');

    expect(releaseEvidenceSource).toContain(
      "import { safeProofReceipt } from './releaseEvidenceProofReceipt.js';",
    );
    expect(releaseEvidenceSource).not.toContain('async function safeProofReceipt');
    expect(releaseEvidenceSource).not.toContain('Proof Receipt was missing replay or sufficiency evidence.');
    expect(releaseEvidenceSource).not.toContain('Proof Receipt unavailable:');

    expect(existsSync(proofReceiptPath)).toBe(true);
    const proofReceiptSource = readFileSync(proofReceiptPath, 'utf8');
    expect(proofReceiptSource).toContain('export async function safeProofReceipt');
    expect(proofReceiptSource).toContain('Proof Receipt was missing replay or sufficiency evidence.');
    expect(proofReceiptSource).toContain('Proof Receipt unavailable:');
    expect(proofReceiptSource).not.toContain("from './releaseEvidence.js'");
  });
});

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}
