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
  expect(cards[0]?.evidenceStrength).toEqual(
    expect.objectContaining({
      level: 'moderate',
      score: expect.any(Number),
      sources: ['quality-scorecard'],
    }),
  );
  expect(cards[0]?.confidenceReason).toContain('medium confidence');
  expect(cards[0]?.evidenceGaps).toContain('No direct bug-hunt or doctor finding is attached.');
  expect(cards[0]?.ranking.reasons).toContain('priority p1');
  expect(cards[0]?.ranking.reasons).toContain('source hotspot');
  expect(cards[0]?.trustMemory.status).toBe('none');
  expect(cards[0]?.agentHandoff).toEqual(
    expect.objectContaining({
      title: 'Reduce risk: Hotspot src/core/bugHunt.ts',
      files: ['src/core/bugHunt.ts'],
      verificationCommands: expect.arrayContaining(['projscan quality-scorecard --format json']),
      doneCriteria: expect.arrayContaining([
        'The proof card remains explainable, the relevant risk drops, and tests pass.',
      ]),
    }),
  );
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
  expect(cards[0]?.confidenceReason).toContain('high confidence');
  expect(cards[0]?.evidenceStrength.level).toBe('strong');
  expect(cards[0]?.evidenceGaps).toEqual([]);
  expect(cards[0]?.verification.commands).toContain('projscan doctor --format json');
});

test('buildProofCards applies local trust memory to ranking and confidence', () => {
  const cards = buildProofCards({
    goal: 'choose the trusted daily action',
    qualityRisks: [
      qualityRisk({
        id: 'qs-hotspot-src-core-bughunt-ts',
        priority: 'p1',
        title: 'Hotspot src/core/bugHunt.ts',
        files: ['src/core/bugHunt.ts'],
        source: 'hotspot',
        command: 'projscan file src/core/bugHunt.ts --format json',
      }),
      qualityRisk({
        id: 'qs-hotspot-src-core-workplan-ts',
        priority: 'p1',
        title: 'Hotspot src/core/workplan.ts',
        files: ['src/core/workplan.ts'],
        source: 'hotspot',
        command: 'projscan file src/core/workplan.ts --format json',
      }),
    ],
    bugHuntFindings: [],
    trustMemory: {
      path: '.projscan-feedback.json',
      responses: [
        {
          useful: true,
          minutesSaved: 15,
          note: 'workplan proof card was useful and prevented a bad edit',
        },
        {
          useful: false,
          noisyFindings: ['Hotspot src/core/bugHunt.ts'],
          note: 'bugHunt hotspot was noisy background',
        },
      ],
    },
  });

  expect(cards[0]?.files).toEqual(['src/core/workplan.ts']);
  expect(cards[0]?.trustMemory.status).toBe('helpful');
  expect(cards[0]?.ranking.reasons).toContain('trust memory helpful');
  const noisy = cards.find((card) => card.files.includes('src/core/bugHunt.ts'));
  expect(noisy?.trustMemory.status).toBe('noisy');
  expect(noisy?.confidence).toBe('low');
  expect(noisy?.evidenceGaps).toContain('Reviewer feedback marked this signal noisy or false-positive.');
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
