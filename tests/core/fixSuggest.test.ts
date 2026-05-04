import { describe, it, expect } from 'vitest';
import { suggestFixForIssue, syntheticIssue, previewSuggestionForIssue, findIssue } from '../../src/core/fixSuggest.js';
import type { Issue } from '../../src/types.js';

function issue(partial: Partial<Issue>): Issue {
  return {
    id: 'unknown',
    title: 'Unknown',
    description: 'desc',
    severity: 'warning',
    category: 'general',
    fixAvailable: false,
    ...partial,
  };
}

describe('suggestFixForIssue (template registry)', () => {
  it('renders unused-dependency template with the dep name in the headline', async () => {
    const f = await suggestFixForIssue(issue({ id: 'unused-dependency-lodash' }), '/tmp');
    expect(f.headline).toContain('lodash');
    expect(f.instruction).toMatch(/remove/i);
    expect(f.instruction).toMatch(/disableRules/i);
  });

  it('renders the lockfile template with the install instruction', async () => {
    const f = await suggestFixForIssue(issue({ id: 'dep-risk-no-lockfile' }), '/tmp');
    expect(f.headline).toMatch(/lockfile/i);
    expect(f.instruction).toMatch(/npm install|pnpm install|yarn install/i);
  });

  it('renders cycle-detected template with the break-the-cycle guidance', async () => {
    const f = await suggestFixForIssue(issue({ id: 'cycle-detected-1' }), '/tmp');
    expect(f.headline).toMatch(/Circular import/i);
    expect(f.instruction).toMatch(/extract|inject|merge/i);
    expect(f.suggestedTest).toMatch(/cycles-only/);
  });

  it('falls back to a generic template for unknown issue ids', async () => {
    const f = await suggestFixForIssue(issue({ id: 'totally-made-up-rule', title: 'Made up' }), '/tmp');
    // Generic fallback echoes title as headline.
    expect(f.headline).toBe('Made up');
    expect(f.instruction).toContain('totally-made-up-rule');
  });

  it('routes Python missing-test-framework to the pytest variant', async () => {
    const f = await suggestFixForIssue(issue({ id: 'missing-python-test-framework' }), '/tmp');
    expect(f.instruction).toMatch(/pytest/i);
    expect(f.instruction).not.toMatch(/vitest/i);
  });

  it('routes JS missing-test-framework to the vitest variant', async () => {
    const f = await suggestFixForIssue(issue({ id: 'missing-test-framework' }), '/tmp');
    expect(f.instruction).toMatch(/vitest/i);
  });
});

describe('previewSuggestionForIssue (inline doctor preview)', () => {
  it('returns a one-line summary for known rules', () => {
    expect(previewSuggestionForIssue(issue({ id: 'dep-risk-no-lockfile' }))?.summary).toMatch(/npm install/i);
    expect(previewSuggestionForIssue(issue({ id: 'cycle-detected-1' }))?.summary).toMatch(/cycle/i);
  });
  it('returns null for issues with no template match', () => {
    expect(previewSuggestionForIssue(issue({ id: 'totally-unknown' }))).toBeNull();
  });
});

describe('eslint-* template (1.1.0)', () => {
  it('extracts the rule name into the headline', async () => {
    const f = await suggestFixForIssue(issue({ id: 'eslint-no-unused-vars' }), '/tmp');
    expect(f.headline).toContain('no-unused-vars');
  });

  it('emits a docs link as a reference', async () => {
    const f = await suggestFixForIssue(issue({ id: 'eslint-prefer-const' }), '/tmp');
    expect(f.references?.[0]).toBe('https://eslint.org/docs/latest/rules/prefer-const');
  });

  it('instruction includes both fix-it and disable-with-justification options', async () => {
    const f = await suggestFixForIssue(issue({ id: 'eslint-no-unused-vars' }), '/tmp');
    expect(f.instruction).toMatch(/eslint-disable-next-line no-unused-vars/);
    expect(f.instruction).toMatch(/fix the violation/i);
  });

  it('preview returns the rule-name hint for inline doctor display', () => {
    const p = previewSuggestionForIssue(issue({ id: 'eslint-no-unused-vars' }));
    expect(p?.summary).toContain('no-unused-vars');
  });
});

describe('python-type-error-* template (1.1.0)', () => {
  it('matches python-type-error- prefixed ids', async () => {
    const f = await suggestFixForIssue(
      issue({ id: 'python-type-error-arg-type', title: 'Argument 1 has incompatible type' }),
      '/tmp',
    );
    expect(f.headline).toMatch(/Python type error/i);
    expect(f.headline).toContain('Argument 1');
  });

  it('instruction covers annotation / narrowing / typed-ignore', async () => {
    const f = await suggestFixForIssue(issue({ id: 'python-type-error-arg-type' }), '/tmp');
    expect(f.instruction).toMatch(/annotation/i);
    expect(f.instruction).toMatch(/isinstance|narrow/i);
    expect(f.instruction).toMatch(/type: ignore/);
  });

  it('references mypy + pyright docs', async () => {
    const f = await suggestFixForIssue(issue({ id: 'python-type-error-return-value' }), '/tmp');
    expect(f.references?.some((r) => r.includes('mypy.readthedocs.io'))).toBe(true);
    expect(f.references?.some((r) => r.includes('microsoft.github.io/pyright'))).toBe(true);
  });

  it('preview returns a one-line hint for inline doctor display', () => {
    const p = previewSuggestionForIssue(issue({ id: 'python-type-error-return-value' }));
    expect(p?.summary).toMatch(/annotation|narrow|type: ignore/i);
  });
});

describe('syntheticIssue + findIssue', () => {
  it('synthesizes an issue with the requested rule + file', () => {
    const s = syntheticIssue('cycle-detected', 'src/a.ts');
    expect(s.id).toBe('cycle-detected');
    expect(s.locations?.[0].file).toBe('src/a.ts');
  });

  it('findIssue returns null when no match', () => {
    expect(findIssue([issue({ id: 'a' })], 'b')).toBeNull();
  });

  it('findIssue returns matching issue', () => {
    const target = issue({ id: 'target' });
    expect(findIssue([issue({ id: 'a' }), target], 'target')).toBe(target);
  });
});
