import { describe, it, expect } from 'vitest';
import { tokenize, expandQuery } from '../../src/core/searchIndex.js';

describe('searchIndex tokenization for Python', () => {
  it('splits snake_case identifiers', () => {
    const tokens = tokenize('verify_user_credentials');
    expect(tokens).toContain('verify');
    expect(tokens).toContain('user');
    // 'credentials' stems to 'credential' via the trailing-s stripper.
    expect(tokens).toContain('credential');
  });

  it('filters common Python keywords', () => {
    const tokens = tokenize('def class self lambda yield elif pass');
    // All are keywords → filtered
    expect(tokens).toEqual([]);
  });

  it('preserves non-keyword Python identifiers', () => {
    const tokens = tokenize('def authenticate_user(user, token): pass');
    expect(tokens).toContain('authenticate');
    expect(tokens).toContain('user');
    expect(tokens).toContain('token');
    expect(tokens).not.toContain('def');
    expect(tokens).not.toContain('pass');
  });

  it('expandQuery handles snake_case queries', () => {
    const tokens = expandQuery('verify_user');
    expect(tokens.some((t) => t.startsWith('verif'))).toBe(true);
    expect(tokens).toContain('user');
  });
});
