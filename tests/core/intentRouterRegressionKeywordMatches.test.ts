import { expect, test } from 'vitest';
import { regressionKeywordMatches } from '../../src/core/intentRouterRegressionKeywordMatches.js';

const tokens = (...values: string[]) => new Set(values);

test('matches agent harness proof keywords only when the intent asks for proof work', () => {
  const harnessProof = tokens('run', 'agentflight', 'verification');

  expect(regressionKeywordMatches('agentflight', harnessProof, false)).toBe(true);
  expect(regressionKeywordMatches('verification', harnessProof, false)).toBe(true);
  expect(regressionKeywordMatches('run', harnessProof, false)).toBe(true);

  expect(regressionKeywordMatches('agentloop', tokens('agentloop', 'next', 'build'), false)).toBe(
    false,
  );
});

test('keeps regression planning away from coverage lookup prompts', () => {
  const coverageLookup = tokens('which', 'files', 'have', 'no', 'tests');

  expect(regressionKeywordMatches('tests', coverageLookup, false)).toBe(false);
});

test('keeps local setup failures routed to regression planning', () => {
  const portFailure = tokens('port', '3000', 'already', 'use');

  expect(regressionKeywordMatches('port', portFailure, false)).toBe(true);
});
