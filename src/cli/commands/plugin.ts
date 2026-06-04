import chalk from 'chalk';
import path from 'node:path';

import { program, getRootPath, setupLogLevel, maybeCompactBanner, assertFormatSupported } from '../_shared.js';
import {
  PLUGIN_PREVIEW_FLAG,
  discoverPluginManifests,
  pluginsEnabled,
  readPluginManifestFile,
  type PluginDiagnostic,
} from '../../core/plugins.js';
import { initPlugin, testPlugin } from '../../core/pluginDx.js';

/**
 * `projscan plugin` — list and validate stable local plugins under
 * `<root>/.projscan-plugins/`. Execution is opt-in via
 * PROJSCAN_PLUGINS_PREVIEW=1 because plugins are local code.
 */
export function registerPlugin(): void {
  const plugin = program
    .command('plugin')
    .description('Discover and validate local plugins')
    .action(async () => {
      await runList();
    });

  plugin
    .command('list')
    .description('Enumerate manifests under <root>/.projscan-plugins/')
    .action(async () => {
      await runList();
    });

  plugin
    .command('validate <manifest>')
    .description('Validate a .projscan-plugin.json manifest against schema v1')
    .action(async (manifest: string) => {
      await runValidate(manifest);
    });

  plugin
    .command('init')
    .description('Scaffold a local analyzer or reporter plugin')
    .option('--kind <kind>', 'plugin kind: analyzer or reporter', 'analyzer')
    .option('--name <name>', 'plugin name', 'policy')
    .action(async (cmdOpts) => {
      await runInit(cmdOpts);
    });

  plugin
    .command('test <manifest>')
    .description('Validate a local plugin; execution requires --execute and PROJSCAN_PLUGINS_PREVIEW=1')
    .option('--fixture <path>', 'fixture root for analyzer plugins')
    .option('--execute', 'import and run local plugin code after static validation')
    .option('--confirm-execute', 'alias for --execute; confirms local code execution')
    .action(async (manifest: string, cmdOpts) => {
      await runTest(manifest, cmdOpts);
    });
}

