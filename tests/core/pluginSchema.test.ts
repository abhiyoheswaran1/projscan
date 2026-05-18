import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateManifest } from '../../src/core/plugins.js';

type Manifest = Record<string, unknown>;

const root = process.cwd();

function readJson(relativePath: string): Manifest {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8')) as Manifest;
}

function validateAgainstDocumentedSchema(manifest: Manifest): string[] {
  const errors: string[] = [];
  const allowedBase = new Set(['schemaVersion', 'name', 'kind', 'module', 'description']);
  if (manifest.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (typeof manifest.name !== 'string' || manifest.name.length === 0) errors.push('name is required');
  if (typeof manifest.module !== 'string' || manifest.module.length === 0) errors.push('module is required');
  if (manifest.description !== undefined && typeof manifest.description !== 'string') {
    errors.push('description must be a string');
  }

  if (manifest.kind === 'analyzer') {
    const allowed = new Set([...allowedBase, 'category']);
    for (const key of Object.keys(manifest)) {
      if (!allowed.has(key)) errors.push(`unexpected analyzer field: ${key}`);
    }
    if (typeof manifest.category !== 'string' || manifest.category.length === 0) {
      errors.push('category is required for analyzer plugins');
    }
  } else if (manifest.kind === 'reporter') {
    const allowed = new Set([...allowedBase, 'commands']);
    for (const key of Object.keys(manifest)) {
      if (!allowed.has(key)) errors.push(`unexpected reporter field: ${key}`);
    }
    const commands = manifest.commands;
    if (!Array.isArray(commands) || commands.length === 0) {
      errors.push('commands is required for reporter plugins');
    } else {
      const allowedCommands = new Set(['doctor', 'analyze', 'ci']);
      for (const command of commands) {
        if (typeof command !== 'string' || !allowedCommands.has(command)) {
          errors.push(`unsupported reporter command: ${String(command)}`);
        }
      }
    }
  } else {
    errors.push('kind must be analyzer or reporter');
  }

  return errors;
}

describe('documented plugin manifest schema', () => {
  it('documents analyzer and reporter manifest shapes', () => {
    const schema = readJson('docs/plugin.schema.json');

    expect(schema).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: 'projscan plugin manifest',
      oneOf: expect.any(Array),
    });
  });

  it('accepts documented analyzer and reporter examples', () => {
    const analyzer = readJson('docs/examples/plugins/policy.projscan-plugin.json');
    const reporter = readJson('docs/examples/plugins/team-radar.projscan-plugin.json');

    expect(validateAgainstDocumentedSchema(analyzer)).toEqual([]);
    expect(validateManifest(analyzer).ok).toBe(true);
    expect(validateAgainstDocumentedSchema(reporter)).toEqual([]);
    expect(validateManifest(reporter).ok).toBe(true);
  });

  it('keeps the documented reporter example executable for doctor payloads', async () => {
    const moduleUrl = pathToFileURL(join(root, 'docs/examples/plugins/team-radar.mjs')).href;
    const mod = (await import(moduleUrl)) as { default: { render: (context: unknown) => Promise<string> } };

    const rendered = await mod.default.render({
      command: 'doctor',
      payload: {
        health: { score: 87, grade: 'B' },
        issues: [{ id: 'one' }, { id: 'two' }],
      },
    });

    expect(rendered).toBe('team-radar doctor 87/100 B 2 issue(s)');
  });

  it('rejects analyzer and reporter manifests missing kind-specific fields', () => {
    expect(
      validateAgainstDocumentedSchema({
        schemaVersion: 1,
        name: 'missing-category',
        kind: 'analyzer',
        module: './policy.mjs',
      }),
    ).toContain('category is required for analyzer plugins');

    expect(
      validateAgainstDocumentedSchema({
        schemaVersion: 1,
        name: 'missing-commands',
        kind: 'reporter',
        module: './team-radar.mjs',
      }),
    ).toContain('commands is required for reporter plugins');
  });
});
