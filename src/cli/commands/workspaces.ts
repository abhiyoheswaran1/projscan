import chalk from 'chalk';

import { program, getFormat, getRootPath, setupLogLevel, maybeCompactBanner } from '../_shared.js';
import { detectWorkspaces } from '../../core/monorepo.js';
import { reportWorkspaces } from '../../reporters/consoleReporter.js';
import { reportWorkspacesJson } from '../../reporters/jsonReporter.js';
import { reportWorkspacesMarkdown } from '../../reporters/markdownReporter.js';

export function registerWorkspaces(): void {
  program
    .command('workspaces')
    .description('List monorepo workspace packages (npm/yarn workspaces, pnpm-workspace.yaml, Nx/Turbo/Lerna fallback)')
    .action(async () => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      try {
        const info = await detectWorkspaces(rootPath);
        switch (format) {
          case 'json':
            reportWorkspacesJson(info);
            break;
          case 'markdown':
            reportWorkspacesMarkdown(info);
            break;
          default:
            reportWorkspaces(info);
        }
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
