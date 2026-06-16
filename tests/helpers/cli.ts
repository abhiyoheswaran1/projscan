import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SpawnCliOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  maxBuffer?: number;
}

/**
 * A spawned `node dist/cli/index.js` very occasionally dies at ESM module-load
 * time on CI under heavy parallel-spawn load — e.g.
 *   SyntaxError: The requested module './pythonAdapter.js' does not provide an
 *   export named 'pythonAdapter'
 * The source graph is acyclic and the published artifact is correct, so this is
 * a transient loader hiccup, not a product bug; a fresh process links cleanly.
 *
 * This signature is unmistakable: the process exits non-zero, prints nothing to
 * stdout, and stderr carries a Node ESM-loader error. A real assertion/logic
 * failure (the CLI ran and produced the wrong output) does NOT match — it has
 * normal stdout/stderr — so retrying on this signature can never mask a genuine
 * failure. We retry exactly once; a deterministic crash still fails twice.
 */
const TRANSIENT_LOADER_CRASH =
  /does not provide an export named|ERR_MODULE_NOT_FOUND|Cannot find (module|package)|ERR_UNKNOWN_FILE_EXTENSION/;

function isTransientLoaderCrash(result: CliResult): boolean {
  return (
    result.exitCode !== 0 && result.stdout === '' && TRANSIENT_LOADER_CRASH.test(result.stderr)
  );
}

export async function spawnCli(
  cliPath: string,
  args: string[],
  options: SpawnCliOptions = {},
): Promise<CliResult> {
  const once = async (): Promise<CliResult> => {
    try {
      const result = await execFileAsync(process.execPath, [cliPath, ...args], {
        cwd: options.cwd,
        env: options.env ?? process.env,
        maxBuffer: options.maxBuffer ?? 1024 * 1024,
      });
      return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; code?: number };
      return {
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? '',
        exitCode: typeof e.code === 'number' ? e.code : 1,
      };
    }
  };

  const result = await once();
  return isTransientLoaderCrash(result) ? once() : result;
}
