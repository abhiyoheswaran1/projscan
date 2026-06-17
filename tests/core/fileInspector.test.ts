import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { inspectFile, inferPurpose, detectFileIssues } from '../../src/core/fileInspector.js';
import type { FileEntry, Issue } from '../../src/types.js';

describe('deprecated extractor exports', () => {
  it('does not expose the removed regex import/export helpers', async () => {
    const mod = await import('../../src/core/fileInspector.js');
    expect(['extract', 'Imports'].join('') in mod).toBe(false);
    expect(['extract', 'Exports'].join('') in mod).toBe(false);
  });

  it('keeps purpose inference rules out of the file inspector orchestrator', () => {
    const inspectorSource = readFileSync(
      path.join(process.cwd(), 'src/core/fileInspector.ts'),
      'utf8',
    );
    expect(inspectorSource).not.toContain('NAME_RULES');
    expect(inspectorSource).not.toContain('DIR_RULES');
    expect(inspectorSource).not.toContain('function inferPurposeFromExports');

    const purposeSource = readFileSync(
      path.join(process.cwd(), 'src/core/filePurpose.ts'),
      'utf8',
    );
    expect(purposeSource).not.toContain("from './fileInspector.js'");
  });

  it('keeps graph export type mapping out of the file inspector orchestrator', () => {
    const inspectorSource = readFileSync(
      path.join(process.cwd(), 'src/core/fileInspector.ts'),
      'utf8',
    );
    expect(inspectorSource).not.toContain('function mapExportType');

    const exportTypeSource = readFileSync(
      path.join(process.cwd(), 'src/core/fileExportTypes.ts'),
      'utf8',
    );
    expect(exportTypeSource).not.toContain("from './fileInspector.js'");
  });

  it('keeps file issue detection out of the file inspector orchestrator', () => {
    const inspectorSource = readFileSync(
      path.join(process.cwd(), 'src/core/fileInspector.ts'),
      'utf8',
    );
    expect(inspectorSource).not.toContain('function detectFileIssues');

    const issueSource = readFileSync(path.join(process.cwd(), 'src/core/fileIssues.ts'), 'utf8');
    expect(issueSource).not.toContain("from './fileInspector.js'");
  });

  it('keeps graph metric shaping out of the file inspector orchestrator', () => {
    const inspectorSource = readFileSync(
      path.join(process.cwd(), 'src/core/fileInspector.ts'),
      'utf8',
    );
    expect(inspectorSource).not.toContain('for (const importers of graph.localImporters.values())');
    expect(inspectorSource).not.toContain('b.cyclomaticComplexity - a.cyclomaticComplexity');

    const metricsSource = readFileSync(
      path.join(process.cwd(), 'src/core/fileGraphMetrics.ts'),
      'utf8',
    );
    expect(metricsSource).not.toContain("from './fileInspector.js'");
  });

  it('keeps graph loading and import/export shaping out of the file inspector orchestrator', () => {
    const inspectorSource = readFileSync(
      path.join(process.cwd(), 'src/core/fileInspector.ts'),
      'utf8',
    );
    expect(inspectorSource).not.toContain('loadCachedGraph');
    expect(inspectorSource).not.toContain('saveCachedGraph');
    expect(inspectorSource).not.toContain('mapExportType');
    expect(inspectorSource).not.toContain('i.source.startsWith');

    const graphSource = readFileSync(
      path.join(process.cwd(), 'src/core/fileInspectionGraph.ts'),
      'utf8',
    );
    expect(graphSource).not.toContain("from './fileInspector.js'");
  });

  it('keeps file access path safety out of the file inspector orchestrator', () => {
    const inspectorSource = readFileSync(
      path.join(process.cwd(), 'src/core/fileInspector.ts'),
      'utf8',
    );
    expect(inspectorSource).not.toContain('path.isAbsolute(relOrAbsFile)');
    expect(inspectorSource).not.toContain('fs.realpath');

    const accessSource = readFileSync(path.join(process.cwd(), 'src/core/fileAccess.ts'), 'utf8');
    expect(accessSource).not.toContain("from './fileInspector.js'");
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

  it('refuses absolute paths (security regression)', async () => {
    // 1.6.2+ — the docs claim "relative to project root" but the prior
    // implementation silently honored absolute paths. Reject up front.
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-fi-'));
    const insp = await inspectFile(tmpRoot, '/etc/passwd');
    expect(insp.exists).toBe(false);
    expect(insp.reason).toMatch(/Absolute paths are not accepted/);
  });

  it('refuses to follow a symlink that points outside the project root (security regression)', async () => {
    // 1.6.2+ — without realpath resolution, a symlink under the repo
    // (e.g. cache/keys.pem → /etc/passwd) passes the prefix check but
    // reads attacker-chosen content.
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-fi-'));
    const escapeTarget = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-fi-escape-'));
    await fs.writeFile(path.join(escapeTarget, 'secret.txt'), 'PWNED');
    try {
      await fs.symlink(path.join(escapeTarget, 'secret.txt'), path.join(tmpRoot, 'leak.txt'));
    } catch {
      // Some platforms (Windows without privilege) can't create symlinks;
      // skip the assertion in that case.
      return;
    }
    const insp = await inspectFile(tmpRoot, 'leak.txt');
    expect(insp.exists).toBe(false);
    expect(insp.reason).toMatch(/outside/i);
    await fs.rm(escapeTarget, { recursive: true, force: true });
  });

  it('follows symlinks that stay inside the project root', async () => {
    // Sanity check: in-repo symlinks (e.g. monorepo plumbing) remain
    // readable. Only escapes are blocked.
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-fi-'));
    await fs.writeFile(path.join(tmpRoot, 'real.ts'), `export const x = 1;\n`);
    try {
      await fs.symlink(path.join(tmpRoot, 'real.ts'), path.join(tmpRoot, 'aliased.ts'));
    } catch {
      return;
    }
    const insp = await inspectFile(tmpRoot, 'aliased.ts');
    expect(insp.exists).toBe(true);
    // Reported relativePath is the user-supplied alias (not the symlink target).
    expect(insp.relativePath).toBe('aliased.ts');
  });

  it('returns graph-backed JavaScript imports and exports for a real file', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-fi-'));
    await fs.writeFile(path.join(tmpRoot, 'dep.ts'), 'export const bar = 1;\n');
    await fs.writeFile(
      path.join(tmpRoot, 'sample.ts'),
      "import { bar } from './dep';\nexport const foo = bar;\n",
    );

    const insp = await inspectFile(tmpRoot, 'sample.ts');

    expect(insp.exists).toBe(true);
    expect(insp.imports.map((i) => i.source)).toContain('./dep');
    expect(insp.exports.map((e) => e.name)).toContain('foo');
    expect(insp.hotspot).toBeNull();
    expect(insp.relativePath).toBe('sample.ts');
  });

  it('uses exact issue locations before legacy text matching', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-fi-'));
    await fs.mkdir(path.join(tmpRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(tmpRoot, 'src/a.ts'), 'export const a = 1;\n');
    await fs.writeFile(path.join(tmpRoot, 'src/ab.ts'), 'export const ab = 2;\n');
    const files = [
      await fileEntry(tmpRoot, 'src/a.ts'),
      await fileEntry(tmpRoot, 'src/ab.ts'),
    ];
    const locatedIssue: Issue = {
      id: 'issue-1',
      title: 'problem in src/a.ts',
      description: 'mentions src/a.ts as context',
      severity: 'warning',
      category: 'test',
      fixAvailable: false,
      locations: [{ file: 'src/ab.ts' }],
    };

    const a = await inspectFile(tmpRoot, 'src/a.ts', { scan: { files }, issues: [locatedIssue] });
    const ab = await inspectFile(tmpRoot, 'src/ab.ts', {
      scan: { files },
      issues: [locatedIssue],
    });

    expect(a.issues.map((issue) => issue.id)).not.toContain('issue-1');
    expect(ab.issues.map((issue) => issue.id)).toContain('issue-1');
  });

  it('returns graph-backed Python imports and exports for a real file', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-fi-'));
    await fs.writeFile(path.join(tmpRoot, 'helper.py'), 'def helper():\n    return 1\n');
    await fs.writeFile(
      path.join(tmpRoot, 'sample.py'),
      'from helper import helper\n\ndef run():\n    return helper()\n',
    );

    const insp = await inspectFile(tmpRoot, 'sample.py');

    expect(insp.exists).toBe(true);
    expect(insp.imports.map((i) => i.source)).toContain('helper');
    expect(insp.exports.map((e) => e.name)).toContain('run');
  });
});

async function fileEntry(root: string, relativePath: string): Promise<FileEntry> {
  const absolutePath = path.join(root, relativePath);
  const stat = await fs.stat(absolutePath);
  return {
    relativePath,
    absolutePath,
    extension: path.extname(relativePath).toLowerCase(),
    sizeBytes: stat.size,
    directory: path.posix.dirname(relativePath),
  };
}
