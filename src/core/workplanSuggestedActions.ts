import { escapeDoubleQuoted } from './startShellArgs.js';
import type { PreflightSuggestedAction, WorkplanTask } from '../types.js';

export function buildWorkplanSuggestedActions(
  preflightActions: PreflightSuggestedAction[],
  tasks: WorkplanTask[],
): PreflightSuggestedAction[] {
  return dedupeActions([
    ...preflightActions,
    ...tasks.flatMap((task) => taskToSuggestedActions(task)),
  ]);
}

function taskToSuggestedActions(task: WorkplanTask): PreflightSuggestedAction[] {
  return task.suggestedTools.slice(0, 3).flatMap((tool) => {
    const command = commandForSuggestedTool(tool, task);
    if (!command) return [];
    return [
      {
        label: `Use ${tool} for ${task.title}`,
        tool: tool.startsWith('projscan_') ? tool : undefined,
        command,
      },
    ];
  });
}

function commandForSuggestedTool(tool: string, task: WorkplanTask): string | undefined {
  if (!tool.startsWith('projscan_')) return task.verification.commands[0];
  if (tool === 'projscan_file' && task.files[0]) {
    return `projscan file "${escapeDoubleQuoted(task.files[0])}" --format json`;
  }
  const prefix = `projscan ${tool.slice('projscan_'.length).replace(/_/g, '-')}`;
  return task.verification.commands.find((command) => command.startsWith(prefix));
}

function dedupeActions(actions: PreflightSuggestedAction[]): PreflightSuggestedAction[] {
  const seen = new Set<string>();
  const out: PreflightSuggestedAction[] = [];
  for (const action of actions) {
    const key = `${action.label}:${action.command ?? ''}:${action.tool ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(action);
  }
  return out.slice(0, 12);
}
