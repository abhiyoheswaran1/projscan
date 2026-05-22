import { computeBugHunt } from './bugHunt.js';
import { computePreflight } from './preflight.js';
import { computeReleaseTrain } from './releaseTrain.js';
import type {
  BugHuntReport,
  PreflightReport,
  PreflightSuggestedAction,
  RegressionPlanLevel,
  RegressionPlanReport,
  RegressionPlanTarget,
  RegressionPlanVerdict,
  ReleaseTrainReport,
  WorkplanPriority,
} from '../types.js';

export interface ComputeRegressionPlanOptions {
  level?: RegressionPlanLevel;
  lines?: string[];
  maxTargets?: number;
}

const DEFAULT_MAX_TARGETS = 8;

export async function computeRegressionPlan(
  rootPath: string,
  options: ComputeRegressionPlanOptions = {},
): Promise<RegressionPlanReport> {
  const level = normalizeLevel(options.level);
  const maxTargets = normalizeMaxTargets(options.maxTargets);
  const [bugHunt, train, preflight] = await Promise.all([
    computeBugHunt(rootPath, { maxFindings: maxTargets }),
    computeReleaseTrain(rootPath, { lines: options.lines }),
    computePreflight(rootPath, { mode: 'before_commit' }),
  ]);
  const allTargets = rankTargets([
    ...baselineTargets(level),
    ...bugHuntTargets(bugHunt),
    ...preflightTargets(preflight),
    ...releaseLineTargets(train),
  ]);
  const targets = allTargets.slice(0, maxTargets);
  const verdict = regressionVerdict(preflight, bugHunt, targets);
  const commands = commandsForLevel(level, targets);

  return {
    schemaVersion: 1,
    level,
    verdict,
    summary: summarize(verdict, level, targets.length),
    releaseLines: train.plan.lines,
    evidence: {
      healthScore: bugHunt.health.score,
      bugHuntVerdict: bugHunt.verdict,
      preflightVerdict: preflight.verdict,
      changedFiles: preflight.evidence.changedFiles?.count ?? 0,
      touchedFiles: preflight.evidence.session?.totalTouchedFiles ?? preflight.evidence.session?.touchedFiles.length ?? 0,
    },
    targets,
    commands,
    suggestedNextActions: suggestedActions(targets),
    ...(allTargets.length > targets.length ? { truncated: true } : {}),
  };
}

function baselineTargets(level: RegressionPlanLevel): RegressionPlanTarget[] {
  return [
    {
      id: 'rp-baseline-health',
      priority: 'p0',
      source: 'baseline',
      title: 'Verify the health and safety baseline',
      why: 'Every product line needs a repeatable health gate before deeper regression work starts.',
      files: [],
      verification: {
        commands: ['projscan doctor --format json', 'projscan preflight --mode before_commit --format json'],
        expected: 'Doctor has no unresolved error-level issues and preflight does not block the handoff.',
      },
    },
    ...(level === 'full'
      ? [{
          id: 'rp-baseline-release',
          priority: 'p1' as const,
          source: 'baseline' as const,
          title: 'Run full package and stability gates',
          why: 'The larger product update should prove build output, stable public surfaces, and readiness checks in one pass.',
          files: ['package.json', 'docs/STABILITY.md', 'scripts/check-stability.mjs'],
          verification: {
            commands: ['npm run build', 'npm run lint', 'npm run check:stability', 'npm run release:check'],
            expected: 'Build, lint, stability guard, and release check all pass from the committed tree.',
          },
        }]
      : []),
  ];
}

function bugHuntTargets(bugHunt: BugHuntReport): RegressionPlanTarget[] {
  const first = bugHunt.fixQueue.find((finding) => finding.id !== 'bh-verify-clean');
  if (!first) return [];
  return [
    {
      id: 'rp-bug-hunt-top',
      priority: first.priority,
      source: 'bug-hunt',
      title: `Regression-cover bug-hunt target: ${first.title}`,
      why: first.why,
      files: first.files,
      verification: {
        commands: ['projscan bug-hunt --format json', ...first.verification.commands],
        expected: first.verification.expected,
      },
    },
  ];
}

