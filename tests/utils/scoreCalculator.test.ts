import { describe, it, expect } from 'vitest';
import { calculateScore, badgeUrl, badgeMarkdown } from '../../src/utils/scoreCalculator.js';
import type { Issue } from '../../src/types.js';

function makeIssue(severity: 'error' | 'warning' | 'info'): Issue {
  return {
    id: `test-${severity}`,
    title: `Test ${severity}`,
    description: `A test ${severity}`,
    severity,
    category: 'test',
    fixAvailable: false,
  };
}

describe('calculateScore', () => {
  it('returns A (100) for zero issues', () => {
    const result = calculateScore([]);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
  });

  it('deducts 20 points per error', () => {
    const result = calculateScore([makeIssue('error')]);
    expect(result.score).toBe(80);
    expect(result.grade).toBe('B');
  });

  it('deducts 10 points per warning', () => {
    const result = calculateScore([makeIssue('warning'), makeIssue('warning')]);
    expect(result.score).toBe(80);
    expect(result.grade).toBe('B');
  });

  it('deducts 3 points per info', () => {
    const result = calculateScore([makeIssue('info')]);
    expect(result.score).toBe(97);
    expect(result.grade).toBe('A');
  });

  it('returns F for many issues', () => {
    const issues = [
      makeIssue('error'),
      makeIssue('error'),
      makeIssue('error'),
    ];
    const result = calculateScore(issues);
    expect(result.score).toBe(40);
    expect(result.grade).toBe('F');
  });

  it('never goes below 0', () => {
    const issues = Array.from({ length: 10 }, () => makeIssue('error'));
    const result = calculateScore(issues);
    expect(result.score).toBe(0);
    expect(result.grade).toBe('F');
  });

  it('returns correct counts', () => {
    const issues = [makeIssue('error'), makeIssue('warning'), makeIssue('info'), makeIssue('info')];
    const result = calculateScore(issues);
    expect(result.errors).toBe(1);
    expect(result.warnings).toBe(1);
    expect(result.infos).toBe(2);
  });

  it('returns C for 3 warnings and 1 info', () => {
    const issues = [makeIssue('warning'), makeIssue('warning'), makeIssue('warning'), makeIssue('info')];
    const result = calculateScore(issues);
    expect(result.score).toBe(67);
    expect(result.grade).toBe('D');
  });
});

describe('badgeUrl', () => {
  it('returns shields.io URL with correct grade and color', () => {
    expect(badgeUrl('A')).toBe('https://img.shields.io/badge/projscan-A-brightgreen');
    expect(badgeUrl('B')).toBe('https://img.shields.io/badge/projscan-B-green');
    expect(badgeUrl('C')).toBe('https://img.shields.io/badge/projscan-C-yellow');
    expect(badgeUrl('D')).toBe('https://img.shields.io/badge/projscan-D-orange');
    expect(badgeUrl('F')).toBe('https://img.shields.io/badge/projscan-F-red');
  });
});

describe('badgeMarkdown', () => {
  it('returns markdown image link', () => {
    const md = badgeMarkdown('A');
    expect(md).toContain('[![projscan health]');
    expect(md).toContain('brightgreen');
    expect(md).toContain('github.com/abhiyoheswaran1/devlens');
  });
});