async function runList(): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const rootPath = getRootPath();
  const format = assertFormatSupported('plugin list');
  const entries = await discoverPluginManifests(rootPath);
  const enabled = pluginsEnabled();
  if (format === 'json') {
    console.log(
      JSON.stringify(
        {
          enabled,
          envFlag: PLUGIN_PREVIEW_FLAG,
          plugins: entries.map((e) => ({
            manifestPath: e.manifestPath,
            ok: e.manifest !== null,
            manifest: e.manifest,
            error: e.error,
            diagnostic: e.diagnostic,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }
  console.log('');
  console.log(chalk.bold('Plugins'));
  console.log(chalk.dim('────────────────────────────────────────'));
  console.log(
    `  execution enabled: ${enabled ? chalk.green('yes') : chalk.dim('no')} ${chalk.dim(`(${PLUGIN_PREVIEW_FLAG}=1)`)}`,
  );
  if (entries.length === 0) {
    console.log(chalk.dim('  no manifests found under .projscan-plugins/'));
    return;
  }
  for (const e of entries) {
    if (e.manifest) {
      const detail =
        e.manifest.kind === 'analyzer'
          ? `${e.manifest.kind}, ${e.manifest.category}`
          : `${e.manifest.kind}, ${e.manifest.commands.join(', ')}`;
      console.log(`  ${chalk.green('✓')} ${chalk.bold(e.manifest.name)} ${chalk.dim(`(${detail})`)}`);
      console.log(chalk.dim(`      ${e.manifestPath}`));
      console.log(chalk.dim(`      module: ${e.manifest.module}`));
    } else {
      console.log(`  ${chalk.red('✗')} ${e.manifestPath}`);
      if (e.diagnostic) printDiagnostic(e.diagnostic);
      else console.log(chalk.red(`      ${e.error}`));
    }
  }
  if (!enabled) {
    console.log('');
    console.log(
      chalk.dim(
        `  Discovered but inactive. Set ${PLUGIN_PREVIEW_FLAG}=1 in the environment to enable local plugin execution.`,
      ),
    );
  }
}

async function runValidate(manifestPath: string): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const format = assertFormatSupported('plugin validate');
  const rootPath = getRootPath();
  const resolvedManifestPath = resolveManifestPath(rootPath, manifestPath);
  const v = await readPluginManifestFile(resolvedManifestPath);
  if (format === 'json') {
    console.log(
      JSON.stringify(
        v.ok ? { ok: true, manifest: v.manifest } : { ok: false, error: v.reason, diagnostic: v.diagnostic },
        null,
        2,
      ),
    );
    if (!v.ok) process.exit(1);
    return;
  }
  if (v.ok) {
    console.log(chalk.green(`✓ ${manifestPath} validates against schema v${v.manifest.schemaVersion}.`));
  } else {
    console.error(chalk.red(`✗ ${manifestPath}: ${v.reason}`));
    printDiagnostic(v.diagnostic);
    process.exit(1);
  }
}

async function runInit(cmdOpts: { kind?: string; name?: string }): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const format = assertFormatSupported('plugin init');
  const kind = parseKind(cmdOpts.kind);
  const rootPath = getRootPath();
  try {
    const result = await initPlugin(rootPath, { kind, name: cmdOpts.name });
    if (format === 'json') {
      console.log(JSON.stringify({ ok: true, ...result }, null, 2));
      return;
    }
    console.log(chalk.green(`✓ created ${path.relative(rootPath, result.manifestPath)}`));
    console.log(chalk.dim(`  module: ${path.relative(rootPath, result.modulePath)}`));
  } catch (err) {
    if (format === 'json') {
      console.log(
        JSON.stringify(
          { ok: false, error: err instanceof Error ? err.message : String(err) },
          null,
          2,
        ),
      );
    } else {
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    }
    process.exit(1);
  }
}

async function runTest(manifestPath: string, cmdOpts: { fixture?: string; execute?: boolean; confirmExecute?: boolean }): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const format = assertFormatSupported('plugin test');
  const rootPath = getRootPath();
  const resolvedManifestPath = resolveManifestPath(rootPath, manifestPath);
  const fixtureRoot =
    typeof cmdOpts.fixture === 'string'
      ? path.resolve(rootPath, cmdOpts.fixture)
      : rootPath;
  const execute = cmdOpts.execute === true || cmdOpts.confirmExecute === true;
  const result = await testPlugin(resolvedManifestPath, { fixtureRoot, execute });
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
    return;
  }
  if (result.ok) {
    if (!result.execution.executed) {
      console.log(chalk.green(`✓ ${manifestPath} passed static plugin validation.`));
      console.log(chalk.dim(`  execution skipped. Run ${result.commands.execute} to import and test local code.`));
      return;
    }
    console.log(chalk.green(`✓ ${manifestPath} loaded and passed plugin test.`));
    if (result.analyzer) {
      console.log(chalk.dim(`  analyzer issues: ${result.analyzer.issues.length}`));
    }
    if (result.reporter) {
      console.log(chalk.dim(`  reporter commands: ${result.reporter.outputs.map((o) => o.command).join(', ')}`));
    }
    return;
  }
  console.error(chalk.red(`✗ ${manifestPath} failed plugin test.`));
  for (const diagnostic of result.diagnostics) {
    console.error(chalk.red(`  [${diagnostic.code}] ${diagnostic.message}`));
  }
  process.exit(1);
}

function parseKind(value: unknown): 'analyzer' | 'reporter' {
  if (value === 'analyzer' || value === 'reporter') return value;
  console.error(chalk.red(`Unsupported --kind ${String(value)}.`));
  console.error(chalk.dim('Supported kinds: analyzer, reporter'));
  process.exit(1);
}

function resolveManifestPath(rootPath: string, manifestPath: string): string {
  return path.isAbsolute(manifestPath) ? manifestPath : path.resolve(rootPath, manifestPath);
}

function printDiagnostic(diagnostic: PluginDiagnostic): void {
  console.error(chalk.red(`      [${diagnostic.code}] ${diagnostic.message}`));
  if (diagnostic.hint) console.error(chalk.dim(`      hint: ${diagnostic.hint}`));
}
