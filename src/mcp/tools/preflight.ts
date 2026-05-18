import { computePreflight } from '../../core/preflight.js';
import type { PreflightMode } from '../../types.js';
import type { McpTool } from './_shared.js';

const PREFLIGHT_MODES: readonly PreflightMode[] = [
  'before_edit',
  'before_commit',
  'before_merge',
];

export const preflightTool: McpTool = {
  name: 'projscan_preflight',
  description:
    'Answer whether an agent can safely proceed before edits, commit, or merge. Returns proceed, caution, or block with evidence and suggested next tool calls.',
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: PREFLIGHT_MODES,
        description: 'before_edit, before_commit, or before_merge. Default: before_edit.',
      },
      base_ref: {
        type: 'string',
        description: 'Optional git base ref for before_commit/before_merge checks.',
      },
      head_ref: {
        type: 'string',
        description: 'Optional git head ref for before_merge review checks.',
      },
      max_changed_files: {
        type: 'number',
        description: 'Optional caution threshold for changed-file count. Default: 50.',
      },
    },
  },
  handler: async (args, rootPath) => {
    return {
      report: await computePreflight(rootPath, {
        mode: readMode(args.mode),
        baseRef: typeof args.base_ref === 'string' ? args.base_ref : undefined,
        headRef: typeof args.head_ref === 'string' ? args.head_ref : undefined,
        maxChangedFiles:
          typeof args.max_changed_files === 'number' && Number.isFinite(args.max_changed_files)
            ? args.max_changed_files
            : undefined,
      }),
    };
  },
};

function readMode(value: unknown): PreflightMode {
  if (typeof value === 'string' && (PREFLIGHT_MODES as readonly string[]).includes(value)) {
    return value as PreflightMode;
  }
  return 'before_edit';
}
