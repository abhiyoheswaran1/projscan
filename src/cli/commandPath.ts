import type { Command } from 'commander';

export function cliCommandPath(actionCommand: Command, rootCommandName = 'projscan'): string {
  const parts: string[] = [];
  let current: Command | null = actionCommand;
  while (current && current.name() !== rootCommandName) {
    const name = current.name();
    if (name) parts.unshift(name);
    current = current.parent ?? null;
  }
  return parts.join(' ') || actionCommand.name() || 'unknown';
}
