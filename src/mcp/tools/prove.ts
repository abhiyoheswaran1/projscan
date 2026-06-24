import { computeProve } from '../../core/prove.js';
import type { McpTool } from './_shared.js';

export const proveTool: McpTool = {
  name: 'projscan_prove',
  description:
    'Create, record, or replay a local Proof Contract for a change. Returns allowed files, forbidden files, proof commands, ledger evidence, scope drift, and a reviewer-ready Proof Receipt.',
  inputSchema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        description: 'Plain-language change intent to constrain before editing.',
      },
      changed: {
        type: 'boolean',
        description: 'Validate the current working tree against a Proof Contract.',
      },
      contract_path: {
        type: 'string',
        description: 'Optional local proof contract path for changed-mode validation.',
      },
      save_contract_path: {
        type: 'string',
        description: 'Optional local path to write the generated Proof Contract in intent mode.',
      },
      max_files: {
        type: 'number',
        description: 'Maximum likely touched files to include. Default: 5, max: 25.',
      },
      feedback_path: {
        type: 'string',
        description: 'Optional local feedback artifact path to apply as trust memory.',
      },
      base_ref: {
        type: 'string',
        description: 'Optional git base ref for changed-file detection.',
      },
      ledger_path: {
        type: 'string',
        description: 'Optional local Proof Ledger JSONL path.',
      },
      record_command: {
        type: 'string',
        description: 'Record this proof command outcome without executing it.',
      },
      exit_code: {
        type: 'number',
        description: 'Exit code for record_command.',
      },
      duration_ms: {
        type: 'number',
        description: 'Duration in milliseconds for record_command.',
      },
      summary: {
        type: 'string',
        description: 'Safe redacted proof output summary for record_command.',
      },
      log_path: {
        type: 'string',
        description: 'Optional redacted proof log path for record_command.',
      },
      max_tokens: {
        type: 'number',
        description: 'Cap the response to roughly this many tokens.',
      },
    },
  },
  handler: async (args, rootPath) => ({
    prove: await computeProve(rootPath, {
      intent: stringArg(args.intent),
      changed: args.changed === true,
      contractPath: stringArg(args.contract_path),
      saveContractPath: stringArg(args.save_contract_path),
      maxFiles: finiteNumberArg(args.max_files),
      feedbackPath: stringArg(args.feedback_path),
      baseRef: stringArg(args.base_ref),
      ledgerPath: stringArg(args.ledger_path),
      recordCommand: stringArg(args.record_command),
      exitCode: integerArg(args.exit_code),
      durationMs: finiteNumberArg(args.duration_ms),
      summary: stringArg(args.summary),
      logPath: stringArg(args.log_path),
    }),
  }),
};

function stringArg(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function finiteNumberArg(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function integerArg(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}
