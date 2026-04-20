import { describe, it, expect } from 'vitest';
import { issuesToSarif } from '../../src/reporters/sarifReporter.js';
import type { Issue } from '../../src/types.js';

function issue(partial: Partial<Issue>): Issue {
  return {
    id: partial.id ?? 'test-rule',
    title: partial.title ?? 'Test',
    description: partial.description ?? 'Test description',
    severity: partial.severity ?? 'warning',
    category: partial.category ?? 'test',
    fixAvailable: partial.fixAvailable ?? false,
    fixId: partial.fixId,
    locations: partial.locations,
  };
}

describe('issuesToSarif', () => {
  it('produces a valid SARIF 2.1.0 log skeleton', () => {
    const sarif = issuesToSarif([], '0.3.0');
    expect(sarif.$schema).toMatch(/sarif-2\.1\.0/);
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0].tool.driver.name).toBe('projscan');
    expect(sarif.runs[0].tool.driver.version).toBe('0.3.0');
    expect(sarif.runs[0].results).toEqual([]);
  });

  it('creates one rule per unique issue id', () => {
    const issues = [
      issue({ id: 'a' }),
      issue({ id: 'a' }),
      issue({ id: 'b' }),
    ];
    const sarif = issuesToSarif(issues, '0.3.0');
    const rules = sarif.runs[0].tool.driver.rules;
    expect(rules.map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  it('maps severity to SARIF level', () => {
    const issues = [
      issue({ id: 'err', severity: 'error' }),
      issue({ id: 'warn', severity: 'warning' }),
      issue({ id: 'inf', severity: 'info' }),
    ];
    const sarif = issuesToSarif(issues, '0.3.0');
    const byId = Object.fromEntries(
      sarif.runs[0].results.map((r) => [r.ruleId, r.level]),
    );
    expect(byId).toEqual({ err: 'error', warn: 'warning', inf: 'note' });
  });

  it('emits physical locations when issue.locations is set', () => {
    const issues = [
      issue({
        id: 'secret',
        severity: 'error',
        locations: [{ file: 'src/config.ts', line: 42 }],
      }),
    ];
    const sarif = issuesToSarif(issues, '0.3.0');
    const loc = sarif.runs[0].results[0].locations[0].physicalLocation;
    expect(loc.artifactLocation.uri).toBe('src/config.ts');
    expect(loc.region?.startLine).toBe(42);
  });

  it('falls back to repository-root location when no locations provided', () => {
    const issues = [issue({ id: 'missing-readme' })];
    const sarif = issuesToSarif(issues, '0.3.0');
    const loc = sarif.runs[0].results[0].locations[0].physicalLocation;
    expect(loc.artifactLocation.uri).toBe('.');
    expect(loc.region).toBeUndefined();
  });

  it('normalizes Windows-style paths to POSIX', () => {
    const issues = [
      issue({ id: 'x', locations: [{ file: 'src\\a\\b.ts', line: 1 }] }),
    ];
    const sarif = issuesToSarif(issues, '0.3.0');
    expect(sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri).toBe(
      'src/a/b.ts',
    );
  });

  it('carries category and fix metadata in properties', () => {
    const issues = [
      issue({
        id: 'missing-prettier',
        category: 'formatting',
        fixAvailable: true,
        fixId: 'add-prettier',
      }),
    ];
    const sarif = issuesToSarif(issues, '0.3.0');
    expect(sarif.runs[0].results[0].properties).toEqual({
      category: 'formatting',
      fixAvailable: true,
      fixId: 'add-prettier',
    });
  });
});
