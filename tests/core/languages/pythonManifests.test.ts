import { describe, it, expect } from 'vitest';
import { parsePyproject } from '../../../src/core/languages/pythonManifests.js';

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
