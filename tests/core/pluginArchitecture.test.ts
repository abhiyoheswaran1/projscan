import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import type { FileEntry } from '../../src/types.js';

describe('plugin runtime maintainability', () => {
  it('keeps manifest validation out of the plugin runtime hotspot', async () => {
    const runtimeSource = readFileSync(path.join(process.cwd(), 'src/core/plugins.ts'), 'utf8');
    expect(runtimeSource).not.toContain('function validateManifestBase');
    expect(runtimeSource).not.toContain('function moduleDiagnostic');

    const inspection = await inspectRepoSourceFile('src/core/pluginManifestValidation.ts');
    const validateManifest = inspection.functions?.find((fn) => fn.name === 'validateManifest');

    expect(validateManifest).toBeDefined();
    expect(validateManifest!.cyclomaticComplexity).toBeLessThanOrEqual(8);
  });

  it('keeps analyzer issue shape validation out of the plugin runtime hotspot', async () => {
    const runtimeSource = readFileSync(path.join(process.cwd(), 'src/core/plugins.ts'), 'utf8');
    expect(runtimeSource).toContain("from './pluginIssueValidation.js'");
    expect(runtimeSource).not.toContain('function isWellShapedIssue');
    expect(runtimeSource).not.toContain('function isSeverity');

    const inspection = await inspectRepoSourceFile('src/core/pluginIssueValidation.ts');
    const validateIssue = inspection.functions?.find((fn) => fn.name === 'isWellShapedIssue');

    expect(validateIssue).toBeDefined();
    expect(validateIssue!.cyclomaticComplexity).toBeLessThanOrEqual(8);
  });
});

async function inspectRepoSourceFile(relativePath: string) {
  const root = process.cwd();
  const file = await fileEntry(root, relativePath);
  const graph = await buildCodeGraph(root, [file]);
  return inspectFile(root, relativePath, { scan: { files: [file] }, issues: [], graph });
}

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
