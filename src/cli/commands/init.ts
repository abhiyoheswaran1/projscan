import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

import { program, getRootPath, setupLogLevel, maybeCompactBanner, assertFormatSupported } from '../_shared.js';
import { getMcpConfigGuide, isMcpClientId, MCP_CLIENT_IDS, type McpConfigCatalog, type McpConfigGuide } from '../../core/adoption.js';

/**
 * `projscan init` (1.6+) — scaffold `.projscanrc.json` for new
 * adopters. Idempotent: if the config already exists, prints a diff
 * against the suggested defaults instead of overwriting.
 */
export function registerInit(): void {
  const init = program
    .command('init')
    .description('Scaffold .projscanrc.json with sensible defaults (1.6+)')
    .option('--force', 'overwrite an existing .projscanrc.json (default: refuse)')
    .action(async (opts: { force?: boolean }) => {
      setupLogLevel();
      maybeCompactBanner();
      assertFormatSupported('init');
      const rootPath = getRootPath();
      try {
        await runInit(rootPath, opts.force === true);
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  init
    .command('mcp')
    .description('Print ready-to-paste MCP client config snippets')
    .option('--client <client>', `client: ${MCP_CLIENT_IDS.join(', ')}`, 'all')
    .action(async (opts: { client?: string }) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('init mcp');
      const client = opts.client ?? 'all';
      if (!isMcpClientId(client)) {
        console.error(chalk.red(`Unsupported --client ${client}.`));
        console.error(chalk.dim(`Supported clients: ${MCP_CLIENT_IDS.join(', ')}`));
        process.exit(1);
      }
      const guide = getMcpConfigGuide(client);
      if (format === 'json') {
        console.log(JSON.stringify(guide, null, 2));
        return;
      }
      printMcpGuide(guide);
    });
}

const DEFAULT_CONFIG = {
  minScore: 70,
  hotspots: { limit: 10 },
  ignore: [],
  disableRules: [],
};

async function runInit(rootPath: string, force: boolean): Promise<void> {
  const target = path.join(rootPath, '.projscanrc.json');
  let exists = false;
  try {
    await fs.access(target);
    exists = true;
  } catch {
    // not present
  }

  if (exists && !force) {
    console.log('');
    console.log(chalk.yellow('⚠ .projscanrc.json already exists. Refusing to overwrite.'));
    console.log(chalk.dim('  Pass --force to overwrite, or merge manually with the defaults below:'));
    console.log('');
    console.log(prefixIndent(JSON.stringify(DEFAULT_CONFIG, null, 2), '  '));
    console.log('');
    console.log(
      chalk.dim('  See https://github.com/abhiyoheswaran1/projscan#projscanrc for the field reference.'),
    );
    return;
  }

  const content = JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n';
  await fs.writeFile(target, content, 'utf-8');
  console.log('');
  console.log(chalk.green('✓ Created .projscanrc.json'));
  console.log('');
  console.log(prefixIndent(content.trimEnd(), '  '));
  console.log('');
  console.log(chalk.dim('  Tune the score threshold, ignore globs, or disabled rules as needed.'));
  console.log(chalk.dim('  Then run `projscan ci --min-score 70` (or whatever you set).'));
}

function prefixIndent(text: string, indent: string): string {
  return text
    .split('\n')
    .map((l) => indent + l)
    .join('\n');
}

function printMcpGuide(guide: McpConfigCatalog | McpConfigGuide): void {
  console.log('');
  console.log(chalk.bold('MCP Client Config'));
  console.log(chalk.dim('────────────────────────────────────────'));
  console.log(`  install: ${chalk.cyan(guide.install.command)}`);
  console.log(`  server : ${chalk.cyan(guide.install.mcpServerCommand)}`);
  console.log('');

  if (guide.client === 'all') {
    for (const config of guide.configs) printSingleGuide(config);
    return;
  }
  printSingleGuide(guide);
}

function printSingleGuide(guide: McpConfigGuide): void {
  console.log(chalk.bold(`  ${guide.displayName}`));
  console.log(chalk.dim(`  ${guide.whereToPaste}`));
  console.log(prefixIndent(guide.configText, '    '));
  if (guide.notes.length > 0) {
    console.log(chalk.dim(`    note: ${guide.notes.join(' ')}`));
  }
  console.log('');
}
