import { computePassport } from '../../core/passport.js';
import { loadConfig } from '../../utils/config.js';
import type { McpTool } from './_shared.js';

export const passportTool: McpTool = {
  name: 'projscan_passport',
  description:
    'Create a local Agent Change Passport for reviewer handoff. Returns Proof Contract boundary, changed-file scope, proof replay, proof sufficiency, reviewer action, next commands, and optional Baseframe assessment paths without executing proof commands.',
  inputSchema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        description: 'Plain-language change intent to contract before or during work.',
      },
      contract_path: {
        type: 'string',
        description: 'Optional local Proof Contract JSON path for receipt validation.',
      },
      save_contract_path: {
        type: 'string',
        description: 'Optional local path to write the generated Proof Contract in intent mode.',
      },
      output_path: {
        type: 'string',
        description: 'Optional local passport JSON path under .projscan/passport.json or .projscan/passports/.',
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
      task_id: {
        type: 'string',
        description: 'Optional Baseframe task ID when emit_baseframe is true.',
      },
      emit_baseframe: {
        type: 'boolean',
        description: 'Write the Baseframe ProjScan assessment artifact for this task.',
      },
      max_tokens: {
        type: 'number',
        description: 'Cap the response to roughly this many tokens.',
      },
    },
  },
  handler: async (args, rootPath) => {
    const { config } = await loadConfig(rootPath);
    return {
      passport: await computePassport(rootPath, {
        intent: stringArg(args.intent),
        contractPath: stringArg(args.contract_path),
        saveContractPath: stringArg(args.save_contract_path),
        outputPath: stringArg(args.output_path),
        maxFiles: finiteNumberArg(args.max_files),
        feedbackPath: stringArg(args.feedback_path),
        baseRef: stringArg(args.base_ref),
        ledgerPath: stringArg(args.ledger_path),
        taskId: stringArg(args.task_id),
        emitBaseframe: args.emit_baseframe === true,
        proofRecipes: config.proofRecipes,
      }),
    };
  },
};

function stringArg(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function finiteNumberArg(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
