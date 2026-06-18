import { program } from '../_shared.js';
import { runStartCommandAction } from './startAction.js';
import { registerStartOptions } from './startOptionsRegistration.js';

export function registerStart(): void {
  const startCommand = program
    .command('start')
    .description('Orient an engineer or agent with the next best workflow for this repo');

  registerStartOptions(startCommand).action(runStartCommandAction);
}
