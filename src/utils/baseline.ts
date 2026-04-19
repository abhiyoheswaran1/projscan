import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  Baseline,
  BaselineHotspot,
  DiffResult,
  HotspotDelta,
  HotspotDiffSummary,
  HotspotReport,
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

  const newIssues = after.issues
    .filter((i) => !beforeTitles.has(i.title))
    .map((i) => i.title);

  const resolvedIssues = before.issues
    .filter((i) => !afterTitles.has(i.title))
    .map((i) => i.title);

  const hotspotDiff =
    before.hotspots && after.hotspots ? diffHotspots(before.hotspots, after.hotspots) : undefined;

  return {
    before,
    after,
    scoreDelta: after.score - before.score,
    newIssues,
    resolvedIssues,
    hotspotDiff,
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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
