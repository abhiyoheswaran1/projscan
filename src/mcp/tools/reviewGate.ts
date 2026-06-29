import { computeReviewGate } from '../../core/reviewGate.js';
import { loadConfig } from '../../utils/config.js';
import type { McpTool } from './_shared.js';

export const reviewGateTool: McpTool = {
  name: 'projscan_review_gate',
  description:
    'Run the local Review Gate for reviewer readiness. Returns the Review Gate status, allow-review decision, proof debt, recontract guidance, required reviewers, next commands, PR-comment Markdown, and embedded Proof Broker evidence without executing proof commands.',
  inputSchema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        description: 'Plain-language change intent to contract before or during work.',
      },
      contract_path: {
        type: 'string',
        description: 'Optional local Proof Contract JSON path for review-gate validation.',
      },
      save_contract_path: {
        type: 'string',
        description: 'Optional local path to write the generated Proof Contract in intent mode.',
      },
      output_passport_path: {
        type: 'string',
        description: 'Optional local passport JSON path under .projscan/passport.json.',
      },
      output_path: {
        type: 'string',
        description: 'Optional local Review Gate JSON path under .projscan/review-gate.json.',
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
      max_tokens: {
        type: 'number',
        description: 'Cap the response to roughly this many tokens.',
      },
    },
  },
  handler: async (args, rootPath) => {
    const { config } = await loadConfig(rootPath);
    return {
      reviewGate: await computeReviewGate(rootPath, {
        intent: stringArg(args.intent),
        contractPath: stringArg(args.contract_path),
        saveContractPath: stringArg(args.save_contract_path),
        outputPassportPath: stringArg(args.output_passport_path),
        outputPath: stringArg(args.output_path),
        maxFiles: finiteNumberArg(args.max_files),
        feedbackPath: stringArg(args.feedback_path),
        baseRef: stringArg(args.base_ref),
        ledgerPath: stringArg(args.ledger_path),
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
