import { scanRepository } from '../../core/repositoryScanner.js';
import { collectIssues } from '../../core/issueEngine.js';
import { calculateScore } from '../../utils/scoreCalculator.js';
import { PACKAGE_ARG_SCHEMA, resolvePackageFilter, type McpTool } from './_shared.js';
import type { Issue } from '../../types.js';

export const doctorTool: McpTool = {
  name: 'projscan_doctor',
  description:
    'Run a health check on the project. Returns a 0-100 score, letter grade, and the list of issues (linting, formatting, tests, security, architecture). Pass `max_cost_tokens` (1.5+) for adaptive shaping: <3000 returns verdict-only (score + counts), <7000 returns a summary (top issues), otherwise full.',
  inputSchema: {
    type: 'object',
    properties: {
      package: PACKAGE_ARG_SCHEMA,
      max_cost_tokens: {
        type: 'number',
        description:
          '1.5+ — adaptive shape budget. <3000 returns verdict-only (score + grade + per-severity counts); <7000 returns a summary (top-5 issues by severity, no descriptions); otherwise the full issue list. Different from `max_tokens` (post-hoc truncation): the tool reshapes BEFORE serializing.',
      },
    },
  },
  handler: async (args, rootPath) => {
    const scan = await scanRepository(rootPath);
    let issues = await collectIssues(rootPath, scan.files);
    const passes = await resolvePackageFilter(rootPath, args);
    if (passes) {
      issues = issues.filter((i) => {
        const locs = i.locations ?? [];
        if (locs.length === 0) return false;
        return locs.some((l) => l.file && passes(l.file));
      });
    }
    const health = calculateScore(issues);

    // 1.5+ — adaptive shape based on max_cost_tokens. With no budget,
    // returns the full report unchanged (preserves 1.4-and-earlier
    // shape; no `tier` field). With a budget, picks a tier and shapes
    // — `tier` is surfaced and lifted into _cost.tier by the dispatcher.
    const maxCostTokens =
      typeof args.max_cost_tokens === 'number' && Number.isFinite(args.max_cost_tokens)
        ? args.max_cost_tokens
        : undefined;
    if (maxCostTokens === undefined) return { health, issues };
    return shapeDoctorForBudget(health, issues, maxCostTokens);
  },
};

type DoctorTier = 'full' | 'summary' | 'verdict-only';

function selectDoctorTier(maxCostTokens: number): DoctorTier {
  if (!Number.isFinite(maxCostTokens) || maxCostTokens <= 0) return 'full';
  if (maxCostTokens < 3000) return 'verdict-only';
  if (maxCostTokens < 7000) return 'summary';
  return 'full';
}

function shapeDoctorForBudget(
  health: ReturnType<typeof calculateScore>,
  issues: Issue[],
  maxCostTokens: number,
): Record<string, unknown> {
  const tier = selectDoctorTier(maxCostTokens);
  const counts = countBySeverityAndCategory(issues);

  if (tier === 'verdict-only') {
    return { health, counts, tier };
  }
  if (tier === 'summary') {
    // Top 5 of each severity, with the heavy `description` and
    // `locations` fields stripped.
    const top = (sev: 'error' | 'warning' | 'info'): Array<Pick<Issue, 'id' | 'title' | 'severity' | 'category'>> =>
      issues
        .filter((i) => i.severity === sev)
        .slice(0, 5)
        .map((i) => ({ id: i.id, title: i.title, severity: i.severity, category: i.category }));
    return {
      health,
      counts,
      topIssues: {
        error: top('error'),
        warning: top('warning'),
        info: top('info'),
      },
      tier,
    };
  }
  return { health, issues, counts, tier };
}

function countBySeverityAndCategory(issues: Issue[]): {
  bySeverity: { error: number; warning: number; info: number };
  byCategory: Record<string, number>;
} {
  const bySeverity = { error: 0, warning: 0, info: 0 };
  const byCategory: Record<string, number> = {};
  for (const i of issues) {
    if (i.severity === 'error') bySeverity.error += 1;
    else if (i.severity === 'warning') bySeverity.warning += 1;
    else if (i.severity === 'info') bySeverity.info += 1;
    const cat = i.category ?? 'other';
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
  }
  return { bySeverity, byCategory };
}
