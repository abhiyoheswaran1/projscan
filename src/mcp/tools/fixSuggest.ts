import { scanRepository } from '../../core/repositoryScanner.js';
import { collectIssues } from '../../core/issueEngine.js';
import { findIssue, suggestFixForIssue, syntheticIssue } from '../../core/fixSuggest.js';
import {
  computeRuleConfidence,
  computeRuleConfidenceScore,
  loadMemory,
  type RuleConfidence,
} from '../../core/memory.js';
import type { McpTool } from './_shared.js';

/**
 * 1.7+ — Build a confidence sidecar from Project Memory's per-rule
 * fix-rate. Returned alongside every fix suggestion so the agent can
 * deprioritize rules the user has historically ignored. Best-effort —
 * if memory is missing or unreadable, returns "medium".
 */
async function attachConfidence(
  rootPath: string,
  ruleId: string,
): Promise<{
  level: RuleConfidence;
  score: number;
}> {
  try {
    const memory = await loadMemory(rootPath);
    return {
      level: computeRuleConfidence(memory, ruleId),
      score: computeRuleConfidenceScore(memory, ruleId),
    };
  } catch {
    return { level: 'medium', score: 0.5 };
  }
}

export const fixSuggestTool: McpTool = {
  name: 'projscan_fix_suggest',
  description:
    'Given an issue id (from projscan_doctor / projscan_analyze) OR a file + rule pair, return a structured action prompt: headline, why it matters, where to change, one-paragraph instruction the agent can execute, optional suggested test. Rule-driven; no LLM inside projscan. Use this to close the diagnose -> fix loop.',
  inputSchema: {
    type: 'object',
    properties: {
      issue_id: {
        type: 'string',
        description: 'Issue id from a previous projscan_doctor / projscan_analyze response.',
      },
      file: {
        type: 'string',
        description:
          'File path (repo-relative). Required when no `issue_id` is given - combined with `rule` to synthesize a fix request.',
      },
      rule: {
        type: 'string',
        description:
          'Rule / issue-id prefix (e.g. "unused-dependency", "cycle-detected"). Required when no `issue_id` is given.',
      },
      severity: {
        type: 'string',
        enum: ['info', 'warning', 'error'],
        description:
          'Optional. When synthesizing via file+rule, sets the severity for the suggestion. Default: warning.',
      },
    },
  },
  handler: async (args, rootPath) => {
    const issueId = typeof args.issue_id === 'string' ? args.issue_id : null;
    const file = typeof args.file === 'string' ? args.file : null;
    const rule = typeof args.rule === 'string' ? args.rule : null;
    const severity =
      args.severity === 'info' || args.severity === 'warning' || args.severity === 'error'
        ? args.severity
        : 'warning';

    if (issueId) {
      const scan = await scanRepository(rootPath);
      const issues = await collectIssues(rootPath, scan.files);
      const found = findIssue(issues, issueId);
      if (!found) {
        return {
          matched: false,
          reason: `No open issue with id "${issueId}" in current doctor run.`,
        };
      }
      const fix = await suggestFixForIssue(found, rootPath);
      const confidence = await attachConfidence(rootPath, found.id);
      return { matched: true, fix, confidence };
    }

    if (file && rule) {
      const synthetic = syntheticIssue(rule, file, severity);
      const fix = await suggestFixForIssue(synthetic, rootPath);
      const confidence = await attachConfidence(rootPath, synthetic.id);
      return { matched: true, fix, synthetic: true, confidence };
    }

    return {
      matched: false,
      reason: 'Provide either `issue_id` or both `file` and `rule`.',
    };
  },
};
