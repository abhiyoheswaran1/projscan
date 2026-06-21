import { expect, test } from 'vitest';
import { buildProofCards } from '../../src/core/proofCards.js';
import type { BugHuntFinding, QualityScorecardRisk } from '../../src/types.js';

test('buildProofCards turns quality risks into evidence-backed cards', () => {
  const cards = buildProofCards({
    goal: 'make this repo safer',
    qualityRisks: [
      qualityRisk({
        id: 'qs-hotspot-src-core-bughunt-ts',
        priority: 'p1',
        title: 'Hotspot src/core/bugHunt.ts',
        files: ['src/core/bugHunt.ts'],
        source: 'hotspot',
        command: 'projscan file src/core/bugHunt.ts --format json',
      }),
    ],
    bugHuntFindings: [],
    maxCards: 3,
  });

  expect(cards[0]).toMatchObject({
    priority: 'p1',
    source: 'hotspot',
    finding: 'Hotspot src/core/bugHunt.ts',
    confidence: 'medium',
  });
  expect(cards[0]?.evidence[0]?.source).toBe('quality-scorecard');
  expect(cards[0]?.verification.commands).toContain('projscan quality-scorecard --format json');
  expect(cards[0]?.verification.commands).toContain(
    'projscan simulate --plan "Reduce the risk behind Hotspot src/core/bugHunt.ts" --format json',
  );
  expect(cards[0]?.feedback.command).toContain('projscan feedback intake');
});

test('buildProofCards prefers concrete bug-hunt findings before same-priority hotspots', () => {
  const cards = buildProofCards({
    goal: 'fix the riskiest issue',
    qualityRisks: [
      qualityRisk({
        id: 'qs-hotspot-src-large-ts',
        priority: 'p1',
        title: 'Hotspot src/large.ts',
        files: ['src/large.ts'],
        source: 'hotspot',
        command: 'projscan file src/large.ts --format json',
      }),
    ],
    bugHuntFindings: [
      bugHuntFinding({
        id: 'bh-issue-hardcoded-secret-src-auth-ts',
        priority: 'p1',
        source: 'doctor',
        title: 'Hardcoded secret',
        why: 'A high-confidence secret-like value is assigned in source.',
        files: ['src/auth.ts'],
      }),
    ],
    maxCards: 3,
  });

  expect(cards.map((card) => card.id)).toEqual([
    'proof-bh-issue-hardcoded-secret-src-auth-ts',
    'proof-qs-hotspot-src-large-ts',
  ]);
  expect(cards[0]?.confidence).toBe('high');
  expect(cards[0]?.verification.commands).toContain('projscan doctor --format json');
});

function qualityRisk(overrides: Partial<QualityScorecardRisk>): QualityScorecardRisk {
  return {
    id: 'qs-risk',
    priority: 'p2',
    title: 'Quality risk',
    files: [],
    source: 'issue',
    command: 'projscan quality-scorecard --format json',
    ...overrides,
  };
}

function bugHuntFinding(overrides: Partial<BugHuntFinding>): BugHuntFinding {
  return {
    id: 'bh-finding',
    priority: 'p2',
    source: 'doctor',
    title: 'Bug hunt finding',
    why: 'Finding evidence.',
    files: [],
    evidence: [{ source: 'doctor', message: 'Finding evidence.' }],
    suggestedTools: ['projscan_doctor'],
    verification: {
      commands: ['projscan doctor --format json', 'npm test'],
      expected: 'The finding no longer appears and tests pass.',
    },
    ...overrides,
  };
}
