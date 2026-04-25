/**
 * Performance benchmark suite. Runs key projscan commands against fixture
 * repos and prints timing. Use to spot perf regressions release-over-release.
 *
 * Usage:
 *   node scripts/bench.mjs
 *
 * Requires `npm run build` to have populated dist/ first.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const cli = path.join(repoRoot, 'dist/cli/index.js');

const COMMANDS = ['analyze', 'doctor', 'hotspots', 'coupling', 'search'];

function runOnce(cmd, root) {
  const args = [cli, cmd, '--format', 'json'];
  if (cmd === 'search') args.push('test');
  const t0 = process.hrtime.bigint();
  try {
    execFileSync('node', args, {
      cwd: root,
      stdio: ['ignore', 'ignore', 'ignore'],
      timeout: 120_000,
    });
  } catch {
    // Some commands exit non-zero on issues found; that's fine for timing.
  }
  const t1 = process.hrtime.bigint();
  return Number(t1 - t0) / 1e6;
}

function bench(label, root) {
  console.log(`\n## ${label}`);
  console.log(`(at ${root})`);
  console.log(`\n${'cmd'.padEnd(12)} ${'cold (ms)'.padStart(10)} ${'warm (ms)'.padStart(10)}`);
  console.log('-'.repeat(34));
  // Wipe cache for cold timing
  try {
    rmSync(path.join(root, '.projscan-cache'), { recursive: true, force: true });
  } catch {
    /* ok */
  }
  for (const cmd of COMMANDS) {
    // Wipe cache so each command's first run is cold for that specific tool
    try {
      rmSync(path.join(root, '.projscan-cache'), { recursive: true, force: true });
    } catch {
      /* ok */
    }
    const cold = runOnce(cmd, root);
    const warm = runOnce(cmd, root);
    console.log(
      `${cmd.padEnd(12)} ${cold.toFixed(0).padStart(10)} ${warm.toFixed(0).padStart(10)}`,
    );
  }
}

function makeSyntheticRepo(fileCount) {
  const dir = mkdtempSync(path.join(os.tmpdir(), `projscan-bench-${fileCount}-`));
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: `bench-${fileCount}`, version: '0.0.0', dependencies: {} }, null, 2),
  );
  mkdirSync(path.join(dir, 'src'), { recursive: true });
  for (let i = 0; i < fileCount; i++) {
    const peers = Array.from({ length: Math.min(3, i) }, (_, j) => i - 1 - j);
    const imports = peers.map((p) => `import { fn${p} } from './mod${p}.js';`).join('\n');
    const body = `${imports}\n\nexport function fn${i}(x: number): number {\n  if (x > 0) return x + ${i};\n  return ${i};\n}\n`;
    writeFileSync(path.join(dir, `src/mod${i}.ts`), body);
  }
  return dir;
}

console.log('# projscan benchmark');
console.log(`node ${process.version} · ${os.type()} ${os.release()} · ${os.cpus()[0].model}`);
console.log(`projscan: ${cli}`);

bench('Small (projscan repo, ~120 files)', repoRoot);

const synthDir = makeSyntheticRepo(500);
try {
  bench('Synthetic medium (500 generated TS files)', synthDir);
} finally {
  rmSync(synthDir, { recursive: true, force: true });
}

console.log('\nDone.');
