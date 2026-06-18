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
  it('keeps repeated framework member matching in shared helpers', async () => {
    const helper = await fs.readFile(
      path.join(process.cwd(), 'src/core/frameworkSourceMatching.ts'),
      'utf-8',
    );
    const adapterFiles = [
      'src/core/frameworkHonoSources.ts',
      'src/core/frameworkExpressSources.ts',
      'src/core/frameworkFastifySources.ts',
      'src/core/frameworkKoaSources.ts',
    ];

    expect(helper).toContain('sourceFromPrefixedMembers');
    expect(helper).toContain('sourceFromExactMembers');
    expect(helper).toContain('isKnownHandlerCall');
    expect(helper).toContain('bareCallName');

    for (const rel of adapterFiles) {
      const adapter = await fs.readFile(path.join(process.cwd(), rel), 'utf-8');

      expect(adapter).toContain("from './frameworkSourceMatching.js'");
      expect(adapter).not.toContain('function bareName(');
      expect(adapter).not.toMatch(/new Set\((?:references|memberReferences|memberCallSites)\)/);
    }
  });

  it('uses a named context object for shared framework source dispatch', async () => {
    const shared = await fs.readFile(
      path.join(process.cwd(), 'src/core/frameworkSources.ts'),
      'utf-8',
    );
    const dataflowTraversal = await fs.readFile(
      path.join(process.cwd(), 'src/core/dataflowTraversal.ts'),
      'utf-8',
    );
    const taintIndex = await fs.readFile(
      path.join(process.cwd(), 'src/core/taintIndex.ts'),
      'utf-8',
    );

    expect(shared).toContain(
      "export type { FrameworkRequestSourceContext } from './frameworkSourceContext.js';",
    );
    expect(shared).toMatch(
      /frameworkRequestSourceForFunction\(\s*context: FrameworkRequestSourceContext,\s*\): string \| null/,
    );
    expect(shared).not.toContain('functionName: string,\n  memberCallSites: string[]');
    expect(dataflowTraversal).toContain('frameworkRequestSourceForFunction({');
    expect(dataflowTraversal).toContain('functionName: fn.name');
    expect(taintIndex).toContain('frameworkRequestSourceForFunction({');
    expect(taintIndex).toContain('functionName: fn.name');
  });

  it('keeps per-framework resolver wrappers out of the shared framework source facade', async () => {
    const shared = await fs.readFile(
      path.join(process.cwd(), 'src/core/frameworkSources.ts'),
      'utf-8',
    );
    expect(shared).toContain("from './frameworkSourceResolvers.js'");
    expect(shared).not.toContain('function resolveNextRouteSource');
    expect(shared).not.toContain('function resolveRemixSource');
    expect(shared).not.toContain('function resolveHonoSource');
    expect(shared).not.toContain('function resolveExpressSource');
    expect(shared).not.toContain('function resolveFastifySource');
    expect(shared).not.toContain('function resolveKoaSource');

    const resolversSource = await fs.readFile(
      path.join(process.cwd(), 'src/core/frameworkSourceResolvers.ts'),
      'utf-8',
    );
    expect(resolversSource).toContain('export const FRAMEWORK_REQUEST_SOURCE_RESOLVERS');
    expect(resolversSource).toContain("from './frameworkNextRouteSources.js'");
    expect(resolversSource).toContain("from './frameworkRemixSources.js'");
    expect(resolversSource).not.toContain("from './frameworkSources.js'");

    const resolvers = await inspectRepoSourceFile('src/core/frameworkSourceResolvers.ts');
    const next = resolvers.functions?.find((fn) => fn.name === 'resolveNextRouteSource');
    expect(next).toBeDefined();
    expect(next!.cyclomaticComplexity).toBeLessThanOrEqual(1);
  });

  it('keeps the shared framework source dispatcher as a low-complexity orchestrator', async () => {
    const shared = await inspectRepoSourceFile('src/core/frameworkSources.ts');
    const dispatcher = shared.functions?.find(
      (fn) => fn.name === 'frameworkRequestSourceForFunction',
    );

    expect(dispatcher).toBeDefined();
    expect(dispatcher!.cyclomaticComplexity).toBeLessThanOrEqual(3);
  });

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

  it('keeps Koa source matching out of the shared framework source orchestrator', async () => {
    const shared = await inspectRepoSourceFile('src/core/frameworkSources.ts');
    const sharedFunctions = new Set(shared.functions?.map((fn) => fn.name));

    expect(sharedFunctions.has('koaRequestSource')).toBe(false);
    expect(sharedFunctions.has('koaMemberReferenceSource')).toBe(false);
    expect(sharedFunctions.has('koaMemberCallSource')).toBe(false);

    const koa = await inspectRepoSourceFile('src/core/frameworkKoaSources.ts');
    const matcher = koa.functions?.find((fn) => fn.name === 'koaRequestSource');

    expect(matcher).toBeDefined();
    expect(matcher!.cyclomaticComplexity).toBeLessThanOrEqual(5);
  });

  it('keeps Express source matching out of the shared framework source orchestrator', async () => {
    const shared = await inspectRepoSourceFile('src/core/frameworkSources.ts');
    const sharedFunctions = new Set(shared.functions?.map((fn) => fn.name));

    expect(sharedFunctions.has('expressRequestSource')).toBe(false);
    expect(sharedFunctions.has('expressReferenceSource')).toBe(false);
    expect(sharedFunctions.has('expressMemberCallSource')).toBe(false);

    const express = await inspectRepoSourceFile('src/core/frameworkExpressSources.ts');
    const matcher = express.functions?.find((fn) => fn.name === 'expressRequestSource');

    expect(matcher).toBeDefined();
    expect(matcher!.cyclomaticComplexity).toBeLessThanOrEqual(5);
  });

  it('keeps Fastify source matching out of the shared framework source orchestrator', async () => {
    const shared = await inspectRepoSourceFile('src/core/frameworkSources.ts');
    const sharedFunctions = new Set(shared.functions?.map((fn) => fn.name));

    expect(sharedFunctions.has('fastifyRequestSource')).toBe(false);
    expect(sharedFunctions.has('fastifyReferenceSource')).toBe(false);
    expect(sharedFunctions.has('fastifyMemberReferenceSource')).toBe(false);

    const fastify = await inspectRepoSourceFile('src/core/frameworkFastifySources.ts');
    const matcher = fastify.functions?.find((fn) => fn.name === 'fastifyRequestSource');

    expect(matcher).toBeDefined();
    expect(matcher!.cyclomaticComplexity).toBeLessThanOrEqual(5);
  });

  it('keeps Hono source matching out of the shared framework source orchestrator', async () => {
    const shared = await inspectRepoSourceFile('src/core/frameworkSources.ts');
    const sharedFunctions = new Set(shared.functions?.map((fn) => fn.name));

    expect(sharedFunctions.has('honoRequestSource')).toBe(false);
    expect(sharedFunctions.has('isHonoFile')).toBe(false);
    expect(sharedFunctions.has('isHonoHandlerCall')).toBe(false);

    const hono = await inspectRepoSourceFile('src/core/frameworkHonoSources.ts');
    const matcher = hono.functions?.find((fn) => fn.name === 'honoRequestSource');

    expect(matcher).toBeDefined();
    expect(matcher!.cyclomaticComplexity).toBeLessThanOrEqual(8);
  });
});
