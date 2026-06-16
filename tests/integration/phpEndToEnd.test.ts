import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { computeCoupling } from '../../src/core/couplingAnalyzer.js';

const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'php-small');

describe('PHP end-to-end (graph + coupling)', () => {
  it('builds a graph that resolves PSR-4 namespace use to local files', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);

    const post = graph.files.get('src/Models/Post.php');
    expect(post, 'src/Models/Post.php should be in the graph').toBeDefined();
    expect(post!.parseOk).toBe(true);

    // src/Models/User.php should be referenced by Post via `use App\Models\User`.
    const userImporters = graph.localImporters.get('src/Models/User.php');
    expect(userImporters && [...userImporters]).toContain('src/Models/Post.php');
  });

  it('exposes top-level classes and functions as exports', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const userExports =
      graph.files
        .get('src/Models/User.php')
        ?.exports.map((e) => e.name)
        .sort() ?? [];
    expect(userExports).toEqual(['User', 'private_helper']);
  });

  it('coupling: User has fanIn 1 (Post imports it)', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const report = computeCoupling(graph);
    const user = report.files.find((f) => f.relativePath === 'src/Models/User.php');
    expect(user?.fanIn).toBe(1);
  });

  it('per-function CC reflects switch arms (default not counted)', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const user = graph.files.get('src/Models/User.php');
    const classify = user?.functions?.find((f) => f.name === 'User.classify');
    expect(classify).toBeDefined();
    // 2 non-default case arms (`case 0:` and `case 1:`/`case 2:` are 2 separate
    // case_statement nodes since `case 1: case 2:` falls through). default
    // does not count. CC = 1 + 3 = 4 (case 0, case 1, case 2).
    expect(classify!.cyclomaticComplexity).toBeGreaterThanOrEqual(3);
  });
});
