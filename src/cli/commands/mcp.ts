import chalk from 'chalk';

import { program, getRootPath } from '../_shared.js';
import { setLogLevel } from '../../utils/logger.js';
import { runMcpServer } from '../../mcp/server.js';

export function registerMcp(): void {
  program
    .command('mcp')
    .description('Run projscan as an MCP server (stdio) for AI coding agents')
    .action(async () => {
      setLogLevel('quiet');
      const rootPath = getRootPath();
      try {
        await runMcpServer(rootPath);
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
