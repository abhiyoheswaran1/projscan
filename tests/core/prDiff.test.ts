import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { computePrDiff, diffGraphs, detectRenames } from '../../src/core/prDiff.js';
import type { CodeGraph, GraphFile } from '../../src/core/codeGraph.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-pr-diff-test-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

function git(
  args: string[],
  cwd: string = tmp,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const c = spawn('git', args, {
      cwd,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@x',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@x',
      },
    });
    let so = '';
    let se = '';
    c.stdout.on('data', (d) => (so += d.toString()));
    c.stderr.on('data', (d) => (se += d.toString()));
    c.on('close', (code) => resolve({ code: code ?? 1, stdout: so, stderr: se }));
  });
}

async function write(rel: string, content: string): Promise<void> {
  const full = path.join(tmp, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf-8');
}

async function setupRepo(): Promise<void> {
  await git(['init', '-q', '-b', 'main']);
  await git(['config', 'user.email', 't@x']);
  await git(['config', 'user.name', 't']);
}

async function withFailingWorktreeAdd<T>(fn: () => Promise<T>): Promise<T> {
  const oldPath = process.env.PATH ?? '';
  const oldRealPath = process.env.PROJSCAN_TEST_REAL_PATH;
  const fakeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-fake-git-'));
  const fakeGit = path.join(fakeDir, 'git');
  await fs.writeFile(
    fakeGit,
    `#!/bin/sh
if [ "$1" = "worktree" ] && [ "$2" = "add" ]; then
  echo "fatal: could not create directory of .git/worktrees/projscan-pr-diff: Operation not permitted" >&2
  exit 128
fi
PATH="$PROJSCAN_TEST_REAL_PATH" exec git "$@"
`,
    'utf-8',
  );
  await fs.chmod(fakeGit, 0o755);
  process.env.PROJSCAN_TEST_REAL_PATH = oldPath;
  process.env.PATH = `${fakeDir}${path.delimiter}${oldPath}`;
  try {
    return await fn();
  } finally {
    process.env.PATH = oldPath;
    if (oldRealPath === undefined) {
      delete process.env.PROJSCAN_TEST_REAL_PATH;
    } else {
      process.env.PROJSCAN_TEST_REAL_PATH = oldRealPath;
    }
    await fs.rm(fakeDir, { recursive: true, force: true });
  }
}

function file(
  relativePath: string,
  exportsList: string[],
  importsList: string[],
  callSites: string[] = [],
  cc = 1,
): GraphFile {
  return {
    relativePath,
    imports: importsList.map((source) => ({
      source,
      kind: 'static' as const,
      specifiers: [],
      typeOnly: false,
      line: 1,
    })),
    exports: exportsList.map((name) => ({
      name,
      kind: 'function' as const,
      typeOnly: false,
      line: 1,
    })),
    callSites,
    lineCount: 0,
    cyclomaticComplexity: cc,
    mtimeMs: 0,
    parseOk: true,
    adapterId: 'javascript',
  };
}

function makeGraph(
  files: GraphFile[],
  localImporters: Map<string, Set<string>> = new Map(),
): CodeGraph {
  return {
    files: new Map(files.map((f) => [f.relativePath, f])),
    packageImporters: new Map(),
    localImporters,
    symbolDefs: new Map(),
    scannedFiles: files.length,
  };
}

describe('computePrDiff', () => {
  it('returns unavailable when an explicit head ref cannot be resolved', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export const a = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    const r = await computePrDiff(tmp, { base: 'HEAD', head: 'missing-head' });

    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/Could not resolve head ref "missing-head"/);
    expect(r.base).toEqual({ ref: 'HEAD', resolvedSha: expect.any(String) });
    expect(r.head).toEqual({ ref: 'missing-head', resolvedSha: null });
    expect(r.filesAdded).toEqual([]);
    expect(r.filesModified).toEqual([]);
    expect(r.filesRemoved).toEqual([]);
    expect(r.totalFilesChanged).toBe(0);
  });

  it('returns unavailable when the base worktree cannot be checked out', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export const a = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write('src/a.ts', `export const a = 2;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'change a']);

    const r = await withFailingWorktreeAdd(() =>
      computePrDiff(tmp, { base: 'HEAD~1', head: 'HEAD' }),
    );

    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/Could not check out base ref "HEAD~1"/);
    expect(r.filesAdded).toEqual([]);
    expect(r.filesModified).toEqual([]);
    expect(r.filesRemoved).toEqual([]);
    expect(r.totalFilesChanged).toBe(0);
  });
});

describe('diffGraphs', () => {
  it('detects added files', () => {
    const base = makeGraph([file('a.ts', ['x'], [])]);
    const head = makeGraph([file('a.ts', ['x'], []), file('b.ts', ['y'], [])]);
    const r = diffGraphs('base', 'aaa', 'HEAD', 'bbb', base, head);
    expect(r.filesAdded).toEqual(['b.ts']);
    expect(r.filesRemoved).toEqual([]);
    expect(r.filesModified).toEqual([]);
    expect(r.totalFilesChanged).toBe(1);
  });

  it('detects removed files', () => {
    const base = makeGraph([file('a.ts', ['x'], []), file('b.ts', ['y'], [])]);
    const head = makeGraph([file('a.ts', ['x'], [])]);
    const r = diffGraphs('base', 'aaa', 'HEAD', 'bbb', base, head);
    expect(r.filesRemoved).toEqual(['b.ts']);
  });

  it('detects export additions and removals', () => {
    const base = makeGraph([file('a.ts', ['old'], [])]);
    const head = makeGraph([file('a.ts', ['new'], [])]);
    const r = diffGraphs('base', null, 'HEAD', null, base, head);
    expect(r.filesModified).toHaveLength(1);
    expect(r.filesModified[0].exportsAdded).toEqual(['new']);
    expect(r.filesModified[0].exportsRemoved).toEqual(['old']);
  });

  it('detects import additions and removals', () => {
    const base = makeGraph([file('a.ts', [], ['react'])]);
    const head = makeGraph([file('a.ts', [], ['react', 'lodash'])]);
    const r = diffGraphs('base', null, 'HEAD', null, base, head);
    expect(r.filesModified[0].importsAdded).toEqual(['lodash']);
    expect(r.filesModified[0].importsRemoved).toEqual([]);
  });

  it('reports CC delta', () => {
    const base = makeGraph([file('a.ts', ['x'], [], [], 5)]);
    const head = makeGraph([file('a.ts', ['x'], [], [], 12)]);
    const r = diffGraphs('base', null, 'HEAD', null, base, head);
    expect(r.filesModified[0].cyclomaticDelta).toBe(7);
  });

  it('reports fan-in delta', () => {
    // a.ts has fan-in 1 in base (b.ts -> a.ts), fan-in 2 in head (b.ts + c.ts).
    const base = makeGraph(
      [file('a.ts', ['x'], []), file('b.ts', [], ['./a'])],
      new Map([['a.ts', new Set(['b.ts'])]]),
    );
    const head = makeGraph(
      [file('a.ts', ['x'], []), file('b.ts', [], ['./a']), file('c.ts', [], ['./a'])],
      new Map([['a.ts', new Set(['b.ts', 'c.ts'])]]),
    );
    const r = diffGraphs('base', null, 'HEAD', null, base, head);
    const aDiff = r.filesModified.find((m) => m.relativePath === 'a.ts');
    expect(aDiff?.fanInDelta).toBe(1);
  });

  it('skips files with no structural change', () => {
    const a = file('a.ts', ['x'], ['react'], ['fn'], 3);
    const r = diffGraphs('base', null, 'HEAD', null, makeGraph([a]), makeGraph([a]));
    expect(r.totalFilesChanged).toBe(0);
    expect(r.filesModified).toEqual([]);
  });

  it('detects export renames instead of treating them as +/- pairs', () => {
    // foo -> fooBar should pair as a rename. unrelated 'baz' should NOT.
    const base = makeGraph([file('a.ts', ['foo', 'baz'], [])]);
    const head = makeGraph([file('a.ts', ['fooBar', 'baz'], [])]);
    const r = diffGraphs('base', null, 'HEAD', null, base, head);
    const m = r.filesModified[0];
    expect(m.exportsRenamed).toEqual([{ from: 'foo', to: 'fooBar' }]);
    expect(m.exportsAdded).toEqual([]);
    expect(m.exportsRemoved).toEqual([]);
  });
});

describe('detectRenames', () => {
  it('returns no pairs when one side is empty', () => {
    const r = detectRenames(['x', 'y'], []);
    expect(r.renames).toEqual([]);
    expect(r.removedAfter).toEqual(['x', 'y']);
  });

  it('pairs near-identical names', () => {
    const r = detectRenames(['fetchUser'], ['fetchUsers']);
    expect(r.renames).toEqual([{ from: 'fetchUser', to: 'fetchUsers' }]);
  });

  it('does NOT pair semantically unrelated names', () => {
    const r = detectRenames(['save'], ['delete']);
    expect(r.renames).toEqual([]);
    expect(r.removedAfter).toEqual(['save']);
    expect(r.addedAfter).toEqual(['delete']);
  });

  it('handles multiple pairs greedily by best-score-first', () => {
    // Each removed pairs with its best match; "Widget" beats "Button" against "WidgetThing".
    const r = detectRenames(['Widget', 'Button'], ['WidgetThing', 'ButtonGroup']);
    expect(r.renames.sort((a, b) => a.from.localeCompare(b.from))).toEqual([
      { from: 'Button', to: 'ButtonGroup' },
      { from: 'Widget', to: 'WidgetThing' },
    ]);
  });

  it('falls through to +/- when score is below threshold', () => {
    const r = detectRenames(['short'], ['veryDifferentLongName']);
    expect(r.renames).toEqual([]);
  });
});
