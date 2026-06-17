import { describe, expect, it } from 'vitest';
import { tokenizeIntent } from '../../src/core/intentRouterTokens.js';

describe('tokenizeIntent', () => {
  it('lowercases intent words and removes router stopwords', () => {
    expect(tokenizeIntent('How should I fix the issue?')).toEqual(['fix', 'issue']);
  });

  it('keeps numeric and hyphen-separated route signals', () => {
    expect(tokenizeIntent('port 3000 already-in-use')).toEqual([
      'port',
      '3000',
      'already',
      'use',
    ]);
  });
});
