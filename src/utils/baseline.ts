import fs from 'node:fs/promises';
import path from 'node:path';
import type { Baseline, DiffResult, Issue } from '../types.js';
import { calculateScore } from './scoreCalculator.js';

const DEFAULT_FILENAME = '.projscan-baseline.json';

export function baselineFromIssues(issues: Issue[]): Baseline {
  const { score, grade } = calculateScore(issues);
  return {
    score,
    grade,
    issues: issues.map((i) => ({ id: i.id, title: i.title, severity: i.severity })),
    timestamp: new Date().toISOString(),
  };
}

export async function saveBaseline(rootPath: string, issues: Issue[]): Promise<string> {
  const baseline = baselineFromIssues(issues);
  const filePath = path.join(rootPath, DEFAULT_FILENAME);
  await fs.writeFile(filePath, JSON.stringify(baseline, null, 2) + '\n', 'utf-8');
  return filePath;
}

export async function loadBaseline(filePath?: string, rootPath?: string): Promise<Baseline> {
  const resolvedPath = filePath ?? path.join(rootPath ?? process.cwd(), DEFAULT_FILENAME);
  const content = await fs.readFile(resolvedPath, 'utf-8');
  return JSON.parse(content) as Baseline;
}

export function computeDiff(before: Baseline, currentIssues: Issue[]): DiffResult {
  const after = baselineFromIssues(currentIssues);

  const beforeTitles = new Set(before.issues.map((i) => i.title));
  const afterTitles = new Set(after.issues.map((i) => i.title));

  const newIssues = after.issues
    .filter((i) => !beforeTitles.has(i.title))
    .map((i) => i.title);

  const resolvedIssues = before.issues
    .filter((i) => !afterTitles.has(i.title))
    .map((i) => i.title);

  return {
    before,
    after,
    scoreDelta: after.score - before.score,
    newIssues,
    resolvedIssues,
  };
}
