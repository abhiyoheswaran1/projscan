import chalk from 'chalk';
import path from 'node:path';

import { program, getRootPath, getFormat, setupLogLevel, maybeCompactBanner } from '../_shared.js';
import {
  PLUGIN_PREVIEW_FLAG,
  discoverPluginManifests,
  pluginsEnabled,
  readPluginManifestFile,
  type PluginDiagnostic,
} from '../../core/plugins.js';

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
}

async function runList(): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const rootPath = getRootPath();
  const format = getFormat();
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
  const format = getFormat();
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

function resolveManifestPath(rootPath: string, manifestPath: string): string {
  return path.isAbsolute(manifestPath) ? manifestPath : path.resolve(rootPath, manifestPath);
}

function printDiagnostic(diagnostic: PluginDiagnostic): void {
  console.error(chalk.red(`      [${diagnostic.code}] ${diagnostic.message}`));
  if (diagnostic.hint) console.error(chalk.dim(`      hint: ${diagnostic.hint}`));
}
