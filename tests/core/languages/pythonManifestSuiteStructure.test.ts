import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('python manifest test suite structure', () => {
  it('keeps architecture guardrails separate from parser behavior coverage', () => {
    const parserPath = path.join(process.cwd(), 'tests/core/languages/pythonManifests.test.ts');
    const architecturePath = path.join(
      process.cwd(),
      'tests/core/languages/pythonManifestArchitecture.test.ts',
    );
    const projectDetectionPath = path.join(
      process.cwd(),
      'tests/core/languages/pythonProjectDetection.test.ts',
    );
    const parserSource = readFileSync(parserPath, 'utf8');

    expect(parserSource.split(/\r?\n/).length).toBeLessThanOrEqual(320);
    expect(parserSource).not.toContain("describe('python manifest maintainability'");
    expect(parserSource).not.toContain("describe('detectPythonProject'");
    expect(parserSource).not.toContain('inspectRepoSourceFile');
    expect(existsSync(architecturePath)).toBe(true);
    expect(existsSync(projectDetectionPath)).toBe(true);

    const architectureSource = readFileSync(architecturePath, 'utf8');
    expect(architectureSource).toContain("describe('python manifest maintainability'");
    expect(architectureSource).not.toContain('parseRequirements(');
    expect(architectureSource).not.toContain('detectPythonProject(');

    const projectDetectionSource = readFileSync(projectDetectionPath, 'utf8');
    expect(projectDetectionSource).toContain("describe('detectPythonProject'");
    expect(projectDetectionSource).not.toContain('parsePyproject(');
  });
});