function preflightTargets(preflight: PreflightReport): RegressionPlanTarget[] {
  return preflight.reasons.slice(0, 3).map((reason, index) => ({
    id: `rp-preflight-${index + 1}`,
    priority: severityPriority(reason.severity),
    source: 'preflight',
    title: `Exercise preflight signal: ${reason.source}`,
    why: reason.message,
    files: reason.file ? [reason.file] : [],
    verification: {
      commands: ['projscan preflight --mode before_commit --format json', commandForTool(reason.tool)],
      expected: 'The preflight signal is either gone or documented as accepted risk.',
    },
  }));
}

function releaseLineTargets(train: ReleaseTrainReport): RegressionPlanTarget[] {
  return train.tasks
    .filter((task) => task.track !== 'plan')
    .slice(0, 4)
    .map((task) => ({
      id: `rp-${task.id}`,
      priority: task.priority,
      source: 'product-line' as const,
      title: `Verify ${task.track}: ${task.title}`,
      why: task.why,
      files: task.files,
      verification: task.verification,
    }));
}

function commandsForLevel(level: RegressionPlanLevel, targets: RegressionPlanTarget[]): string[] {
  const smoke = ['projscan doctor --format json', 'projscan preflight --mode before_commit --format json'];
  if (level === 'smoke') return dedupeStrings(smoke);
  const focused = [
    ...smoke,
    'projscan bug-hunt --format json',
    ...targets.flatMap((target) => target.verification.commands),
    'npm test',
  ];
  if (level === 'focused') return dedupeStrings(focused);
  return dedupeStrings([
    ...focused,
    'npm run build',
    'npm run lint',
    'npm run check:stability',
    'npm run release:check',
  ]);
}

function regressionVerdict(
  preflight: PreflightReport,
  bugHunt: BugHuntReport,
  targets: RegressionPlanTarget[],
): RegressionPlanVerdict {
  if (preflight.verdict === 'block' || bugHunt.verdict === 'block') return 'blocked';
  if (preflight.verdict === 'caution' || bugHunt.verdict === 'fix' || targets.length > 1) return 'needs_tests';
  return 'ready';
}

function suggestedActions(targets: RegressionPlanTarget[]): PreflightSuggestedAction[] {
  return targets.slice(0, 8).map((target) => ({
    label: target.title,
    command: target.verification.commands[0],
  }));
}

function rankTargets(targets: RegressionPlanTarget[]): RegressionPlanTarget[] {
  const seen = new Set<string>();
  return targets
    .filter((target) => {
      if (seen.has(target.id)) return false;
      seen.add(target.id);
      return true;
    })
    .sort((a, b) => {
      const source = sourceRank(a.source) - sourceRank(b.source);
      if (source !== 0) return source;
      const priority = priorityRank(a.priority) - priorityRank(b.priority);
      if (priority !== 0) return priority;
      return a.id.localeCompare(b.id);
    });
}

function summarize(verdict: RegressionPlanVerdict, level: RegressionPlanLevel, targetCount: number): string {
  if (verdict === 'blocked') return `blocked: ${level} regression plan has ${targetCount} target(s) and p0 evidence`;
  if (verdict === 'needs_tests') return `needs_tests: run ${level} regression plan across ${targetCount} target(s)`;
  return `ready: ${level} regression baseline has no immediate extra targets`;
}

function severityPriority(severity: 'info' | 'warning' | 'error'): WorkplanPriority {
  if (severity === 'error') return 'p0';
  if (severity === 'warning') return 'p1';
  return 'p2';
}

function priorityRank(priority: WorkplanPriority): number {
  if (priority === 'p0') return 0;
  if (priority === 'p1') return 1;
  return 2;
}

function sourceRank(source: RegressionPlanTarget['source']): number {
  if (source === 'baseline') return 0;
  if (source === 'bug-hunt') return 1;
  if (source === 'preflight') return 2;
  return 3;
}

function commandForTool(tool: string | undefined): string {
  if (tool === 'projscan_review') return 'projscan review --format json';
  if (tool === 'projscan_taint') return 'projscan taint --format json';
  if (tool === 'projscan_hotspots') return 'projscan hotspots --format json';
  if (tool === 'projscan_plugin') return 'projscan plugin list --format json';
  if (tool === 'projscan_preflight') return 'projscan preflight --mode before_commit --format json';
  return 'projscan doctor --format json';
}

function normalizeLevel(value: RegressionPlanLevel | undefined): RegressionPlanLevel {
  if (value === 'smoke' || value === 'focused' || value === 'full') return value;
  return 'focused';
}

function normalizeMaxTargets(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MAX_TARGETS;
  return Math.max(1, Math.min(25, Math.floor(value)));
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
