import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { scanRepository } from './repositoryScanner.js';
import {
  PLUGIN_DIR,
  PLUGIN_PREVIEW_FLAG,
  PLUGIN_MANIFEST_EXT,
  PLUGIN_REPORTER_COMMANDS,
  pluginsEnabled,
  readPluginManifestFile,
  type PluginAnalyzerExports,
  type PluginAnalyzerManifest,
  type PluginReporterCommand,
  type PluginReporterContext,
  type PluginReporterExports,
  type PluginReporterManifest,
} from './plugins.js';
import type { Issue, IssueSeverity, PluginTestResult } from '../types.js';

type DynamicImport = (specifier: string) => Promise<Record<string, unknown>>;
const dynamicImport = new Function('specifier', 'return import(specifier)') as DynamicImport;

export interface InitPluginOptions {
  kind?: 'analyzer' | 'reporter';
  name?: string;
}

export interface InitPluginResult {
  manifestPath: string;
  modulePath: string;
}

export interface TestPluginOptions {
  fixtureRoot?: string;
  execute?: boolean;
}

export async function initPlugin(
  rootPath: string,
  options: InitPluginOptions = {},
): Promise<InitPluginResult> {
  const kind = options.kind ?? 'analyzer';
  const name = options.name ?? (kind === 'analyzer' ? 'policy' : 'team-report');
  const fileName = safePluginFileName(name);
  const pluginDir = path.join(rootPath, PLUGIN_DIR);
  const manifestPath = path.join(pluginDir, `${fileName}${PLUGIN_MANIFEST_EXT}`);
  const modulePath = path.join(pluginDir, `${fileName}.mjs`);

  await fs.mkdir(pluginDir, { recursive: true });
  await assertDoesNotExist(manifestPath);
  await assertDoesNotExist(modulePath);

  const manifest =
    kind === 'analyzer'
      ? analyzerManifest(name, `./${fileName}.mjs`)
      : reporterManifest(name, `./${fileName}.mjs`);
  const moduleSource = kind === 'analyzer' ? analyzerTemplate(name) : reporterTemplate(name);

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  await fs.writeFile(modulePath, moduleSource, { flag: 'wx' });

  return { manifestPath, modulePath };
}

export async function testPlugin(
  manifestPath: string,
  options: TestPluginOptions = {},
): Promise<PluginTestResult> {
  const resolvedManifestPath = path.resolve(manifestPath);
  const manifestResult = await readPluginManifestFile(resolvedManifestPath);
  if (!manifestResult.ok) {
    return failResult(resolvedManifestPath, {
      code: manifestResult.diagnostic.code,
      severity: 'error',
      message: manifestResult.diagnostic.message,
    });
  }

  const manifest = manifestResult.manifest;
  const modulePath = path.resolve(path.dirname(resolvedManifestPath), manifest.module);
  const guidance = await buildPluginTestGuidance(resolvedManifestPath, modulePath);
  const staticCheck = await checkModuleReadable(modulePath);
  if (!staticCheck.ok) {
    return failResult(
      resolvedManifestPath,
      {
        code: 'module-load-error',
        severity: 'error',
        message: staticCheck.message,
      },
      guidance,
      staticExecution(),
    );
  }

  if (options.execute !== true) {
    return {
      schemaVersion: 1,
      manifestPath: resolvedManifestPath,
      ok: true,
      diagnostics: [],
      ...guidance,
      execution: staticExecution(),
    };
  }

  if (!pluginsEnabled()) {
    return failResult(
      resolvedManifestPath,
      {
        code: 'plugin-execution-disabled',
        severity: 'error',
        message: `plugin execution requires ${PLUGIN_PREVIEW_FLAG}=1 and --execute`,
      },
      guidance,
      staticExecution(
        `Set ${PLUGIN_PREVIEW_FLAG}=1 and pass --execute to import and run local plugin code.`,
      ),
    );
  }

  let exportsObj: Record<string, unknown>;
  const executed = executeMode();
  try {
    const mod = await importPluginModule(modulePath);
    exportsObj = (mod.default ?? mod) as Record<string, unknown>;
  } catch (err) {
    return failResult(
      resolvedManifestPath,
      {
        code: 'module-load-error',
        severity: 'error',
        message: `plugin module failed to load: ${err instanceof Error ? err.message : String(err)}`,
      },
      guidance,
      executed,
    );
  }

  return manifest.kind === 'analyzer'
    ? testAnalyzerPlugin(resolvedManifestPath, manifest, exportsObj, options, guidance, executed)
    : testReporterPlugin(resolvedManifestPath, manifest, exportsObj, options, guidance, executed);
}

