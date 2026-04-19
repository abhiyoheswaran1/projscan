import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import {
  inspectFile,
  extractImports,
  extractExports,
  inferPurpose,
  detectFileIssues,
} from '../../src/core/fileInspector.js';

describe('extractImports', () => {
  it('parses ES imports', () => {
    const src = `import foo from 'foo';\nimport { bar } from "./bar";\n`;
    const imports = extractImports(src);
    expect(imports.find((i) => i.source === 'foo')?.isRelative).toBe(false);
    expect(imports.find((i) => i.source === './bar')?.isRelative).toBe(true);
  });

  it('parses CommonJS require', () => {
    const src = `const fs = require('fs');\n`;
    const imports = extractImports(src);
    expect(imports.map((i) => i.source)).toContain('fs');
  });

  it('dedupes duplicates', () => {
    const src = `import foo from 'foo';\nimport 'foo';`;
    const imports = extractImports(src);
    expect(imports.filter((i) => i.source === 'foo')).toHaveLength(1);
  });
});

describe('extractExports', () => {
  it('catches functions, classes, variables, types, interfaces, defaults', () => {
    const src = `
export function a() {}
export class B {}
export const c = 1;
export type D = string;
export interface E {}
export default {};
`;
    const names = extractExports(src).map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(['a', 'B', 'c', 'D', 'E', 'default']));
  });
});

describe('inferPurpose', () => {
  it('recognizes tests', () => {
    expect(inferPurpose('/p/foo.test.ts', [])).toBe('Test file');
    expect(inferPurpose('/p/foo.spec.ts', [])).toBe('Test file');
  });

  it('recognizes index as barrel', () => {
    expect(inferPurpose('/p/index.ts', [])).toBe('Module entry point / barrel file');
  });

  it('falls back to class-based module for classes', () => {
    const purpose = inferPurpose('/p/foo.ts', [{ name: 'Foo', type: 'class' }]);
    expect(purpose).toBe('Class-based module');
  });
});

describe('detectFileIssues', () => {
  it('flags large files', () => {
    const issues = detectFileIssues('', 501);
    expect(issues.some((i) => i.includes('Large file'))).toBe(true);
  });

  it('flags TODO comments', () => {
    const issues = detectFileIssues('// TODO: fix this', 1);
    expect(issues.some((i) => i.includes('TODO'))).toBe(true);
  });

  it('flags console.log', () => {
    const issues = detectFileIssues('console.log("hi")', 1);
    expect(issues.some((i) => i.includes('console.log'))).toBe(true);
  });
});

describe('inspectFile', () => {
  it('returns exists=false for missing files', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-fi-'));
    const insp = await inspectFile(tmpRoot, 'nope.ts');
    expect(insp.exists).toBe(false);
    expect(insp.reason).toMatch(/not found/i);
  });

  it('refuses paths outside the project root', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-fi-'));
    const insp = await inspectFile(tmpRoot, '../../../etc/passwd');
    expect(insp.exists).toBe(false);
    expect(insp.reason).toMatch(/outside/i);
  });

  it('returns parsed metadata for a real file (without running full scan)', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-fi-'));
    await fs.writeFile(path.join(tmpRoot, 'sample.ts'), "export const foo = 1;\n");

    const insp = await inspectFile(tmpRoot, 'sample.ts', {
      scan: { files: [] },
      issues: [],
      hotspots: {
        available: true,
        window: { since: null, commitsScanned: 0 },
        hotspots: [],
        totalFilesRanked: 0,
      },
    });

    expect(insp.exists).toBe(true);
    expect(insp.exports.map((e) => e.name)).toContain('foo');
    expect(insp.hotspot).toBeNull();
    expect(insp.relativePath).toBe('sample.ts');
  });
});
