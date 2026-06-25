import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('dogfood architecture', () => {
  it('keeps market validation policy in a focused helper', () => {
    const dogfoodSource = readSource('src/core/dogfood.ts');
    const marketValidationPath = path.join(process.cwd(), 'src/core/dogfoodMarketValidation.ts');

    expect(dogfoodSource).toMatch(
      /import\s*\{[^}]*buildMarketValidation[^}]*DOGFOOD_WITH_FEEDBACK_COMMAND[^}]*FEEDBACK_CAPTURE_COMMAND[^}]*\}\s*from '\.\/dogfoodMarketValidation\.js';/s,
    );
    expect(dogfoodSource).not.toContain('FEEDBACK_QUESTIONS');
    expect(dogfoodSource).toContain("from './dogfoodRepoEvaluation.js'");
    expect(dogfoodSource).not.toContain('function buildMarketValidation');
    expect(dogfoodSource).not.toContain('function buildProofGates');
    expect(dogfoodSource).not.toContain('function marketStatus');
    expect(dogfoodSource).not.toContain('function buildWebsiteProof');
    expect(dogfoodSource).not.toContain('function summarizeRepeatUse');
    expect(dogfoodSource).not.toContain('function countSignals');
    expect(dogfoodSource).not.toContain('function evaluateRepo');
    expect(dogfoodSource).not.toContain('function matchesRepoKey');
    expect(dogfoodSource).not.toContain('function summarizeRepoFeedback');
    expect(dogfoodSource).not.toContain('function buildGaps');
    expect(dogfoodSource).not.toContain('function statusFromGaps');
    expect(dogfoodSource).not.toContain('function cleanSignals');

    expect(existsSync(marketValidationPath)).toBe(true);
    const marketValidationSource = readFileSync(marketValidationPath, 'utf8');
    expect(marketValidationSource).toContain('export function buildMarketValidation');
    expect(marketValidationSource).toContain('function buildProofGates');
    expect(marketValidationSource).toContain('function buildWebsiteProof');
    expect(marketValidationSource).toContain('function summarizeRepeatUse');
    expect(marketValidationSource).toContain('function countSignals');
    expect(marketValidationSource).not.toContain("from './dogfood.js'");

    const repoEvaluationPath = path.join(process.cwd(), 'src/core/dogfoodRepoEvaluation.ts');
    expect(existsSync(repoEvaluationPath)).toBe(true);
    const repoEvaluationSource = readFileSync(repoEvaluationPath, 'utf8');
    expect(repoEvaluationSource).toContain('export async function evaluateDogfoodRepo');
    expect(repoEvaluationSource).toContain('export function normalizeDogfoodFeedback');
    expect(repoEvaluationSource).toContain('function buildGaps');
    expect(repoEvaluationSource).toContain('function matchesRepoKey');
    expect(repoEvaluationSource).not.toContain("from './dogfood.js'");
  });
});

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}
