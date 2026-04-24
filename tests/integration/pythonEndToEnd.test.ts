import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { getToolHandler } from '../../src/mcp/tools.js';

const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'python-small');

function runTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const handler = getToolHandler(name);
  if (!handler) throw new Error(`tool ${name} missing`);
  return handler(args, FIXTURE_ROOT);
}

describe('Python end-to-end via MCP handlers', () => {
  it('projscan_analyze returns Python-aware report on python-small fixture', async () => {
    const result = (await runTool('projscan_analyze', {})) as {
      languages: { primary: string };
      issues: Array<{ id: string }>;
      projectName: string;
    };
    expect(result.languages.primary).toBe('Python');
    const ids = result.issues.map((i) => i.id);
    // At least one of the three Python warnings should fire on the fixture
    // (it has pytest declared but no ruff/black).
    const pythonIds = ids.filter(
      (id) =>
        id.startsWith('missing-python-') ||
        id.startsWith('no-python-') ||
        id.startsWith('dep-risk-') ||
        id.startsWith('unused-python-dependency-'),
    );
    expect(pythonIds.length).toBeGreaterThan(0);
  });

  it('projscan_graph direction=importers returns importers for pkg/core.py', async () => {
    const result = (await runTool('projscan_graph', {
      file: 'pkg/core.py',
      direction: 'importers',
    })) as { importers?: string[]; files?: string[] };
    const arr = result.importers ?? result.files ?? [];
    expect(arr.length).toBeGreaterThan(0);
    expect(arr).toEqual(expect.arrayContaining([expect.stringContaining('pkg')]));
  });

  it('projscan_search finds Python symbols', async () => {
    const result = (await runTool('projscan_search', {
      query: 'greet',
      scope: 'symbols',
    })) as { matches?: Array<{ file: string; symbol: string }> };
    const matches = result.matches ?? [];
    expect(matches.length).toBeGreaterThan(0);
    const files = matches.map((m) => m.file);
    const hit = files.find((f) => f.includes('pkg/core.py') || f.includes('pkg/__init__.py'));
    expect(hit).toBeTruthy();
  });
});
