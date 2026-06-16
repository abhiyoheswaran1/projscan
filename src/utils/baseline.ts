import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  Baseline,
  BaselineHotspot,
  DiffResult,
  HotspotDelta,
  HotspotDiffSummary,
  HotspotReport,
  BaselineTrend,
  Issue,
} from '../types.js';
import { calculateScore } from './scoreCalculator.js';

const DEFAULT_FILENAME = '.projscan-baseline.json';
const HOTSPOT_SNAPSHOT_LIMIT = 20;

export function baselineFromIssues(issues: Issue[], hotspotReport?: HotspotReport): Baseline {
  const { score, grade } = calculateScore(issues);
  const hotspots: BaselineHotspot[] | undefined =
    hotspotReport && hotspotReport.available
      ? hotspotReport.hotspots.slice(0, HOTSPOT_SNAPSHOT_LIMIT).map((h) => ({
          relativePath: h.relativePath,
          riskScore: h.riskScore,
          churn: h.churn,
        }))
      : undefined;

  return {
    score,
    grade,
    issues: issues.map((i) => ({ id: i.id, title: i.title, severity: i.severity })),
    hotspots,
    issueRuleCounts: countIssuesById(issues),
    timestamp: new Date().toISOString(),
  };
}

export async function saveBaseline(
  rootPath: string,
  issues: Issue[],
  hotspotReport?: HotspotReport,
): Promise<string> {
  const baseline = baselineFromIssues(issues, hotspotReport);
  const filePath = path.join(rootPath, DEFAULT_FILENAME);
  await fs.writeFile(filePath, JSON.stringify(baseline, null, 2) + '\n', 'utf-8');
  return filePath;
}

export async function loadBaseline(filePath?: string, rootPath?: string): Promise<Baseline> {
  const resolvedPath = filePath ?? path.join(rootPath ?? process.cwd(), DEFAULT_FILENAME);
  const content = await fs.readFile(resolvedPath, 'utf-8');
  return JSON.parse(content) as Baseline;
}

export function computeDiff(
  before: Baseline,
  currentIssues: Issue[],
  currentHotspots?: HotspotReport,
): DiffResult {
  const after = baselineFromIssues(currentIssues, currentHotspots);

  const beforeTitles = new Set(before.issues.map((i) => i.title));
  const afterTitles = new Set(after.issues.map((i) => i.title));

  const newIssues = after.issues.filter((i) => !beforeTitles.has(i.title)).map((i) => i.title);

  const resolvedIssues = before.issues.filter((i) => !afterTitles.has(i.title)).map((i) => i.title);

  const hotspotDiff =
    before.hotspots && after.hotspots ? diffHotspots(before.hotspots, after.hotspots) : undefined;

  const scoreDelta = after.score - before.score;
  return {
    before,
    after,
    scoreDelta,
    newIssues,
    resolvedIssues,
    hotspotDiff,
    trend: buildTrend(scoreDelta, before, after, hotspotDiff, newIssues, resolvedIssues),
  };
}

function diffHotspots(before: BaselineHotspot[], after: BaselineHotspot[]): HotspotDiffSummary {
  const beforeMap = new Map(before.map((h) => [h.relativePath, h]));
  const afterMap = new Map(after.map((h) => [h.relativePath, h]));

  const rose: HotspotDelta[] = [];
  const fell: HotspotDelta[] = [];
  const appeared: HotspotDelta[] = [];
  const resolved: HotspotDelta[] = [];

  for (const [path, afterEntry] of afterMap) {
    const beforeEntry = beforeMap.get(path);
    if (!beforeEntry) {
      appeared.push({
        relativePath: path,
        beforeScore: null,
        afterScore: afterEntry.riskScore,
        scoreDelta: afterEntry.riskScore,
      });
      continue;
    }
    const delta = round1(afterEntry.riskScore - beforeEntry.riskScore);
    if (delta > 0) {
      rose.push({
        relativePath: path,
        beforeScore: beforeEntry.riskScore,
        afterScore: afterEntry.riskScore,
        scoreDelta: delta,
      });
    } else if (delta < 0) {
      fell.push({
        relativePath: path,
        beforeScore: beforeEntry.riskScore,
        afterScore: afterEntry.riskScore,
        scoreDelta: delta,
      });
    }
  }

  for (const [path, beforeEntry] of beforeMap) {
    if (!afterMap.has(path)) {
      resolved.push({
        relativePath: path,
        beforeScore: beforeEntry.riskScore,
        afterScore: null,
        scoreDelta: round1(-beforeEntry.riskScore),
      });
    }
  }

  rose.sort((a, b) => b.scoreDelta - a.scoreDelta);
  fell.sort((a, b) => a.scoreDelta - b.scoreDelta);
  appeared.sort((a, b) => (b.afterScore ?? 0) - (a.afterScore ?? 0));
  resolved.sort((a, b) => (b.beforeScore ?? 0) - (a.beforeScore ?? 0));

  return { rose, fell, appeared, resolved };
}

