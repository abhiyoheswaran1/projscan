import type { Command } from 'commander';
import { parsePositiveInt } from './startAction.js';

export function registerStartOptions(command: Command): Command {
  return command
    .option(
      '--mode <mode>',
      'before_edit, before_handoff, before_commit, before_merge, refactor, release, bug_hunt, or hardening',
    )
    .option('--intent <text>', 'plain-language goal to route into the next best action')
    .option('--mission <dir>', 'read an existing Mission Control bundle and include proof outcome')
    .option('--max-tasks <count>', 'maximum workplan tasks to inspect', parsePositiveInt)
    .option('--max-risks <count>', 'maximum start risks to return', parsePositiveInt)
    .option('--include-handoff', 'include a compact handoff payload')
    .option('--handoff-prompt', 'print only the concise Mission Control handoff prompt')
    .option('--next-command', 'print only the current Mission Control cursor command')
    .option(
      '--next-tool-call',
      'print only the current Mission Control cursor MCP tool call as JSON',
    )
    .option(
      '--ready-tool-calls',
      'print all currently ready Mission Control MCP tool calls as compact JSON',
    )
    .option('--proof-commands', 'print only ready Mission Control proof commands')
    .option('--checklist', 'print only the Mission Control resume checklist')
    .option('--resume-json', 'print only the Mission Control resume object as compact JSON')
    .option('--handoff-json', 'print only the Mission Control handoff object as compact JSON')
    .option('--save-mission <dir>', 'write the Mission Control bundle to this directory')
    .option('--runbook', 'print only the Mission Control Markdown runbook')
    .option('--task-card', 'print only the Mission Control Markdown task card')
    .option('--review-gate', 'print only the Mission Control review gate')
    .option('--review-gate-json', 'print only the Mission Control review gate as JSON')
    .option('--review-policy', 'print only the Mission Control review policy as JSON')
    .option('--review-replies', 'print only the Mission Control reviewer reply choices')
    .option('--mission-script', 'print the Mission Control shell script')
    .option('--shortcuts', 'print the Mission Control shortcut command index')
    .option('--shortcuts-json', 'print the Mission Control shortcut command index as JSON');
}
