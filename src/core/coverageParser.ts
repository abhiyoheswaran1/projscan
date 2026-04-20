import fs from 'node:fs/promises';
import path from 'node:path';
import type { CoverageReport, FileCoverage, CoverageSource } from '../types.js';

const CANDIDATES: Array<{ path: string; source: CoverageSource }> = [
  { path: 'coverage/lcov.info', source: 'lcov' },
  { path: 'coverage/coverage-final.json', source: 'coverage-final' },
  { path: 'coverage/coverage-summary.json', source: 'coverage-summary' },
];

/**
 * Detect and parse whatever coverage file the project has. Supports the three
 * common formats produced by Istanbul/c8/Vitest/Jest:
 *   - lcov.info (line-oriented LCOV)
 *   - coverage-final.json (Istanbul per-file detail)
 *   - coverage-summary.json (Istanbul per-file summary)
 *
 * Returns per-file line coverage, normalized to relative posix paths.
 */
export async function parseCoverage(rootPath: string): Promise<CoverageReport> {
  for (const candidate of CANDIDATES) {
    const full = path.join(rootPath, candidate.path);
    let raw: string;
    try {
      raw = await fs.readFile(full, 'utf-8');
    } catch {
      continue;
    }

    try {
      const files = parseByFormat(raw, candidate.source, rootPath);
      const totalCoverage = computeTotal(files);
      return {
        available: true,
        source: candidate.source,
        sourceFile: candidate.path,
        totalCoverage,
        files,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        available: false,
        reason: `Failed to parse ${candidate.path}: ${msg}`,
        source: candidate.source,
        sourceFile: candidate.path,
        totalCoverage: 0,
        files: [],
      };
    }
  }

  return {
    available: false,
    reason: 'No coverage file found. Expected one of: coverage/lcov.info, coverage/coverage-final.json, coverage/coverage-summary.json',
    source: null,
    sourceFile: null,
    totalCoverage: 0,
    files: [],
  };
}

function parseByFormat(raw: string, source: CoverageSource, rootPath: string): FileCoverage[] {
  if (source === 'lcov') return parseLcov(raw, rootPath);
  if (source === 'coverage-final') return parseCoverageFinal(raw, rootPath);
  return parseCoverageSummary(raw, rootPath);
}

/**
 * LCOV — record-oriented plain text:
 *   SF:/abs/path/to/file.ts
 *   LF:100         (lines found)
 *   LH:85          (lines hit)
 *   end_of_record
 */
function parseLcov(raw: string, rootPath: string): FileCoverage[] {
  const files: FileCoverage[] = [];
  let currentFile: string | null = null;
  let linesFound = 0;
  let linesHit = 0;

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('SF:')) {
      currentFile = trimmed.slice(3);
      linesFound = 0;
      linesHit = 0;
    } else if (trimmed.startsWith('LF:')) {
      linesFound = parseInt(trimmed.slice(3), 10) || 0;
    } else if (trimmed.startsWith('LH:')) {
      linesHit = parseInt(trimmed.slice(3), 10) || 0;
    } else if (trimmed === 'end_of_record') {
      if (currentFile) {
        const relativePath = toRelativePosix(currentFile, rootPath);
        files.push({
          relativePath,
          linesFound,
          linesHit,
          lineCoverage: linesFound > 0 ? (linesHit / linesFound) * 100 : 0,
        });
      }
      currentFile = null;
    }
  }

  return files;
}

/**
 * coverage-final.json — Istanbul per-file detail:
 *   { "/abs/path/file.ts": { "path": "...", "statementMap": {...}, "s": { "0": 1, "1": 0 }, ... } }
 * We approximate line coverage from statement counts (statements is the closest
 * thing to "line" when line-level data isn't separately broken out).
 */
function parseCoverageFinal(raw: string, rootPath: string): FileCoverage[] {
  const payload = JSON.parse(raw) as Record<string, unknown>;
  const files: FileCoverage[] = [];

  for (const [absPath, entry] of Object.entries(payload)) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const s = e.s as Record<string, number> | undefined;
    if (!s) continue;

    const counts = Object.values(s);
    const statementsFound = counts.length;
    const statementsHit = counts.filter((n) => n > 0).length;

    files.push({
      relativePath: toRelativePosix(absPath, rootPath),
      linesFound: statementsFound,
      linesHit: statementsHit,
      lineCoverage: statementsFound > 0 ? (statementsHit / statementsFound) * 100 : 0,
    });
  }

  return files;
}

/**
 * coverage-summary.json — Istanbul per-file summary:
 *   { "total": {...}, "/abs/path/file.ts": { "lines": { "total": 100, "covered": 85, "pct": 85.0 }, ... } }
 */
function parseCoverageSummary(raw: string, rootPath: string): FileCoverage[] {
  const payload = JSON.parse(raw) as Record<string, unknown>;
  const files: FileCoverage[] = [];

  for (const [key, entry] of Object.entries(payload)) {
    if (key === 'total') continue;
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as { lines?: { total?: number; covered?: number; pct?: number } };
    if (!e.lines) continue;

    const total = e.lines.total ?? 0;
    const covered = e.lines.covered ?? 0;
    const pct = typeof e.lines.pct === 'number' ? e.lines.pct : total > 0 ? (covered / total) * 100 : 0;

    files.push({
      relativePath: toRelativePosix(key, rootPath),
      linesFound: total,
      linesHit: covered,
      lineCoverage: pct,
    });
  }

  return files;
}

function toRelativePosix(fsPath: string, rootPath: string): string {
  const absolute = path.resolve(fsPath);
  const absRoot = path.resolve(rootPath);
  if (absolute.startsWith(absRoot + path.sep) || absolute === absRoot) {
    return path.relative(absRoot, absolute).split(path.sep).join('/');
  }
  return fsPath.split(path.sep).join('/');
}

function computeTotal(files: FileCoverage[]): number {
  const totals = files.reduce(
    (acc, f) => {
      acc.found += f.linesFound;
      acc.hit += f.linesHit;
      return acc;
    },
    { found: 0, hit: 0 },
  );
  return totals.found > 0 ? (totals.hit / totals.found) * 100 : 0;
}

/**
 * Build a Map<relativePath, coverage%> for fast lookup.
 */
export function coverageMap(report: CoverageReport): Map<string, number> {
  const map = new Map<string, number>();
  for (const f of report.files) {
    map.set(f.relativePath, f.lineCoverage);
  }
  return map;
}