function buildTrend(
  scoreDelta: number,
  before: Baseline,
  after: Baseline,
  hotspotDiff: HotspotDiffSummary | undefined,
  newIssues: string[],
  resolvedIssues: string[],
): BaselineTrend {
  const roundedDelta = round1(scoreDelta);
  const riskDelta = round1(-scoreDelta);
  const recurringNoisyRules = recurringRules(
    before.issueRuleCounts ?? countBaselineIssuesById(before),
    after.issueRuleCounts ?? countBaselineIssuesById(after),
  );
  const newHotspots = (hotspotDiff?.appeared ?? []).map((entry) => entry.relativePath).slice(0, 5);
  const scoreDirection = roundedDelta > 0 ? 'up' : roundedDelta < 0 ? 'down' : 'flat';
  const riskDirection = riskDelta > 0 ? 'up' : riskDelta < 0 ? 'down' : 'flat';
  const changedSinceBaseline = buildChangedSinceBaseline(
    newIssues,
    resolvedIssues,
    newHotspots,
    recurringNoisyRules,
  );
  const summary = [
    `score ${scoreDirection}${roundedDelta === 0 ? '' : ` ${roundedDelta > 0 ? '+' : ''}${roundedDelta}`}`,
    `risk ${riskDirection}${riskDelta === 0 ? '' : ` ${riskDelta > 0 ? '+' : ''}${riskDelta}`}`,
    newHotspots.length > 0 ? `${newHotspots.length} new hotspot(s)` : 'no new hotspots',
    recurringNoisyRules.length > 0
      ? `${recurringNoisyRules.length} recurring noisy rule(s)`
      : 'no recurring noisy rules',
  ].join('; ');
  return {
    scoreDirection,
    scoreDelta: roundedDelta,
    riskDirection,
    riskDelta,
    qualityScoreBefore: before.score,
    qualityScoreAfter: after.score,
    newIssueCount: newIssues.length,
    resolvedIssueCount: resolvedIssues.length,
    changedSinceBaseline,
    newHotspots,
    recurringNoisyRules,
    summary,
  };
}

function buildChangedSinceBaseline(
  newIssues: string[],
  resolvedIssues: string[],
  newHotspots: string[],
  recurringNoisyRules: BaselineTrend['recurringNoisyRules'],
): string[] {
  const changes: string[] = [];
  changes.push(
    newIssues.length > 0
      ? `${newIssues.length} new issue(s): ${newIssues.slice(0, 3).join('; ')}`
      : '0 new issues',
  );
  changes.push(
    resolvedIssues.length > 0
      ? `${resolvedIssues.length} resolved issue(s): ${resolvedIssues.slice(0, 3).join('; ')}`
      : '0 resolved issues',
  );
  changes.push(
    newHotspots.length > 0 ? `new hotspot(s): ${newHotspots.join(', ')}` : 'no new hotspots',
  );
  if (recurringNoisyRules.length > 0) {
    changes.push(
      `recurring noisy rule(s): ${recurringNoisyRules.map((rule) => `${rule.id} ${rule.before}->${rule.after}`).join(', ')}`,
    );
  }
  return changes.slice(0, 5);
}

function countIssuesById(issues: Issue[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const issue of issues) counts[issue.id] = (counts[issue.id] ?? 0) + 1;
  return counts;
}

function countBaselineIssuesById(baseline: Baseline): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const issue of baseline.issues) counts[issue.id] = (counts[issue.id] ?? 0) + 1;
  return counts;
}

function recurringRules(
  before: Record<string, number>,
  after: Record<string, number>,
): BaselineTrend['recurringNoisyRules'] {
  return Object.keys(before)
    .filter((id) => before[id] > 0 && (after[id] ?? 0) > 0)
    .map((id) => ({ id, before: before[id], after: after[id] ?? 0 }))
    .sort((a, b) => b.after - a.after || b.before - a.before || a.id.localeCompare(b.id))
    .slice(0, 5);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
