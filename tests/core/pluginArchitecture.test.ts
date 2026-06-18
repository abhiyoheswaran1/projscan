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

  it('keeps manifest discovery IO out of the plugin runtime hotspot', async () => {
    const runtimeSource = readFileSync(path.join(process.cwd(), 'src/core/plugins.ts'), 'utf8');
    expect(runtimeSource).toContain("from './pluginManifestDiscovery.js'");
    expect(runtimeSource).not.toContain('async function readPluginManifestFile');
    expect(runtimeSource).not.toContain('async function discoverPluginManifests');
    expect(runtimeSource).not.toContain('JSON.parse');
    expect(runtimeSource).not.toContain('fs.readFile');
    expect(runtimeSource).not.toContain('fs.readdir');

    const inspection = await inspectRepoSourceFile('src/core/pluginManifestDiscovery.ts');
    const readManifest = inspection.functions?.find((fn) => fn.name === 'readPluginManifestFile');
    const discoverManifests = inspection.functions?.find(
      (fn) => fn.name === 'discoverPluginManifests',
    );

    expect(readManifest).toBeDefined();
    expect(readManifest!.cyclomaticComplexity).toBeLessThanOrEqual(6);
    expect(discoverManifests).toBeDefined();
    expect(discoverManifests!.cyclomaticComplexity).toBeLessThanOrEqual(5);
  });

  it('keeps analyzer issue shape validation out of the plugin runtime hotspot', async () => {
    const runtimeSource = readFileSync(path.join(process.cwd(), 'src/core/plugins.ts'), 'utf8');
    expect(runtimeSource).not.toContain('function isWellShapedIssue');
    expect(runtimeSource).not.toContain('function isSeverity');

    const analyzerRunningSource = readFileSync(
      path.join(process.cwd(), 'src/core/pluginAnalyzerRunning.ts'),
      'utf8',
    );
    expect(analyzerRunningSource).toContain("from './pluginIssueValidation.js'");

    const inspection = await inspectRepoSourceFile('src/core/pluginIssueValidation.ts');
    const validateIssue = inspection.functions?.find((fn) => fn.name === 'isWellShapedIssue');

    expect(validateIssue).toBeDefined();
    expect(validateIssue!.cyclomaticComplexity).toBeLessThanOrEqual(8);
  });

  it('keeps module loading mechanics out of the plugin runtime hotspot', async () => {
    const runtimeSource = readFileSync(path.join(process.cwd(), 'src/core/plugins.ts'), 'utf8');
    expect(runtimeSource).not.toContain("from './pluginModuleLoading.js'");
    expect(runtimeSource).not.toContain('class PluginModuleMissingError');
    expect(runtimeSource).not.toContain('class PluginModuleReadError');
    expect(runtimeSource).not.toContain('function assertPluginModuleReadable');
    expect(runtimeSource).not.toContain('function describePluginModuleLoadError');
    expect(runtimeSource).not.toContain('function importPluginModule');
    expect(runtimeSource).not.toContain('function isMissingDynamicImportCallback');
    expect(runtimeSource).not.toContain('function importPluginModuleFromSource');

    const inspection = await inspectRepoSourceFile('src/core/pluginModuleLoading.ts');
    const importModule = inspection.functions?.find((fn) => fn.name === 'importPluginModule');
    const describeLoadError = inspection.functions?.find(
      (fn) => fn.name === 'describePluginModuleLoadError',
    );

    expect(importModule).toBeDefined();
    expect(importModule!.cyclomaticComplexity).toBeLessThanOrEqual(3);
    expect(describeLoadError).toBeDefined();
    expect(describeLoadError!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  });

  it('keeps analyzer plugin entry loading out of the plugin runtime hotspot', async () => {
    const runtimeSource = readFileSync(path.join(process.cwd(), 'src/core/plugins.ts'), 'utf8');
    expect(runtimeSource).toContain("from './pluginAnalyzerLoading.js'");
    expect(runtimeSource).not.toContain('function untrustedAnalyzerWarning');
    expect(runtimeSource).not.toContain('missing required export "check"');
    expect(runtimeSource).not.toContain('assertPluginModuleReadable(entry.manifest.module');
    expect(runtimeSource).not.toContain('entry.manifest.kind !== \'analyzer\'');

    const inspection = await inspectRepoSourceFile('src/core/pluginAnalyzerLoading.ts');
    const analyzerSource = readFileSync(
      path.join(process.cwd(), 'src/core/pluginAnalyzerLoading.ts'),
      'utf8',
    );
    const loadAnalyzerEntry = inspection.functions?.find(
      (fn) => fn.name === 'loadAnalyzerPluginEntry',
    );

    expect(analyzerSource).toContain("from './pluginRuntimeTypes.js'");
    expect(analyzerSource).not.toContain("from './plugins.js'");
    expect(loadAnalyzerEntry).toBeDefined();
    expect(loadAnalyzerEntry!.cyclomaticComplexity).toBeLessThanOrEqual(6);
  });

  it('keeps analyzer plugin execution out of the plugin runtime hotspot', async () => {
    const runtimeSource = readFileSync(path.join(process.cwd(), 'src/core/plugins.ts'), 'utf8');
    expect(runtimeSource).toContain("from './pluginAnalyzerRunning.js'");
    expect(runtimeSource).toContain('export { runAnalyzerPlugins }');
    expect(runtimeSource).not.toContain('export async function runAnalyzerPlugins');
    expect(runtimeSource).not.toContain('threw during check');
    expect(runtimeSource).not.toContain('isWellShapedIssue(issue)');
    expect(runtimeSource).not.toContain('id: `plugin:${p.manifest.name}:${issue.id}`');

    const inspection = await inspectRepoSourceFile('src/core/pluginAnalyzerRunning.ts');
    const runningSource = readFileSync(
      path.join(process.cwd(), 'src/core/pluginAnalyzerRunning.ts'),
      'utf8',
    );
    const runAnalyzerPlugins = inspection.functions?.find(
      (fn) => fn.name === 'runAnalyzerPlugins',
    );

    expect(runningSource).not.toContain("from './plugins.js'");
    expect(runAnalyzerPlugins).toBeDefined();
    expect(runAnalyzerPlugins!.cyclomaticComplexity).toBeLessThanOrEqual(8);
  });

  it('keeps reporter plugin loading and rendering out of the plugin runtime hotspot', async () => {
    const runtimeSource = readFileSync(path.join(process.cwd(), 'src/core/plugins.ts'), 'utf8');
    expect(runtimeSource).toContain("from './pluginReporterLoading.js'");
    expect(runtimeSource).not.toContain('function loadReporterPlugin');
    expect(runtimeSource).not.toContain('function untrustedReporterDiagnostic');
    expect(runtimeSource).not.toContain('function pluginRuntimeFail');
    expect(runtimeSource).not.toContain('missing required export "render"');
    expect(runtimeSource).not.toContain('reporter plugin "${plugin.manifest.name}" failed during render');

    const inspection = await inspectRepoSourceFile('src/core/pluginReporterLoading.ts');
    const reporterSource = readFileSync(
      path.join(process.cwd(), 'src/core/pluginReporterLoading.ts'),
      'utf8',
    );
    const loadReporter = inspection.functions?.find((fn) => fn.name === 'loadReporterPlugin');
    const renderReporter = inspection.functions?.find((fn) => fn.name === 'renderReporterPlugin');

    expect(reporterSource).not.toContain("from './plugins.js'");
    expect(loadReporter).toBeDefined();
    expect(loadReporter!.cyclomaticComplexity).toBeLessThanOrEqual(6);
    expect(renderReporter).toBeDefined();
    expect(renderReporter!.cyclomaticComplexity).toBeLessThanOrEqual(4);
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
