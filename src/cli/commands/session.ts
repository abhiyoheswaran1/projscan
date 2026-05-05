import chalk from 'chalk';

import { program, getRootPath, getFormat, setupLogLevel, maybeCompactBanner } from '../_shared.js';
import {
  loadSession,
  resetSession,
  type Session,
  type SessionTouch,
} from '../../core/session.js';

/**
 * `projscan session` — inspect the durable cross-invocation session that
 * the MCP server populates as agents work. Mirrors the `projscan_session`
 * MCP tool but for terminal use.
 *
 * Subcommands:
 *   projscan session                  — current session summary (default)
 *   projscan session touched          — list files touched this session
 *   projscan session events           — chronological event log
 *   projscan session reset            — discard the current session
 */
export function registerSession(): void {
  const session = program
    .command('session')
    .description('Inspect or reset the durable cross-invocation session (1.4+)')
    .action(async () => {
      await runSummary();
    });

  session
    .command('touched')
    .description('List files touched this session (sorted by last-touched desc)')
    .option('--source <source>', 'restrict to tool-result | fs-watch | explicit')
    .option('--limit <n>', 'show at most N entries', (v) => parseInt(v, 10))
    .action(async (opts: { source?: string; limit?: number }) => {
      await runTouched(opts);
    });

  session
    .command('events')
    .description('Show the session event log, newest first')
    .option('--limit <n>', 'show at most N entries', (v) => parseInt(v, 10))
    .action(async (opts: { limit?: number }) => {
      await runEvents(opts);
    });

  session
    .command('reset')
    .description('Discard the current session and start a fresh one')
    .action(async () => {
      await runReset();
    });
}

async function runSummary(): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const rootPath = getRootPath();
  const format = getFormat();
  try {
    const { session: sess, created } = await loadSession(rootPath);
    if (format === 'json') {
      console.log(JSON.stringify({ session: sess, created }, null, 2));
      return;
    }
    printSummary(sess, created);
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

async function runTouched(opts: { source?: string; limit?: number }): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const rootPath = getRootPath();
  const format = getFormat();
  try {
    const { session: sess } = await loadSession(rootPath);
    const all = Object.values(sess.touchedFiles);
    const filtered = opts.source ? all.filter((t) => t.source === opts.source) : all;
    filtered.sort((a, b) => b.lastTouchedAt.localeCompare(a.lastTouchedAt));
    const limited = typeof opts.limit === 'number' && opts.limit > 0 ? filtered.slice(0, opts.limit) : filtered;
    if (format === 'json') {
      console.log(JSON.stringify({ sessionId: sess.id, total: filtered.length, touched: limited }, null, 2));
      return;
    }
    printTouched(sess, limited, filtered.length);
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

async function runEvents(opts: { limit?: number }): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const rootPath = getRootPath();
  const format = getFormat();
  try {
    const { session: sess } = await loadSession(rootPath);
    const reversed = [...sess.events].reverse();
    const limited = typeof opts.limit === 'number' && opts.limit > 0 ? reversed.slice(0, opts.limit) : reversed;
    if (format === 'json') {
      console.log(JSON.stringify({ sessionId: sess.id, total: reversed.length, events: limited }, null, 2));
      return;
    }
    printEvents(sess, limited, reversed.length);
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

async function runReset(): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const rootPath = getRootPath();
  const format = getFormat();
  try {
    const fresh = await resetSession(rootPath);
    if (format === 'json') {
      console.log(JSON.stringify({ reset: true, session: fresh }, null, 2));
      return;
    }
    console.log(chalk.green('✓ Session reset.'));
    console.log(`  New session id: ${fresh.id}`);
    console.log(`  Started at: ${fresh.startedAt}`);
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

function printSummary(session: Session, created: boolean): void {
  const startedAtMs = Date.parse(session.startedAt);
  const ageMs = Number.isFinite(startedAtMs) ? Date.now() - startedAtMs : null;
  console.log('');
  console.log(chalk.bold('Session'));
  console.log(chalk.dim('────────────────────────────────────────'));
  console.log(`  id:           ${session.id}`);
  console.log(`  status:       ${created ? chalk.cyan('fresh (just created)') : chalk.green('active')}`);
  console.log(`  started:      ${session.startedAt}`);
  console.log(`  last activity: ${session.lastActivityAt}`);
  if (ageMs !== null) {
    console.log(`  age:          ${formatDuration(ageMs)}`);
  }
  console.log('');
  console.log(`  touched files: ${Object.keys(session.touchedFiles).length}`);
  console.log(`  events:        ${session.events.length}`);
  console.log('');
  console.log(chalk.dim('  Tip: run `projscan session touched` for the file list.'));
}

function printTouched(session: Session, items: SessionTouch[], total: number): void {
  console.log('');
  console.log(chalk.bold(`Touched files (${session.id.slice(0, 8)})`));
  console.log(chalk.dim('────────────────────────────────────────'));
  if (items.length === 0) {
    console.log(chalk.dim('  No files touched in this session yet.'));
    return;
  }
  for (const t of items) {
    const sourceTag = formatSourceTag(t.source);
    console.log(`  ${sourceTag} ${t.file}  ${chalk.dim(`(×${t.count}, ${t.lastTouchedAt})`)}`);
  }
  if (items.length < total) {
    console.log('');
    console.log(chalk.dim(`  ${total - items.length} more — pass --limit ${total} to see all.`));
  }
}

function printEvents(session: Session, items: typeof session.events, total: number): void {
  console.log('');
  console.log(chalk.bold(`Events (${session.id.slice(0, 8)})`));
  console.log(chalk.dim('────────────────────────────────────────'));
  if (items.length === 0) {
    console.log(chalk.dim('  No events recorded in this session yet.'));
    return;
  }
  for (const e of items) {
    console.log(`  ${chalk.dim(e.at)}  ${e.kind}`);
  }
  if (items.length < total) {
    console.log('');
    console.log(chalk.dim(`  ${total - items.length} more — pass --limit ${total} to see all.`));
  }
}

function formatSourceTag(source: SessionTouch['source']): string {
  switch (source) {
    case 'tool-result':
      return chalk.cyan('[tool]    ');
    case 'fs-watch':
      return chalk.yellow('[fs-watch]');
    case 'explicit':
      return chalk.magenta('[explicit]');
    default:
      return chalk.dim('[unknown] ');
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
