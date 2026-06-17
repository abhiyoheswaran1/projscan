import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import type { FileEntry } from '../../src/types.js';

async function inspectRepoSourceFile(rel: string) {
  const root = process.cwd();
  const absolutePath = path.join(root, rel);
  const stat = await fs.stat(absolutePath);
  const file: FileEntry = {
    relativePath: rel,
    absolutePath,
    extension: path.extname(rel).toLowerCase(),
    sizeBytes: stat.size,
    directory: path.posix.dirname(rel),
  };
  const graph = await buildCodeGraph(root, [file]);
  return inspectFile(root, rel, { scan: { files: [file] }, issues: [], graph });
}

describe('report scope maintainability', () => {
  it('keeps path-token redaction out of the report scope orchestrator', async () => {
    const reportScopeSource = readFileSync(
      path.join(process.cwd(), 'src/core/reportScope.ts'),
      'utf8',
    );
    expect(reportScopeSource).not.toContain('TEXT_PATH_TOKEN_PATTERN');
    expect(reportScopeSource).not.toContain('function redactUnmappedPathTokens');
    expect(reportScopeSource).not.toContain('function pathReferenceRegExp');
    expect(reportScopeSource).not.toContain('function createPathRedactor');
    expect(reportScopeSource).not.toContain('function redactText');

    const redactionSource = readFileSync(
      path.join(process.cwd(), 'src/core/reportPathRedaction.ts'),
      'utf8',
    );
    expect(redactionSource).not.toContain("from './reportScope.js'");

    const reportScopeInspection = await inspectRepoSourceFile('src/core/reportScope.ts');
    expect(reportScopeInspection.cyclomaticComplexity).toBeLessThanOrEqual(40);

    const redactionInspection = await inspectRepoSourceFile('src/core/reportPathRedaction.ts');
    expect(redactionInspection.issues).toEqual([]);
  });
});
