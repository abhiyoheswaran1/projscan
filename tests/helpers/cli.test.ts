import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnCli } from './cli.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-spawncli-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

/** Write a fake "CLI" script and return its path. */
async function fakeCli(name: string, body: string): Promise<string> {
  const p = path.join(tmp, name);
  await fs.writeFile(p, body, 'utf-8');
  return p;
}

describe('spawnCli', () => {
  it('retries once when the first run is a transient ESM module-load crash', async () => {
    const marker = path.join(tmp, 'crashed-once');
    const cli = await fakeCli(
      'transient.mjs',
      `import fs from 'node:fs';
       if (!fs.existsSync(${JSON.stringify(marker)})) {
         fs.writeFileSync(${JSON.stringify(marker)}, '1');
         process.stderr.write("file:///x/registry.js\\nSyntaxError: The requested module './pythonAdapter.js' does not provide an export named 'pythonAdapter'\\n");
         process.exit(1);
       }
       process.stdout.write('RECOVERED');
       process.exit(0);`,
    );

    const result = await spawnCli(cli, []);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('RECOVERED');
  });

  it('does NOT retry a clean non-zero exit (real failure is never masked)', async () => {
    const count = path.join(tmp, 'invocations');
    const cli = await fakeCli(
      'cleanfail.mjs',
      `import fs from 'node:fs';
       fs.appendFileSync(${JSON.stringify(count)}, 'x');
       process.stderr.write('projscan understand does not support --format sarif\\n');
       process.exit(1);`,
    );

    const result = await spawnCli(cli, []);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('does not support --format sarif');
    // Invoked exactly once — a genuine failure must not be retried/masked.
    const invocations = await fs.readFile(count, 'utf-8');
    expect(invocations).toBe('x');
  });

  it('returns stdout/exit for a clean success without retrying', async () => {
    const count = path.join(tmp, 'invocations');
    const cli = await fakeCli(
      'ok.mjs',
      `import fs from 'node:fs';
       fs.appendFileSync(${JSON.stringify(count)}, 'x');
       process.stdout.write('OK');`,
    );

    const result = await spawnCli(cli, []);

    expect(result).toEqual({ stdout: 'OK', stderr: '', exitCode: 0 });
    expect(await fs.readFile(count, 'utf-8')).toBe('x');
  });
});
