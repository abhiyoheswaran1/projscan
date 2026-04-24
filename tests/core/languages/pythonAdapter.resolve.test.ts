import { describe, it, expect } from 'vitest';
import { pythonAdapter } from '../../../src/core/languages/pythonAdapter.js';

interface FakeFile {
  relativePath: string;
}

function graphOf(paths: string[]): Map<string, FakeFile> {
  const m = new Map<string, FakeFile>();
  for (const p of paths) m.set(p, { relativePath: p });
  return m;
}

describe('pythonAdapter resolveImport', () => {
  const graph = graphOf([
    'pkg/__init__.py',
    'pkg/core.py',
    'pkg/utils.py',
    'pkg/sub/__init__.py',
    'pkg/sub/deep.py',
    'src/app/__init__.py',
    'src/app/main.py',
  ]);

  it('resolves absolute import to module file with packageRoots = [".", "src"]', () => {
    expect(
      pythonAdapter.resolveImport('pkg/core.py', 'pkg.utils', graph, {
        packageRoots: ['.', 'src'],
      }),
    ).toBe('pkg/utils.py');
  });

  it('resolves absolute package import to __init__.py', () => {
    expect(
      pythonAdapter.resolveImport('pkg/core.py', 'pkg', graph, { packageRoots: ['.'] }),
    ).toBe('pkg/__init__.py');
  });

  it('resolves absolute import under src/ root', () => {
    expect(
      pythonAdapter.resolveImport('pkg/core.py', 'app.main', graph, {
        packageRoots: ['.', 'src'],
      }),
    ).toBe('src/app/main.py');
  });

  it('prefers module file over __init__.py when both exist (non-overlapping here)', () => {
    // pkg/utils.py exists; there is no pkg/utils/__init__.py. Module wins.
    expect(
      pythonAdapter.resolveImport('pkg/core.py', 'pkg.utils', graph, { packageRoots: ['.'] }),
    ).toBe('pkg/utils.py');
  });

  it('resolves relative import one-dot to sibling module', () => {
    expect(
      pythonAdapter.resolveImport('pkg/core.py', '.utils', graph, { packageRoots: ['.'] }),
    ).toBe('pkg/utils.py');
  });

  it('resolves relative import one-dot bare to package __init__', () => {
    expect(
      pythonAdapter.resolveImport('pkg/core.py', '.', graph, { packageRoots: ['.'] }),
    ).toBe('pkg/__init__.py');
  });

  it('resolves relative import with submodule', () => {
    expect(
      pythonAdapter.resolveImport('pkg/core.py', '.sub.deep', graph, { packageRoots: ['.'] }),
    ).toBe('pkg/sub/deep.py');
  });

  it('resolves relative import two-dots into grandparent', () => {
    expect(
      pythonAdapter.resolveImport('pkg/sub/deep.py', '..utils', graph, { packageRoots: ['.'] }),
    ).toBe('pkg/utils.py');
  });

  it('returns null for unknown absolute import (third-party)', () => {
    expect(
      pythonAdapter.resolveImport('pkg/core.py', 'requests', graph, { packageRoots: ['.'] }),
    ).toBeNull();
  });

  it('returns null when relative escapes repo', () => {
    expect(
      pythonAdapter.resolveImport('pkg/core.py', '...too.far', graph, { packageRoots: ['.'] }),
    ).toBeNull();
  });

  it('is deterministic across packageRoots ordering', () => {
    const a = pythonAdapter.resolveImport('pkg/core.py', 'app.main', graph, {
      packageRoots: ['src', '.'],
    });
    const b = pythonAdapter.resolveImport('pkg/core.py', 'app.main', graph, {
      packageRoots: ['.', 'src'],
    });
    expect(a).toBe('src/app/main.py');
    expect(b).toBe('src/app/main.py');
  });

  it('returns null when file does not exist in graph', () => {
    expect(
      pythonAdapter.resolveImport('pkg/core.py', 'pkg.doesnotexist', graph, {
        packageRoots: ['.'],
      }),
    ).toBeNull();
  });

  it('resolves to .pyw when neither .py nor __init__.py exists', () => {
    const g = graphOf(['tool.pyw']);
    expect(pythonAdapter.resolveImport('x.py', 'tool', g, { packageRoots: ['.'] })).toBe(
      'tool.pyw',
    );
  });
});

describe('pythonAdapter.toPackageName', () => {
  it('returns null for relative imports', () => {
    expect(pythonAdapter.toPackageName('.')).toBeNull();
    expect(pythonAdapter.toPackageName('.sibling')).toBeNull();
    expect(pythonAdapter.toPackageName('..parent')).toBeNull();
  });

  it('extracts first dotted segment', () => {
    expect(pythonAdapter.toPackageName('requests')).toBe('requests');
    expect(pythonAdapter.toPackageName('requests.auth')).toBe('requests');
    expect(pythonAdapter.toPackageName('requests.auth.basic')).toBe('requests');
  });

  it('normalizes case', () => {
    expect(pythonAdapter.toPackageName('Django')).toBe('django');
  });
});
