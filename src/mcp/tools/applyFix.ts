import { scanRepository } from '../../core/repositoryScanner.js';
import { collectIssues } from '../../core/issueEngine.js';
import { findIssue, buildApplyPlanForIssue } from '../../core/fixSuggest.js';
import { executePlan, rollback } from '../../core/applyFix.js';
import type { McpTool } from './_shared.js';

/**
 * `projscan_apply_fix` (1.6+) — closes the suggest-and-apply loop for
 * the small set of issue ids whose templates declare apply support.
 *
 * Default is dry-run: returns the would-change list without writing.
 * Pass `confirm: true` to actually mutate disk. Every applied change
 * gets a rollback record under `.projscan-cache/rollbacks/<id>.json`
 * that can be reversed with `action: "rollback", rollback_id: ...`.
 *
 * Mechanical templates only — no codemods, no semantic rename, no
 * inference. If a template doesn't declare apply support, this tool
 * returns `applicable: false` and points at `projscan_fix_suggest`
 * instead.
 */
export const applyFixTool: McpTool = {
  name: 'projscan_apply_fix',
  description:
    "Apply a mechanical fix for an open issue (1.6+). Default is dry-run; pass confirm:true to write. Every applied change records a rollback id usable via action:'rollback'. Mechanical templates only — semantic rewrites and codemods stay agent-driven.",
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['apply', 'rollback'],
        description:
          'Default "apply". Pass "rollback" with `rollback_id` to reverse a previous apply.',
      },
      issue_id: {
        type: 'string',
        description:
          '"apply" only — the issue id to fix (from projscan_doctor / projscan_analyze). Required for action:"apply".',
      },
      confirm: {
        type: 'boolean',
        description:
          '"apply" only — when true, write to disk. When false (default), return the would-change list without writing (dry-run).',
      },
      rollback_id: {
        type: 'string',
        description: '"rollback" only — the id from a prior apply\'s ApplyResult.',
      },
    },
  },
  handler: async (args, rootPath) => {
    const action = typeof args.action === 'string' ? args.action : 'apply';

    if (action === 'rollback') {
      const rollbackId = typeof args.rollback_id === 'string' ? args.rollback_id : '';
      if (!rollbackId) {
        throw new Error(
          "rollback action requires `rollback_id` (from a previous apply's ApplyResult).",
        );
      }
      return await rollback(rootPath, rollbackId);
    }

    if (action !== 'apply') {
      throw new Error(`Unknown action "${action}". Valid: apply, rollback.`);
    }

    const issueId = typeof args.issue_id === 'string' ? args.issue_id : '';
    if (!issueId) {
      throw new Error(
        'apply action requires `issue_id`. Get one from projscan_doctor or projscan_analyze (each issue has an `id` field).',
      );
    }
    const confirm = args.confirm === true;

    // Resolve the issue from a fresh doctor run so we always operate
    // against the current project state.
    const scan = await scanRepository(rootPath);
    const issues = await collectIssues(rootPath, scan.files);
    const issue = findIssue(issues, issueId);
    if (!issue) {
      return {
        ok: false,
        applicable: false,
        reason: `No open issue with id "${issueId}" in the current doctor run. The issue may have been resolved or the id may be stale.`,
      };
    }

    const plan = await buildApplyPlanForIssue(issue, rootPath);
    if (!plan) {
      return {
        ok: false,
        applicable: false,
        reason: `Issue "${issueId}" matched a template but that template does not declare apply support. Use projscan_fix_suggest for the structured guidance instead.`,
        suggestion: 'projscan_fix_suggest',
      };
    }

    const result = await executePlan(rootPath, plan, { dryRun: !confirm });
    return {
      ...result,
      applicable: true,
      issueId,
      summary: plan.summary,
    };
  },
};
