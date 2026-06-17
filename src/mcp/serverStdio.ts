import readline from 'node:readline';
import type { McpServerHandle, McpServerOptions } from './serverTypes.js';

export interface RunMcpServerOptions {
  /** 1.3+ - emit notifications/file_changed on source-file changes. */
  watch?: boolean;
}

export type McpServerFactory = (rootPath: string, options?: McpServerOptions) => McpServerHandle;

export async function runMcpServerStdio(
  rootPath: string,
  runOptions: RunMcpServerOptions,
  createServer: McpServerFactory,
): Promise<void> {
  const server = createServer(rootPath, {
    notify: (payload) => {
      process.stdout.write(payload + '\n');
    },
    watch: runOptions.watch,
  });

  const watchSuffix = runOptions.watch ? ' [watch on]' : '';
  process.stderr.write(`[projscan-mcp] listening on stdio (root=${rootPath})${watchSuffix}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  rl.on('line', (line) => {
    server
      .handleMessage(line)
      .then((response) => {
        if (response !== null) {
          process.stdout.write(response + '\n');
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[projscan-mcp] error: ${message}\n`);
      });
  });

  await new Promise<void>((resolve) => {
    rl.on('close', resolve);
    process.stdin.on('end', resolve);
  });

  await server.close();
}
