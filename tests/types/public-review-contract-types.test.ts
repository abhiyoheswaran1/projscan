import { expect, test } from 'vitest';
import '../../src/types/reviewContract.js';
import type { ReviewContractChange } from '../../src/types/reviewContract.js';
import type { ReviewContractChange as BarrelReviewContractChange } from '../../src/types.js';

const kinds: ReviewContractChange['kind'][] = [
  'export-added',
  'export-removed',
  'export-renamed',
  'entrypoint-changed',
  'public-export-changed',
  'signature-changed',
];

const confidences: ReviewContractChange['confidence'][] = ['high', 'medium', 'low'];

const change: ReviewContractChange = {
  kind: 'signature-changed',
  file: 'src/types.ts',
  symbol: 'ReviewContractChange',
  before: 'inline public contract',
  after: 'focused public type module',
  confidence: 'high',
  why: 'Public API contract movement needs focused type coverage.',
};

const barrelChange: BarrelReviewContractChange = change;
const moduleChange: ReviewContractChange = barrelChange;

test('review contract public type compiles from the module and legacy barrel', () => {
  expect(kinds).toEqual([
    'export-added',
    'export-removed',
    'export-renamed',
    'entrypoint-changed',
    'public-export-changed',
    'signature-changed',
  ]);
  expect(confidences).toEqual(['high', 'medium', 'low']);
  expect(moduleChange.kind).toBe('signature-changed');
  expect(moduleChange.file).toBe('src/types.ts');
  expect(moduleChange.confidence).toBe('high');
  expect(moduleChange.why).toContain('Public API contract');
});
