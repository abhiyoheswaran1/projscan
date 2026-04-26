#!/usr/bin/env node
/**
 * Reference-repo benchmark: runs the projscan benchmark suite against real
 * external codebases so the README's "scales to" numbers reflect production-
 * sized workloads, not the projscan repo + a 500-file synthetic.
 *
 * Targets (cached under `.bench-cache/` in the repo root, gitignored):
 *   - TypeScript (microsoft/TypeScript)        — large TS codebase
 *   - Django (django/django)                   — large Python codebase
 *   - kubernetes/client-go                     — large Go codebase
 *
 * Usage:
 *   npm run bench:references
 *   npm run bench:references -- --skip-clone   # use existing clones only
 *   npm run bench:references -- --only ts      # restrict to one target
 *
 * Each clone is shallow (depth 1). First run is network-bound; subsequent
 * runs reuse the cache. Output is plain markdown so you can paste it into
 * the README.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const cli = path.join(repoRoot, 'dist/cli/index.js');
const cacheDir = path.join(repoRoot, '.bench-cache');

const REFERENCES = [
  {
    key: 'ts',
    label: 'microsoft/TypeScript (TS)',
    url: 'https://github.com/microsoft/TypeScript.git',
    commands: ['analyze', 'doctor', 'hotspots', 'coupling', 'search'],
  },
  {
    key: 'django',
    label: 'django/django (Python)',
    url: 'https://github.com/django/django.git',
    commands: ['analyze', 'doctor', 'hotspots', 'coupling', 'search'],
  },
  {
    key: 'k8s-client-go',
    label: 'kubernetes/client-go (Go)',
    url: 'https://github.com/kubernetes/client-go.git',
    commands: ['analyze', 'doctor', 'hotspots', 'coupling', 'search'],
  },
];

const args = new Set(process.argv.slice(2));
const skipClone = args.has('--skip-clone');
let only = null;
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--only=')) only = a.slice('--only='.length);
  else if (a === '--only' && process.argv[process.argv.indexOf(a) + 1]) {
    only = process.argv[process.argv.indexOf(a) + 1];
  }
}

if (!existsSync(cli)) {
  console.error(`✗ ${cli} missing - run "npm run build" first.`);
  process.exit(1);
}

console.log('# projscan reference-repo benchmark');
console.log(`node ${process.version} · ${os.type()} ${os.release()} · ${os.cpus()[0].model}`);
console.log(`cli: ${cli}`);

for (const ref of REFERENCES) {
  if (only && ref.key !== only) continue;
  const dir = path.join(cacheDir, ref.key);
  const ready = existsSync(dir);
  if (!ready) {
    if (skipClone) {
      console.log(`\n## ${ref.label}\n(skipped: --skip-clone and ${dir} missing)`);
      continue;
    }
    console.log(`\n## ${ref.label}\nCloning shallow into ${path.relative(repoRoot, dir)} ...`);
    try {
      execFileSync('git', ['clone', '--depth', '1', ref.url, dir], { stdio: 'inherit' });
    } catch (err) {
      console.error(`✗ clone failed: ${err.message}`);
      continue;
    }
  }

  await runBench(ref, dir);
}

console.log('\nDone.');

async function runBench(ref, root) {
  console.log(`\n## ${ref.label}`);
  console.log(`(at ${path.relative(repoRoot, root)})`);
  console.log(`\n${'cmd'.padEnd(12)} ${'cold (ms)'.padStart(10)} ${'warm (ms)'.padStart(10)}`);
  console.log('-'.repeat(34));
  for (const cmd of ref.commands) {
    try {
      rmSync(path.join(root, '.projscan-cache'), { recursive: true, force: true });
    } catch {
      /* ok */
    }
    const cold = runOnce(cmd, root);
    const warm = runOnce(cmd, root);
    console.log(
      `${cmd.padEnd(12)} ${cold === null ? '   timeout'.padStart(10) : cold.toFixed(0).padStart(10)} ${warm === null ? '   timeout'.padStart(10) : warm.toFixed(0).padStart(10)}`,
    );
  }
}

function runOnce(cmd, root) {
  const a = [cli, cmd, '--format', 'json'];
  if (cmd === 'search') a.push('handler');
  const t0 = process.hrtime.bigint();
  const result = spawnSync('node', a, {
    cwd: root,
    stdio: ['ignore', 'ignore', 'ignore'],
    timeout: 600_000,
  });
  const t1 = process.hrtime.bigint();
  if (result.error && result.error.code === 'ETIMEDOUT') return null;
  return Number(t1 - t0) / 1e6;
}
