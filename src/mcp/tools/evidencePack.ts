import { computeEvidencePack } from '../../core/releaseEvidence.js';
import type { McpTool } from './_shared.js';

export const evidencePackTool: McpTool = {
  name: 'projscan_evidence_pack',
  description:
    'Assemble one release approval packet from release-train, bug-hunt, workplan, and preflight evidence. Never bumps versions, creates tags, or publishes.',
  inputSchema: {
    type: 'object',
    properties: {
      lines: {
        type: 'array',
        items: { type: 'string' },
        description: 'Release lines to include. Default: next four minor lines.',
      },
      website_prompt: {
        type: 'boolean',
        description: 'Include website-update prompt text in the response.',
      },
      max_findings: {
        type: 'number',
        description: 'Maximum bug-hunt findings to include. Default: 10, max: 25.',
      },
      max_tokens: {
        type: 'number',
        description: 'Cap the response to roughly this many tokens.',
      },
    },
  },
  handler: async (args, rootPath) => ({
    evidencePack: await computeEvidencePack(rootPath, {
      lines: Array.isArray(args.lines)
        ? args.lines.filter((line): line is string => typeof line === 'string')
        : undefined,
      includeWebsitePrompt: args.website_prompt === true,
      maxFindings:
        typeof args.max_findings === 'number' && Number.isFinite(args.max_findings)
          ? args.max_findings
          : undefined,
    }),
  }),
};