function analyzerManifest(name: string, modulePath: string): PluginAnalyzerManifest {
  return {
    schemaVersion: 1,
    name,
    kind: 'analyzer',
    module: modulePath,
    category: 'policy',
    description: 'Example local policy analyzer.',
  };
}

function reporterManifest(name: string, modulePath: string): PluginReporterManifest {
  return {
    schemaVersion: 1,
    name,
    kind: 'reporter',
    module: modulePath,
    commands: [...PLUGIN_REPORTER_COMMANDS],
    description: 'Example local reporter.',
  };
}

function analyzerTemplate(name: string): string {
  return `import { readFile } from 'node:fs/promises';

export default {
  async check(_rootPath, files) {
    const issues = [];
    for (const file of files) {
      if (file.relativePath.startsWith('.projscan-plugins/')) continue;
      let text = '';
      try {
        text = await readFile(file.absolutePath, 'utf-8');
      } catch {
        continue;
      }
      if (!text.includes('PROJSCAN_PLUGIN_EXAMPLE')) continue;
      issues.push({
        id: 'example-marker',
        title: '${escapeForSingleQuotedJs(name)} example marker found',
        description: 'Remove PROJSCAN_PLUGIN_EXAMPLE before committing production code.',
        severity: 'info',
        category: 'policy',
        fixAvailable: false,
        locations: [{ file: file.relativePath, line: 1 }],
      });
    }
    return issues;
  },
};
`;
}

function reporterTemplate(name: string): string {
  return `export default {
  render({ command, payload }) {
    const issueCount = Array.isArray(payload?.issues)
      ? payload.issues.length
      : Array.isArray(payload?.ci?.issues)
        ? payload.ci.issues.length
        : 0;
    const score = payload?.health?.score ?? payload?.ci?.score ?? 'n/a';
    return '${escapeForSingleQuotedJs(name)}:' + command + ': score=' + score + ', issues=' + issueCount;
  },
};
`;
}

async function testAnalyzerPlugin(
  manifestPath: string,
  manifest: PluginAnalyzerManifest,
  exportsObj: Record<string, unknown>,
  options: TestPluginOptions,
  guidance: PluginResultGuidance,
  execution: PluginTestResult['execution'],
): Promise<PluginTestResult> {
  if (typeof exportsObj.check !== 'function') {
    return failResult(
      manifestPath,
      {
        code: 'invalid-analyzer-export',
        severity: 'error',
        message: `analyzer plugin "${manifest.name}" missing required export "check"`,
      },
      guidance,
      execution,
    );
  }
  const rootPath = options.fixtureRoot ?? path.dirname(path.dirname(manifestPath));
  const scan = await scanRepository(rootPath);
  let rawIssues: unknown;
  try {
    rawIssues = await (exportsObj.check as PluginAnalyzerExports['check'])(rootPath, scan.files);
  } catch (err) {
    return failResult(
      manifestPath,
      {
        code: 'analyzer-runtime-error',
        severity: 'error',
        message: `analyzer plugin "${manifest.name}" threw: ${err instanceof Error ? err.message : String(err)}`,
      },
      guidance,
      execution,
    );
  }
  if (!Array.isArray(rawIssues)) {
    return failResult(
      manifestPath,
      {
        code: 'invalid-analyzer-result',
        severity: 'error',
        message: `analyzer plugin "${manifest.name}" returned ${typeof rawIssues}; expected Issue[]`,
      },
      guidance,
      execution,
    );
  }
  const issues = rawIssues as Issue[];
  const malformed = issues.find((issue) => !isIssueShape(issue));
  if (malformed) {
    return failResult(
      manifestPath,
      {
        code: 'invalid-analyzer-issue',
        severity: 'error',
        message: `analyzer plugin "${manifest.name}" returned a malformed issue`,
      },
      guidance,
      execution,
    );
  }
  return {
    schemaVersion: 1,
    manifestPath,
    ok: true,
    diagnostics: [],
    ...guidance,
    execution,
    analyzer: { issues },
  };
}

