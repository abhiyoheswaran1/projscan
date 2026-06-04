#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');

if (!existsSync(path.join(distDir, 'core', 'repositoryScanner.js'))) {
  console.error('release gate requires a fresh build. Run `npm run build` first.');
  process.exit(1);
}

const { scanRepository } = await import(pathToFileURL(path.join(distDir, 'core', 'repositoryScanner.js')).href);
const { check: supplyChainCheck } = await import(
  pathToFileURL(path.join(distDir, 'analyzers', 'supplyChainCheck.js')).href
);

const scan = await scanRepository(root);
const issues = await supplyChainCheck(root, scan.files);
const errors = issues.filter((issue) => issue.severity === 'error');
const warnings = issues.filter((issue) => issue.severity === 'warning');

for (const issue of issues) {
  const file = issue.locations?.[0]?.file ? ` (${issue.locations[0].file})` : '';
  const prefix = issue.severity === 'error' ? '::error::' : '::warning::';
  console.error(`${prefix}${issue.title}${file}`);
  console.error(issue.description);
}

if (errors.length > 0) {
  console.error(`release gate blocked: ${errors.length} supply-chain error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}

console.error(`release gate supply-chain scan passed: 0 error(s), ${warnings.length} warning(s).`);

// Audit the full dependency set, including dev tooling used by tests, release
// checks, and local validation. Dev-only criticals can still compromise release work.
await run('npm', ['audit', '--audit-level=moderate'], 'npm audit');
await run('npm', ['audit', 'signatures'], 'npm audit signatures');

console.error('release gate passed.');

async function run(command, args, label) {
  try {
    const result = await execFileAsync(command, args, {
      cwd: root,
      env: process.env,
      maxBuffer: 20 * 1024 * 1024,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  } catch (err) {
    const e = err;
    if (e.stdout) process.stdout.write(e.stdout);
    if (e.stderr) process.stderr.write(e.stderr);
    console.error(`::error::${label} failed.`);
    process.exit(typeof e.code === 'number' ? e.code : 1);
  }
}
