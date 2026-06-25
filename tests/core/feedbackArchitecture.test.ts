import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('feedback architecture', () => {
  it('keeps feedback intake classification policy in a focused helper', () => {
    const feedbackSource = readSource('src/core/feedback.ts');
    const classifierPath = path.join(process.cwd(), 'src/core/feedbackIntakeClassifier.ts');

    expect(feedbackSource).toContain(
      "import { classifyFeedbackIntakeText } from './feedbackIntakeClassifier.js';",
    );
    expect(feedbackSource).not.toContain('function classifyCategory');
    expect(feedbackSource).not.toContain('function primarySignal');
    expect(feedbackSource).not.toContain('function agentloopCommandFor');
    expect(feedbackSource).not.toContain('function shellQuote');

    expect(existsSync(classifierPath)).toBe(true);
    const classifierSource = readFileSync(classifierPath, 'utf8');
    expect(classifierSource).toContain('export function classifyFeedbackIntakeText');
    expect(classifierSource).toContain('function classifyCategory');
    expect(classifierSource).toContain('function primarySignal');
    expect(classifierSource).toContain('function agentloopCommandFor');
    expect(classifierSource).not.toContain("from './feedback.js'");
  });
});

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}
