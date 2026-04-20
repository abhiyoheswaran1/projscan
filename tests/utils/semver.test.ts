import { describe, it, expect } from 'vitest';
import { parse, compare, drift } from '../../src/utils/semver.js';

describe('parse', () => {
  it('handles plain versions', () => {
    expect(parse('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('strips range prefixes', () => {
    expect(parse('^1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parse('~2.0.0')).toEqual({ major: 2, minor: 0, patch: 0 });
    expect(parse('>=3.4.5')).toEqual({ major: 3, minor: 4, patch: 5 });
  });

  it('strips v prefix', () => {
    expect(parse('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('ignores prerelease/build metadata', () => {
    expect(parse('1.2.3-beta.1')).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parse('1.2.3+build.7')).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('returns null for non-semver', () => {
    expect(parse('latest')).toBeNull();
    expect(parse('*')).toBeNull();
    expect(parse('')).toBeNull();
  });
});

describe('compare', () => {
  it('orders by major, minor, patch', () => {
    expect(compare('1.0.0', '2.0.0')).toBeLessThan(0);
    expect(compare('1.2.0', '1.1.9')).toBeGreaterThan(0);
    expect(compare('1.2.3', '1.2.3')).toBe(0);
  });

  it('returns 0 for unparseable versions', () => {
    expect(compare('latest', '1.0.0')).toBe(0);
  });
});

describe('drift', () => {
  it('classifies major/minor/patch changes', () => {
    expect(drift('1.0.0', '2.0.0')).toBe('major');
    expect(drift('1.0.0', '1.1.0')).toBe('minor');
    expect(drift('1.0.0', '1.0.1')).toBe('patch');
    expect(drift('1.0.0', '1.0.0')).toBe('same');
  });

  it('returns unknown when inputs are null or unparseable', () => {
    expect(drift(null, '1.0.0')).toBe('unknown');
    expect(drift('1.0.0', null)).toBe('unknown');
    expect(drift('latest', '1.0.0')).toBe('unknown');
  });
});
