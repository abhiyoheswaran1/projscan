import chalk from 'chalk';
import path from 'node:path';

import {
  program,
  getRootPath,
  setupLogLevel,
  maybeCompactBanner,
  assertFormatSupported,
} from '../_shared.js';
import {
  PLUGIN_PREVIEW_FLAG,
  discoverPluginManifests,
  pluginsEnabled,
  readPluginManifestFile,
  type PluginDiagnostic,
  type PluginDiscoveryEntry,
  type PluginManifest,
} from '../../core/plugins.js';
import { initPlugin, testPlugin } from '../../core/pluginDx.js';
import {
  getPluginTrustStatus,
  trustPlugin,
  untrustPlugin,
  type PluginTrustStatus,
} from '../../core/pluginTrust.js';

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
    .description(
      'Validate a local plugin; execution requires --execute and PROJSCAN_PLUGINS_PREVIEW=1',
    )
    .option('--fixture <path>', 'fixture root for analyzer plugins')
    .option('--execute', 'import and run local plugin code after static validation')
    .option('--confirm-execute', 'alias for --execute; confirms local code execution')
    .action(async (manifest: string, cmdOpts) => {
      await runTest(manifest, cmdOpts);
    });

  plugin
    .command('trust [name]')
    .description('Approve a plugin module for execution (trust-on-first-use)')
    .option('--all', 'trust every valid discovered plugin')
    .action(async (name: string | undefined, cmdOpts: { all?: boolean }) => {
      await runTrust(name, cmdOpts);
    });

  plugin
    .command('untrust <name>')
    .description('Revoke a previously trusted plugin module')
    .action(async (name: string) => {
      await runUntrust(name);
    });
}

/** Absolute path to a manifest's module entry point. */
function moduleEntryPath(entry: PluginDiscoveryEntry & { manifest: PluginManifest }): string {
  return path.resolve(path.dirname(entry.manifestPath), entry.manifest.module);
}

function trustGlyph(status: PluginTrustStatus): string {
  if (status === 'trusted') return chalk.green('trusted');
  if (status === 'changed') return chalk.yellow('changed — re-approve');
  return chalk.red('untrusted');
}

async function runList(): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const rootPath = getRootPath();
  const format = assertFormatSupported('plugin list');
  const entries = await discoverPluginManifests(rootPath);
  const enabled = pluginsEnabled();

  // Resolve trust status for every valid manifest so both output formats can
  // show whether a discovered plugin would actually execute.
  const trustByManifest = new Map<string, PluginTrustStatus>();
  await Promise.all(
    entries.map(async (e) => {
      if (!e.manifest) return;
      const status = await getPluginTrustStatus(
        moduleEntryPath(e as PluginDiscoveryEntry & { manifest: PluginManifest }),
      );
      trustByManifest.set(e.manifestPath, status.status);
    }),
  );

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
            trust: trustByManifest.get(e.manifestPath) ?? null,
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
      console.log(
        `  ${chalk.green('✓')} ${chalk.bold(e.manifest.name)} ${chalk.dim(`(${detail})`)}`,
      );
      console.log(chalk.dim(`      ${e.manifestPath}`));
      console.log(chalk.dim(`      module: ${e.manifest.module}`));
      const status = trustByManifest.get(e.manifestPath) ?? 'untrusted';
      console.log(`      trust: ${trustGlyph(status)}`);
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
  const anyUntrusted = [...trustByManifest.values()].some((s) => s !== 'trusted');
  if (anyUntrusted) {
    console.log('');
    console.log(
      chalk.dim(
        '  Untrusted plugins are never executed. Approve one with `projscan plugin trust <name>` (or `--all`).',
      ),
    );
  }
}