async function testReporterPlugin(
  manifestPath: string,
  manifest: PluginReporterManifest,
  exportsObj: Record<string, unknown>,
  options: TestPluginOptions,
  guidance: PluginResultGuidance,
  execution: PluginTestResult['execution'],
): Promise<PluginTestResult> {
  if (typeof exportsObj.render !== 'function') {
    return failResult(
      manifestPath,
      {
        code: 'invalid-reporter-export',
        severity: 'error',
        message: `reporter plugin "${manifest.name}" missing required export "render"`,
      },
      guidance,
      execution,
    );
  }

  const rootPath = options.fixtureRoot ?? path.dirname(path.dirname(manifestPath));
  const outputs: Array<{ command: string; text: string }> = [];
  for (const command of manifest.commands) {
    const context: PluginReporterContext = {
      command,
      rootPath,
      manifest,
      payload: sampleReporterPayload(command),
    };
    let text: unknown;
    try {
      text = await (exportsObj.render as PluginReporterExports['render'])(context);
    } catch (err) {
      return failResult(
        manifestPath,
        {
          code: 'reporter-render-error',
          severity: 'error',
          message: `reporter plugin "${manifest.name}" threw for ${command}: ${err instanceof Error ? err.message : String(err)}`,
        },
        guidance,
        execution,
      );
    }
    if (typeof text !== 'string') {
      return failResult(
        manifestPath,
        {
          code: 'reporter-render-error',
          severity: 'error',
          message: `reporter plugin "${manifest.name}" returned ${typeof text}; expected string`,
        },
        guidance,
        execution,
      );
    }
    outputs.push({ command, text });
  }

  return {
    schemaVersion: 1,
    manifestPath,
    ok: true,
    diagnostics: [],
    ...guidance,
    execution,
    reporter: { outputs },
  };
}

function sampleReporterPayload(command: PluginReporterCommand): unknown {
  switch (command) {
    case 'ci':
      return { ci: { score: 100, grade: 'A', issues: [] } };
    case 'analyze':
      return { projectName: 'fixture', issues: [] };
    case 'doctor':
    default:
      return { health: { score: 100, grade: 'A', errors: 0, warnings: 0, infos: 0 }, issues: [] };
  }
}

type PluginResultGuidance = Pick<PluginTestResult, 'trust' | 'commands' | 'context'>;

