import { expect, test } from 'vitest';
import { buildProofCards } from '../../src/core/proofCards.js';
import type { BugHuntFinding } from '../../src/types.js';

test('issue-backed proof cards include inline and config suppression hints', () => {
  const [card] = buildProofCards({
    qualityRisks: [],
    bugHuntFindings: [
      bugHuntFinding({
        id: 'bh-issue-hardcoded-secret-src-auth-ts',
        title: 'Hardcoded secret',
        files: ['src/auth.ts'],
        evidence: [
          {
            source: 'doctor',
            issueId: 'hardcoded-secret',
            file: 'src/auth.ts',
            line: 9,
            message: 'Hardcoded secret',
          },
        ],
      }),
    ],
  });

  expect(card?.suppression.inlineHint).toBe(
    '// projscan-ignore-line hardcoded-secret -- reason',
  );
  expect(card?.suppression.configHint).toBe('"suppress": { "hardcoded-secret": ["src/auth.ts"] }');
  expect(card?.suppression.command).toContain('projscan feedback intake');
});

function bugHuntFinding(overrides: Partial<BugHuntFinding>): BugHuntFinding {
  return {
    id: 'bh-finding',
    priority: 'p1',
    source: 'doctor',
    title: 'Bug hunt finding',
    why: 'Finding evidence.',
    files: ['src/auth.ts'],
    evidence: [{ source: 'doctor', message: 'Finding evidence.' }],
    suggestedTools: ['projscan_doctor'],
    verification: {
      commands: ['projscan doctor --format json', 'npm test'],
      expected: 'The finding no longer appears and tests pass.',
    },
    ...overrides,
  };
}

