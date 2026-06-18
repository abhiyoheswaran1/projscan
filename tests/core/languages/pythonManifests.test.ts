import { describe, it, expect } from 'vitest';
import {
  parsePyproject,
  parseRequirements,
  splitPep508,
} from '../../../src/core/languages/pythonManifests.js';

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

describe('parsePyproject (PEP 621)', () => {
  it('reads project.dependencies list', () => {
    const toml = [
      '[project]',
      'name = "myapp"',
      'dependencies = [',
      '  "requests>=2",',
      '  "flask==2.0",',
      ']',
    ].join('\n');
    const deps = parsePyproject(toml);
    expect(deps.map((d) => d.name).sort()).toEqual(['flask', 'requests']);
    expect(deps.every((d) => d.scope === 'main')).toBe(true);
  });

  it('reads project.optional-dependencies as dev scope', () => {
    const toml = [
      '[project]',
      'name = "myapp"',
      '[project.optional-dependencies]',
      'test = ["pytest>=7", "coverage==6.0"]',
    ].join('\n');
    const deps = parsePyproject(toml);
    expect(deps.map((d) => d.name).sort()).toEqual(['coverage', 'pytest']);
    expect(deps.every((d) => d.scope === 'dev')).toBe(true);
  });

  it('reads tool.poetry.dependencies with version strings', () => {
    const toml = [
      '[tool.poetry.dependencies]',
      'python = "^3.10"',
      'requests = "^2.25"',
      'sqlalchemy = { version = "^2.0", optional = true }',
    ].join('\n');
    const deps = parsePyproject(toml);
    expect(deps.map((d) => d.name).sort()).toEqual(['requests', 'sqlalchemy']);
    expect(deps.find((d) => d.name === 'requests')?.versionSpec).toBe('^2.25');
    expect(deps.find((d) => d.name === 'sqlalchemy')?.versionSpec).toBe('^2.0');
    expect(deps.find((d) => d.name === 'requests')?.line).toBe(3);
    expect(deps.find((d) => d.name === 'sqlalchemy')?.line).toBe(4);
  });

  it('reads poetry group deps as dev scope', () => {
    const toml = [
      '[tool.poetry.group.test.dependencies]',
      'pytest = "^7"',
      '[tool.poetry.group.dev.dependencies]',
      'black = "^23"',
    ].join('\n');
    const deps = parsePyproject(toml);
    const lines = Object.fromEntries(deps.map((d) => [d.name, d.line]));
    expect(deps.every((d) => d.scope === 'dev')).toBe(true);
    expect(deps.map((d) => d.name).sort()).toEqual(['black', 'pytest']);
    expect(lines).toMatchObject({ pytest: 2, black: 4 });
  });

  it('reads legacy poetry dev-dependencies as dev scope', () => {
    const toml = [
      '[tool.poetry.dependencies]',
      'requests = "^2"',
      '[tool.poetry.dev-dependencies]',
      'pytest = "^7"',
      'ruff = "^0.4"',
    ].join('\n');

    const deps = parsePyproject(toml);
    const scopes = Object.fromEntries(deps.map((d) => [d.name, d.scope]));
    const lines = Object.fromEntries(deps.map((d) => [d.name, d.line]));

    expect(scopes).toMatchObject({
      requests: 'main',
      pytest: 'dev',
      ruff: 'dev',
    });
    expect(lines).toMatchObject({ requests: 2, pytest: 4, ruff: 5 });
  });

  it('reads PEP 735 dependency groups as dev scope without include-group entries', () => {
    const toml = [
      '[dependency-groups]',
      'dev = ["pytest>=8", "ruff"]',
      'docs = [',
      '  "sphinx>=8",',
      '  { include-group = "dev" },',
      ']',
    ].join('\n');

    const deps = parsePyproject(toml);

    expect(deps.map((d) => d.name).sort()).toEqual(['pytest', 'ruff', 'sphinx']);
    expect(deps.every((d) => d.scope === 'dev')).toBe(true);
    expect(deps.find((d) => d.name === 'pytest')?.versionSpec).toBe('>=8');
    expect(deps.find((d) => d.name === 'sphinx')?.versionSpec).toBe('>=8');
  });
});
