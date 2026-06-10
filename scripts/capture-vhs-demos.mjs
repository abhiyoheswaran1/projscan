import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');
const vhsBinDir = path.join(repoRoot, '.projscan', 'vhs-bin');
const vhsShimPath = path.join(vhsBinDir, 'projscan');
const vhsMissionDir = path.join(repoRoot, '.projscan', 'vhs-mission');

const tapes = [
  {
    name: 'Mission Control terminal demo',
    tape: path.join(repoRoot, 'docs', 'demos', 'projscan-mission-control.tape'),
    output: path.join(repoRoot, 'docs', 'projscan-mission-control.gif'),
  },
  {
    name: 'Mission Proof terminal demo',
    tape: path.join(repoRoot, 'docs', 'demos', 'projscan-mission-proof.tape'),
    output: path.join(repoRoot, 'docs', 'projscan-mission-proof.gif'),
  },
];

const quoteForShell = (value) => `'${value.replaceAll("'", "'\"'\"'")}'`;

const fail = (message, status = 1) => {
  console.error(message);
  process.exit(status);
};

if (!existsSync(cliPath)) {
  fail('Missing dist/cli/index.js. Run `npm run build` before capturing VHS demos.');
}

const vhsVersion = spawnSync('vhs', ['--version'], { cwd: repoRoot, encoding: 'utf8' });
if (vhsVersion.status !== 0) {
  fail('Missing `vhs`. Install it with `brew install vhs`, then run `npm run docs:demos`.');
}

for (const tape of tapes) {
  if (!existsSync(tape.tape)) {
    fail(`Missing VHS tape: ${path.relative(repoRoot, tape.tape)}`);
  }
}

mkdirSync(vhsBinDir, { recursive: true });
writeFileSync(vhsShimPath, `#!/usr/bin/env sh\nexec node ${quoteForShell(cliPath)} "$@"\n`);
chmodSync(vhsShimPath, 0o755);

const env = {
  ...process.env,
  PATH: `${vhsBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
};

try {
  rmSync(vhsMissionDir, { recursive: true, force: true });

  for (const tape of tapes) {
    console.log(`Capturing ${tape.name} -> ${path.relative(repoRoot, tape.output)}`);
    const result = spawnSync('vhs', [path.relative(repoRoot, tape.tape)], {
      cwd: repoRoot,
      env,
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      fail(`VHS capture failed for ${path.relative(repoRoot, tape.tape)}`, result.status ?? 1);
    }

    if (!existsSync(tape.output)) {
      fail(`VHS did not write expected output: ${path.relative(repoRoot, tape.output)}`);
    }
  }
} finally {
  rmSync(vhsMissionDir, { recursive: true, force: true });
  rmSync(vhsBinDir, { recursive: true, force: true });
}

console.log('VHS demos captured.');
