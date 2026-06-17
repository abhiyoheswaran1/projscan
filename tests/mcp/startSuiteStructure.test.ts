import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('MCP start test suite structure', () => {
  it('keeps routing smoke coverage separate from proof handoff coverage', () => {
    const startPath = path.join(process.cwd(), 'tests/mcp/start.test.ts');
    const proofPath = path.join(process.cwd(), 'tests/mcp/startProofHandoff.test.ts');
    const startSource = readFileSync(startPath, 'utf8');

    expect(startSource.split(/\r?\n/).length).toBeLessThanOrEqual(70);
    expect(startSource).not.toContain('remainingProofItems');
    expect(existsSync(proofPath)).toBe(true);

    const proofSource = readFileSync(proofPath, 'utf8');
    expect(proofSource).toContain('remainingProofItems');
    expect(proofSource).toContain('projscan handoff');
    expect(proofSource).not.toContain("intent: 'is it safe to commit");
  });
});
