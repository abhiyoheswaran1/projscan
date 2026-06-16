import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import type { FileEntry } from '../../src/types.js';

async function inspectRepoSourceFile(rel: string) {
  const root = process.cwd();
  const abs = path.join(root, rel);
  const stat = await fs.stat(abs);
  const file: FileEntry = {
    relativePath: rel,
    absolutePath: abs,
    extension: path.extname(rel).toLowerCase(),
    sizeBytes: stat.size,
    directory: path.posix.dirname(rel),
  };
  const graph = await buildCodeGraph(root, [file]);
  return inspectFile(root, rel, { scan: { files: [file] }, issues: [], graph });
}

describe('framework source maintainability', () => {
  it('keeps Next route source matching out of the shared framework source orchestrator', async () => {
    const shared = await inspectRepoSourceFile('src/core/frameworkSources.ts');
    const sharedFunctions = new Set(shared.functions?.map((fn) => fn.name));

    expect(sharedFunctions.has('nextRouteRequestSource')).toBe(false);
    expect(sharedFunctions.has('nextRouteCallSource')).toBe(false);
    expect(sharedFunctions.has('nextRouteReferenceSource')).toBe(false);

    const nextRoute = await inspectRepoSourceFile('src/core/frameworkNextRouteSources.ts');
    const matcher = nextRoute.functions?.find((fn) => fn.name === 'nextRouteRequestSource');

    expect(matcher).toBeDefined();
    expect(matcher!.cyclomaticComplexity).toBeLessThanOrEqual(6);
  });
});
