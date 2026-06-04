import { pluginsEnabled } from '../../core/plugins.js';
import { computeWorkplan, isWorkplanMode } from '../../core/workplan.js';
import type { WorkplanMode } from '../../types.js';
import type { McpTool } from './_shared.js';

const WORKPLAN_MODES: readonly WorkplanMode[] = [
  'before_edit',
  'before_commit',
  'before_merge',
  'refactor',
  'release',
  'bug_hunt',
  'hardening',
];

export const workplanTool: McpTool = {
  name: 'projscan_workplan',
  description:
    'Compose preflight, review, session, hotspot, plugin, and supply-chain signals into an ordered agent execution plan with evidence, suggested tools, verification commands, and handoff text.',
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: WORKPLAN_MODES,
        description:
          'Planning mode. before_edit/before_commit/before_merge mirror preflight gates; refactor, release, bug_hunt, and hardening add mode-specific task recipes. Default: before_edit.',
      },
      base_ref: {
        type: 'string',
        description: 'Optional git base ref for commit/merge/release checks.',
      },
      head_ref: {
        type: 'string',
        description: 'Optional git head ref for merge/release checks.',
      },
      max_changed_files: {
        type: 'number',
        description: 'Optional caution threshold for changed-file count. Default: 50.',
      },
      max_tasks: {
        type: 'number',
        description: 'Maximum number of workplan tasks to return. Default: 8, max: 20.',
      },
      enable_plugins: {
        type: 'boolean',
        description:
          'Request local analyzer plugin evidence only when this MCP server process already has PROJSCAN_PLUGINS_PREVIEW=1. This argument never enables plugin execution by itself.',
      },
      max_tokens: {
        type: 'number',
        description: 'Cap the response to roughly this many tokens.',
      },
    },
  },
  handler: async (args, rootPath) => {
    return {
      workplan: await computeWorkplan(rootPath, {
        mode: readMode(args.mode),
        baseRef: typeof args.base_ref === 'string' ? args.base_ref : undefined,
        headRef: typeof args.head_ref === 'string' ? args.head_ref : undefined,
        maxChangedFiles:
          typeof args.max_changed_files === 'number' && Number.isFinite(args.max_changed_files)
            ? args.max_changed_files
            : undefined,
        maxTasks:
          typeof args.max_tasks === 'number' && Number.isFinite(args.max_tasks)
            ? args.max_tasks
            : undefined,
        enablePlugins: args.enable_plugins === true && pluginsEnabled(),
      }),
    };
  },
};

function readMode(value: unknown): WorkplanMode {
  if (typeof value === 'string' && isWorkplanMode(value)) return value;
  return 'before_edit';
}
