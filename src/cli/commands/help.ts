import { program } from '../_shared.js';
import { showHelp } from '../../utils/banner.js';

export function registerHelp(): void {
  program
    .command('help')
    .description('Show detailed help with all commands and options')
    .action(() => {
      showHelp();
    });
}
