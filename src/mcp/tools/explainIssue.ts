import { scanRepository } from '../../core/repositoryScanner.js';
import { collectIssues } from '../../core/issueEngine.js';
import { explainIssue } from '../../core/explainIssue.js';
import type { McpTool } from './_shared.js';

export const explainIssueTool: McpTool = {
  name: 'projscan_explain_issue',
  description:
    'Deep-dive on a single open issue: severity, surrounding code excerpt, other issues touching the same file, similar fixes from git log (commit messages that mention this rule), and the structured fix-action prompt. Use when an agent needs more context than projscan_doctor gives - typically before applying a fix.',
  inputSchema: {
    type: 'object',
    properties: {
      issue_id: {
        type: 'string',
        description: 'Issue id from a previous projscan_doctor / projscan_analyze response.',
      },
    },
    required: ['issue_id'],
  },
  handler: async (args, rootPath) => {
    const issueId = typeof args.issue_id === 'string' ? args.issue_id : '';
    if (!issueId) throw new Error('issue_id is required');
    const scan = await scanRepository(rootPath);
    const issues = await collectIssues(rootPath, scan.files);
    const explanation = await explainIssue(rootPath, issues, issueId);
    if (!explanation) {
      return { matched: false, reason: `No open issue with id "${issueId}" in current doctor run.` };
    }
    return { matched: true, explanation };
  },
};
