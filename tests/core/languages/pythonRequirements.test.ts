import { describe, it, expect } from 'vitest';
import { parseRequirements, splitPep508 } from '../../../src/core/languages/pythonManifests.js';

describe('splitPep508', () => {
  it('splits plain name', () => {
    expect(splitPep508('requests')).toEqual({ name: 'requests', versionSpec: '' });
  });

  it('splits name + version', () => {
    expect(splitPep508('requests>=2.25.0')).toEqual({ name: 'requests', versionSpec: '>=2.25.0' });
    expect(splitPep508('django==4.2.1')).toEqual({ name: 'django', versionSpec: '==4.2.1' });
  });

  it('splits numeric-leading distribution names', () => {
    expect(splitPep508('3to2>=1.1.1')).toEqual({ name: '3to2', versionSpec: '>=1.1.1' });
  });

  it('strips extras', () => {
    expect(splitPep508('requests[security,socks]>=2')).toEqual({
      name: 'requests',
      versionSpec: '>=2',
    });
  });

  it('strips environment markers', () => {
    expect(splitPep508('foo; python_version < "3.10"')).toEqual({ name: 'foo', versionSpec: '' });
  });

  it('normalizes case', () => {
    expect(splitPep508('Requests')).toEqual({ name: 'requests', versionSpec: '' });
  });
});

describe('parseRequirements', () => {
  it('reads one package per line', () => {
    const txt = 'requests\nflask==2.0\ndjango>=4\n';
    const out = parseRequirements(txt, 'requirements.txt', 'main');
    expect(out.map((d) => d.name)).toEqual(['requests', 'flask', 'django']);
  });

  it('ignores comments and blank lines', () => {
    const txt = '# comment\n\nrequests\n  # indented comment\nflask==2.0\n';
    const out = parseRequirements(txt, 'requirements.txt', 'main');
    expect(out.map((d) => d.name)).toEqual(['requests', 'flask']);
  });

  it('skips requirements directives without declaring them as packages', () => {
    const txt = '-r other.txt\nrequests\n-e git+https://example.com/x.git#egg=x\n';
    const out = parseRequirements(txt, 'requirements.txt', 'main');
    expect(out.map((d) => d.name)).toEqual(['requests']);
  });

  it('records line numbers', () => {
    const txt = '# c1\nrequests\nflask==2\n';
    const out = parseRequirements(txt, 'r.txt', 'main');
    expect(out.find((d) => d.name === 'requests')?.line).toBe(2);
    expect(out.find((d) => d.name === 'flask')?.line).toBe(3);
  });

  it('reads numeric-leading distribution names', () => {
    const out = parseRequirements('3to2==1.1.1\n', 'requirements.txt', 'main');
    expect(out).toEqual([
      {
        name: '3to2',
        versionSpec: '==1.1.1',
        source: 'requirements.txt',
        line: 1,
        scope: 'main',
      },
    ]);
  });
});
