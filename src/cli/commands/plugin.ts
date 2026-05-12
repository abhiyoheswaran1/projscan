import chalk from 'chalk';

import { program, getRootPath, getFormat, setupLogLevel, maybeCompactBanner } from '../_shared.js';
import {
  PLUGIN_PREVIEW_FLAG,
  discoverPluginManifests,
  pluginsEnabled,
  validateManifest,
} from '../../core/plugins.js';
import fs from 'node:fs/promises';

/**
 * `projscan plugin` (1.10+ preview) — list and validate analyzer plugins
 * under `<root>/.projscan-plugins/`. Behind the PROJSCAN_PLUGINS_PREVIEW=1
 * env flag; the schema is preview-only and may shift before 2.0.
 */
export function registerPlugin(): void {
  const plugin = program
    .command('plugin')
    .description('Discover and validate analyzer plugins (1.10+ preview)')
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
    .description('Validate a .projscan-plugin.json manifest against the 1.10 schema')
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
          })),
        },
        null,
        2,
      ),
    );
    return;
  }
  console.log('');
  console.log(chalk.bold('Plugins (1.10+ preview)'));
  console.log(chalk.dim('────────────────────────────────────────'));
  console.log(
    `  preview enabled: ${enabled ? chalk.green('yes') : chalk.dim('no')} ${chalk.dim(`(${PLUGIN_PREVIEW_FLAG}=1)`)}`,
  );
  if (entries.length === 0) {
    console.log(chalk.dim('  no manifests found under .projscan-plugins/'));
    return;
  }
  for (const e of entries) {
    if (e.manifest) {
      console.log(
        `  ${chalk.green('✓')} ${chalk.bold(e.manifest.name)} ${chalk.dim(`(${e.manifest.kind}, ${e.manifest.category})`)}`,
      );
      console.log(chalk.dim(`      ${e.manifestPath}`));
      console.log(chalk.dim(`      module: ${e.manifest.module}`));
    } else {
      console.log(`  ${chalk.red('✗')} ${e.manifestPath}`);
      console.log(chalk.red(`      ${e.error}`));
    }
  }
  if (!enabled) {
    console.log('');
    console.log(
      chalk.dim(
        `  Discovered but inactive. Set ${PLUGIN_PREVIEW_FLAG}=1 in the environment to enable the preview.`,
      ),
    );
  }
}

async function runValidate(manifestPath: string): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const format = getFormat();
  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, 'utf-8');
  } catch (err) {
    fail(`unable to read manifest: ${err instanceof Error ? err.message : String(err)}`, format);
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(`invalid JSON: ${err instanceof Error ? err.message : String(err)}`, format);
    return;
  }
  const v = validateManifest(parsed);
  if (format === 'json') {
    console.log(JSON.stringify(v.ok ? { ok: true, manifest: v.manifest } : { ok: false, error: v.reason }, null, 2));
    if (!v.ok) process.exit(1);
    return;
  }
  if (v.ok) {
    console.log(chalk.green(`✓ ${manifestPath} validates against schema v${v.manifest.schemaVersion}.`));
  } else {
    console.error(chalk.red(`✗ ${manifestPath}: ${v.reason}`));
    process.exit(1);
  }
}

function fail(reason: string, format: string): void {
  if (format === 'json') {
    console.log(JSON.stringify({ ok: false, error: reason }, null, 2));
  } else {
    console.error(chalk.red(`✗ ${reason}`));
  }
  process.exit(1);
}