async function buildPluginTestGuidance(
  manifestPath: string,
  modulePath?: string,
): Promise<PluginResultGuidance> {
  const source = modulePath ? await fs.readFile(modulePath, 'utf-8').catch(() => '') : '';
  const capabilities: PluginTestResult['context']['capabilities'] = [];
  if (/getSemanticGraph\s*\(/.test(source)) capabilities.push('semanticGraph');
  if (/getDataflow\s*\(/.test(source)) capabilities.push('dataflow');
  const requested =
    capabilities.length > 0 || /check\s*[:=]?\s*(?:async\s*)?\([^)]*context/.test(source);
  return {
    trust: {
      localOnly: true,
      previewFlag: 'PROJSCAN_PLUGINS_PREVIEW=1',
      reminder: 'Local plugins execute code from this repository. Only enable plugins you trust.',
    },
    commands: {
      validate: `projscan plugin validate ${manifestPath}`,
      test: `projscan plugin test ${manifestPath} --format json`,
      execute: `${PLUGIN_PREVIEW_FLAG}=1 projscan plugin test ${manifestPath} --execute --format json`,
      enable: `${PLUGIN_PREVIEW_FLAG}=1 projscan doctor`,
    },
    context: {
      requested,
      capabilities,
      note: requested
        ? 'This analyzer appears to request optional graph/dataflow context; test it before enabling preview execution.'
        : 'No optional graph/dataflow analyzer context request was detected.',
    },
  };
}

function failResult(
  manifestPath: string,
  diagnostic: { code: string; severity: IssueSeverity; message: string },
  guidance: PluginResultGuidance = defaultPluginTestGuidance(manifestPath),
  execution: PluginTestResult['execution'] = staticExecution(),
): PluginTestResult {
  return {
    schemaVersion: 1,
    manifestPath,
    ok: false,
    diagnostics: [diagnostic],
    ...guidance,
    execution,
  };
}

async function checkModuleReadable(
  modulePath: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await fs.access(modulePath);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: `plugin module is not readable at ${modulePath}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function staticExecution(
  note = 'Static validation completed without importing or running local plugin code.',
): PluginTestResult['execution'] {
  return {
    requested: false,
    executed: false,
    mode: 'static',
    note,
  };
}

function executeMode(): PluginTestResult['execution'] {
  return {
    requested: true,
    executed: true,
    mode: 'execute',
    note: 'Local plugin module was imported and executed because --execute was requested and the preview flag was enabled.',
  };
}

function defaultPluginTestGuidance(manifestPath: string): PluginResultGuidance {
  return {
    trust: {
      localOnly: true,
      previewFlag: 'PROJSCAN_PLUGINS_PREVIEW=1',
      reminder: 'Local plugins execute code from this repository. Only enable plugins you trust.',
    },
    commands: {
      validate: `projscan plugin validate ${manifestPath}`,
      test: `projscan plugin test ${manifestPath} --format json`,
      execute: `${PLUGIN_PREVIEW_FLAG}=1 projscan plugin test ${manifestPath} --execute --format json`,
      enable: `${PLUGIN_PREVIEW_FLAG}=1 projscan doctor`,
    },
    context: {
      requested: false,
      capabilities: [],
      note: 'Plugin context capabilities were not inspected because validation failed before module testing.',
    },
  };
}

async function assertDoesNotExist(filePath: string): Promise<void> {
  try {
    await fs.access(filePath);
    throw new Error(`${filePath} already exists`);
  } catch (err) {
    if (err instanceof Error && err.message.includes('already exists')) throw err;
  }
}

function safePluginFileName(name: string): string {
  const safe = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return safe || 'plugin';
}

function isIssueShape(value: unknown): value is Issue {
  if (!value || typeof value !== 'object') return false;
  const issue = value as Record<string, unknown>;
  return (
    typeof issue.id === 'string' &&
    typeof issue.title === 'string' &&
    typeof issue.description === 'string' &&
    (issue.severity === 'info' || issue.severity === 'warning' || issue.severity === 'error') &&
    typeof issue.category === 'string' &&
    typeof issue.fixAvailable === 'boolean'
  );
}

function importPluginModule(modulePath: string): Promise<Record<string, unknown>> {
  return dynamicImport(pathToFileURL(modulePath).href).catch(async (err) => {
    if (
      !(err instanceof TypeError) ||
      !err.message.includes('dynamic import callback was not specified')
    ) {
      throw err;
    }
    return importPluginModuleFromSource(modulePath);
  });
}

async function importPluginModuleFromSource(modulePath: string): Promise<Record<string, unknown>> {
  const originalSource = await fs.readFile(modulePath, 'utf-8');
  const { source, bindings } = stripSupportedImports(originalSource);
  const defaultMatch = source.match(/^\s*export\s+default\s+([\s\S]*?)\s*;?\s*$/);
  if (defaultMatch) {
    const expression = defaultMatch[1].trim().replace(/;$/, '');
    return {
      default: new Function(...Object.keys(bindings), `return (${expression});`)(
        ...Object.values(bindings),
      ) as unknown,
    };
  }

  const names: string[] = [];
  let transformed = source.replace(
    /\bexport\s+(async\s+function|function)\s+([A-Za-z_$][\w$]*)/g,
    (_m, kind, name) => {
      names.push(String(name));
      return `${kind} ${name}`;
    },
  );
  transformed = transformed.replace(/\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*=/g, (_m, name) => {
    names.push(String(name));
    return `const ${name} =`;
  });
  if (names.length === 0) {
    throw new Error('unsupported module syntax in Vitest VM fallback');
  }
  return new Function(`${transformed}\nreturn { ${names.join(', ')} };`)() as Record<
    string,
    unknown
  >;
}

function stripSupportedImports(source: string): {
  source: string;
  bindings: Record<string, unknown>;
} {
  const bindings: Record<string, unknown> = {};
  const stripped = source.replace(
    /^\s*import\s+\{\s*readFile\s*\}\s+from\s+['"]node:fs\/promises['"];\s*/m,
    () => {
      bindings.readFile = fs.readFile;
      return '';
    },
  );
  return { source: stripped, bindings };
}

function escapeForSingleQuotedJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
