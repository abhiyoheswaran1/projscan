import { expect, test } from 'vitest';
import { normalizeStartOptions } from '../../src/core/startOptions.js';

test('normalizes start intent, limits, and explicit mode', () => {
  const normalized = normalizeStartOptions({
    intent: '  prepare   release   candidate  ',
    mode: 'release',
    maxTasks: 20.8,
    maxRisks: 0,
  });

  expect(normalized.intent).toBe('prepare release candidate');
  expect(normalized.mode).toBe('release');
  expect(normalized.modeResolution).toEqual({
    mode: 'release',
    source: 'explicit',
    reason: 'Mode release was provided explicitly.',
  });
  expect(normalized.maxTasks).toBe(12);
  expect(normalized.maxRisks).toBe(1);
});

test('uses defaults for invalid limits and truncates long intents', () => {
  const normalized = normalizeStartOptions({
    intent: ` ${'a'.repeat(260)} `,
    maxTasks: Number.NaN,
    maxRisks: Number.POSITIVE_INFINITY,
  });

  expect(normalized.intent).toBe('a'.repeat(240));
  expect(normalized.mode).toBe('before_edit');
  expect(normalized.modeResolution.source).toBe('default');
  expect(normalized.maxTasks).toBe(5);
  expect(normalized.maxRisks).toBe(5);
});

test('omits blank intents and floors numeric limits', () => {
  const normalized = normalizeStartOptions({
    intent: '   ',
    maxTasks: 2.9,
    maxRisks: 3.1,
  });

  expect(normalized.intent).toBeUndefined();
  expect(normalized.mode).toBe('before_edit');
  expect(normalized.maxTasks).toBe(2);
  expect(normalized.maxRisks).toBe(3);
});
