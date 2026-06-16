import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { computeCoupling } from '../../src/core/couplingAnalyzer.js';

const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'csharp-small');

describe('C# end-to-end (graph + coupling)', () => {
  it('builds a graph that resolves namespace using to local files', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);

    const post = graph.files.get('Models/Post.cs');
    expect(post, 'Models/Post.cs should be in the graph').toBeDefined();
    expect(post!.parseOk).toBe(true);

    // Models/User.cs should be referenced by Post via `using MyApp.Models`.
    const userImporters = graph.localImporters.get('Models/User.cs');
    expect(userImporters && [...userImporters]).toContain('Models/Post.cs');
  });

  it('exposes only public top-level types as exports', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const userExports =
      graph.files
        .get('Models/User.cs')
        ?.exports.map((e) => e.name)
        .sort() ?? [];
    expect(userExports).toContain('User');
    // internal class Hidden — not exported.
    expect(userExports).not.toContain('Hidden');
  });

  it('coupling: User has fanIn 1 (Post imports it)', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const report = computeCoupling(graph);
    const user = report.files.find((f) => f.relativePath === 'Models/User.cs');
    expect(user?.fanIn).toBe(1);
  });

  it('per-function CC reflects switch-expression arms (discard not counted)', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const user = graph.files.get('Models/User.cs');
    const classify = user?.functions?.find((f) => f.name === 'User.Classify');
    expect(classify).toBeDefined();
    // 3 non-discard arms (`0`, `1`, `2`) + `_` discard => CC 1+3=4
    expect(classify!.cyclomaticComplexity).toBe(4);
  });
});
