import { runAudit } from '../../core/auditRunner.js';
import { paginate, listChecksum, readPageParams } from '../pagination.js';
import { emitProgress } from '../progress.js';
import type { McpTool } from './_shared.js';

export const auditTool: McpTool = {
  name: 'projscan_audit',
  description:
    'Run `npm audit` and return a normalized summary of vulnerabilities (critical / high / moderate / low / info). Requires package-lock.json. Supports cursor pagination on the findings array.',
  inputSchema: {
    type: 'object',
    properties: {
      cursor: { type: 'string', description: 'Opaque cursor from a previous response.' },
      page_size: { type: 'number', description: 'Items per page (default 50).' },
      max_tokens: { type: 'number', description: 'Cap response size.' },
    },
  },
  handler: async (args, rootPath) => {
    emitProgress(0, 2, 'running npm audit');
    const report = await runAudit(rootPath);
    if (!report.available) return report;
    emitProgress(1, 2, 'normalizing findings');
    const page = paginate(report.findings, readPageParams(args), listChecksum(report.findings));
    emitProgress(2, 2, 'done');
    return {
      available: true,
      summary: report.summary,
      findings: page.items,
      total: page.total,
      nextCursor: page.nextCursor,
    };
  },
};