async function runTrust(name: string | undefined, cmdOpts: { all?: boolean }): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const format = assertFormatSupported('plugin trust');
  const rootPath = getRootPath();
  const valid = (await discoverPluginManifests(rootPath)).filter(
    (e): e is PluginDiscoveryEntry & { manifest: PluginManifest } => e.manifest !== null,
  );

  let targets: Array<PluginDiscoveryEntry & { manifest: PluginManifest }>;
  if (cmdOpts.all) {
    targets = valid;
  } else if (!name) {
    fail(format, 'plugin trust requires a <name> or --all.');
    return;
  } else {
    const match = valid.find((e) => e.manifest.name === name);
    if (!match) {
      fail(format, `No valid plugin named "${name}" under .projscan-plugins/.`);
      return;
    }
    targets = [match];
  }

  if (targets.length === 0) {
    fail(format, 'No valid plugins found under .projscan-plugins/ to trust.');
    return;
  }

  const results: Array<{ name: string; ok: boolean; sha256?: string; error?: string }> = [];
  for (const e of targets) {
    const modulePath = moduleEntryPath(e);
    try {
      const entry = await trustPlugin(modulePath, e.manifest.name);
      results.push({ name: e.manifest.name, ok: true, sha256: entry.sha256 });
    } catch (err) {
      results.push({
        name: e.manifest.name,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (format === 'json') {
    console.log(JSON.stringify({ ok: results.every((r) => r.ok), trusted: results }, null, 2));
    if (!results.every((r) => r.ok)) process.exit(1);
    return;
  }
  for (const r of results) {
    if (r.ok) {
      console.log(
        `${chalk.green('✓')} trusted ${chalk.bold(r.name)} ${chalk.dim(`(sha256:${r.sha256?.slice(0, 12)}…)`)}`,
      );
    } else {
      console.error(`${chalk.red('✗')} ${r.name}: ${r.error}`);
    }
  }
  if (!results.every((r) => r.ok)) process.exit(1);
}

async function runUntrust(name: string): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const format = assertFormatSupported('plugin untrust');
  const rootPath = getRootPath();
  const match = (await discoverPluginManifests(rootPath)).find(
    (e): e is PluginDiscoveryEntry & { manifest: PluginManifest } => e.manifest?.name === name,
  );
  if (!match) {
    fail(format, `No valid plugin named "${name}" under .projscan-plugins/.`);
    return;
  }
  const removed = await untrustPlugin(moduleEntryPath(match));
  if (format === 'json') {
    console.log(JSON.stringify({ ok: true, name, removed }, null, 2));
    return;
  }
  console.log(
    removed
      ? `${chalk.green('✓')} revoked trust for ${chalk.bold(name)}`
      : chalk.dim(`  ${name} was not trusted; nothing to revoke.`),
  );
}

function fail(format: string, message: string): void {
  if (format === 'json') {
    console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  } else {
    console.error(chalk.red(message));
  }
  process.exit(1);
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
        v.ok
          ? { ok: true, manifest: v.manifest }
          : { ok: false, error: v.reason, diagnostic: v.diagnostic },
        null,
        2,
      ),
    );
    if (!v.ok) process.exit(1);
    return;
  }
  if (v.ok) {
    console.log(
      chalk.green(`✓ ${manifestPath} validates against schema v${v.manifest.schemaVersion}.`),
    );
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

async function runTest(
  manifestPath: string,
  cmdOpts: { fixture?: string; execute?: boolean; confirmExecute?: boolean },
): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const format = assertFormatSupported('plugin test');
  const rootPath = getRootPath();
  const resolvedManifestPath = resolveManifestPath(rootPath, manifestPath);
  const fixtureRoot =
    typeof cmdOpts.fixture === 'string' ? path.resolve(rootPath, cmdOpts.fixture) : rootPath;
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
      console.log(
        chalk.dim(
          `  execution skipped. Run ${result.commands.execute} to import and test local code.`,
        ),
      );
      return;
    }
    console.log(chalk.green(`✓ ${manifestPath} loaded and passed plugin test.`));
    if (result.analyzer) {
      console.log(chalk.dim(`  analyzer issues: ${result.analyzer.issues.length}`));
    }
    if (result.reporter) {
      console.log(
        chalk.dim(
          `  reporter commands: ${result.reporter.outputs.map((o) => o.command).join(', ')}`,
        ),
      );
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
