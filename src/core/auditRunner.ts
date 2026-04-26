import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AuditFinding, AuditReport, AuditSeverity } from '../types.js';
import { detectWorkspaces } from './monorepo.js';

const execFileAsync = promisify(execFile);

const EMPTY_SUMMARY: Record<AuditSeverity, number> = {
  critical: 0,
  high: 0,
  moderate: 0,
  low: 0,
  info: 0,
};

export interface AuditOptions {
  /** Seconds before giving up on npm audit. */
  timeoutMs?: number;
  /**
   * Optional workspace package name (or relative path) to scope findings to.
   * The audit command itself runs against the root lockfile (which is what
   * npm/yarn/pnpm need for transitive resolution), but findings are then
   * filtered to vulnerabilities whose name appears as a direct dependency or
   * dev-dependency of the named workspace's manifest.
   */
  packageFilter?: string;
}

/**
 * Run `npm audit --json` and normalize the output.
 *
 * npm's audit JSON format has changed between npm 6/7/8/9+ - we handle the
 * modern format (npm 7+) first and fall back to a friendly error otherwise.
 * Yarn/pnpm projects: we don't try to translate; we report "not available"
 * with a hint.
 */
export async function runAudit(
  rootPath: string,
  options: AuditOptions = {},
): Promise<AuditReport> {
  const hasPackageJson = await fileExists(path.join(rootPath, 'package.json'));
  if (!hasPackageJson) {
    return unavailable('No package.json found in this directory');
  }

  const hasNpmLock = await fileExists(path.join(rootPath, 'package-lock.json'));
  const hasYarnLock = await fileExists(path.join(rootPath, 'yarn.lock'));
  const hasPnpmLock = await fileExists(path.join(rootPath, 'pnpm-lock.yaml'));

  if (!hasNpmLock) {
    if (hasYarnLock) {
      return unavailable('yarn.lock detected - run `yarn npm audit` instead');
    }
    if (hasPnpmLock) {
      return unavailable('pnpm-lock.yaml detected - run `pnpm audit` instead');
    }
    return unavailable('No package-lock.json - run `npm install` first, then retry');
  }

  const timeoutMs = options.timeoutMs ?? 60_000;
  let stdout: string;
  try {
    const result = await execFileAsync('npm', ['audit', '--json'], {
      cwd: rootPath,
      maxBuffer: 16 * 1024 * 1024,
      timeout: timeoutMs,
    });
    stdout = result.stdout;
  } catch (err) {
    // `npm audit` exits non-zero when vulnerabilities exist - this is normal.
    // The stdout still contains the JSON payload.
    const e = err as { stdout?: string | Buffer; code?: string; message?: string };
    if (typeof e.stdout === 'string' && e.stdout) {
      stdout = e.stdout;
    } else if (e.stdout instanceof Buffer) {
      stdout = e.stdout.toString('utf-8');
    } else {
      return unavailable(`npm audit failed: ${e.message ?? 'unknown error'}`);
    }
  }

  if (!stdout) return unavailable('npm audit returned no output');

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    return unavailable('npm audit returned invalid JSON');
  }

  const report = normalize(payload);
  if (options.packageFilter && report.available) {
    return await scopeReportToWorkspace(rootPath, options.packageFilter, report);
  }
  return report;
}

/**
 * Filter audit findings to the direct dependencies of a single workspace's
 * package.json. Findings whose name doesn't appear in that manifest are
 * dropped. If the workspace can't be located the original report is returned
 * with a `reason` annotation rather than failing.
 */
async function scopeReportToWorkspace(
  rootPath: string,
  packageFilter: string,
  report: AuditReport,
): Promise<AuditReport> {
  const ws = await detectWorkspaces(rootPath);
  const target = ws.packages.find(
    (p) => p.name === packageFilter || p.relativePath === packageFilter,
  );
  if (!target) {
    return {
      ...report,
      reason: `Workspace not found: ${packageFilter}`,
    };
  }
  const manifestPath = path.join(rootPath, target.relativePath, 'package.json');
  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, 'utf-8');
  } catch {
    return { ...report, reason: `Cannot read ${target.relativePath}/package.json` };
  }
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(raw) as typeof pkg;
  } catch {
    return { ...report, reason: `Invalid JSON in ${target.relativePath}/package.json` };
  }
  const allowed = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);
  const findings = report.findings.filter((f) => allowed.has(f.name));
  const summary: Record<AuditSeverity, number> = { ...EMPTY_SUMMARY };
  for (const f of findings) summary[f.severity]++;
  return {
    available: true,
    summary,
    findings,
  };
}

function normalize(payload: Record<string, unknown>): AuditReport {
  // Modern format (npm 7+): { vulnerabilities: { name: { severity, via, range, fixAvailable, ... } }, metadata: { vulnerabilities: { critical, high, ... } } }
  const vulns = payload.vulnerabilities as Record<string, unknown> | undefined;
  const metadata = payload.metadata as { vulnerabilities?: Record<string, number> } | undefined;

  if (!vulns || typeof vulns !== 'object') {
    return {
      available: true,
      summary: { ...EMPTY_SUMMARY },
      findings: [],
    };
  }

  const findings: AuditFinding[] = [];
  for (const [name, info] of Object.entries(vulns)) {
    if (!info || typeof info !== 'object') continue;
    const entry = info as Record<string, unknown>;
    const severity = normalizeSeverity(entry.severity);
    const via = normalizeVia(entry.via);
    const fixAvailable = entry.fixAvailable !== false && entry.fixAvailable !== undefined;

    findings.push({
      name,
      severity,
      title: extractTitle(via, name, severity),
      url: extractUrl(via),
      cve: extractCves(via),
      via,
      range: typeof entry.range === 'string' ? entry.range : undefined,
      fixAvailable,
    });
  }

  const summary: Record<AuditSeverity, number> = { ...EMPTY_SUMMARY };
  if (metadata?.vulnerabilities) {
    for (const k of ['critical', 'high', 'moderate', 'low', 'info'] as AuditSeverity[]) {
      summary[k] = metadata.vulnerabilities[k] ?? 0;
    }
  } else {
    for (const f of findings) summary[f.severity]++;
  }

  findings.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));

  return {
    available: true,
    summary,
    findings,
  };
}

function normalizeSeverity(raw: unknown): AuditSeverity {
  if (typeof raw !== 'string') return 'info';
  const v = raw.toLowerCase();
  if (v === 'critical' || v === 'high' || v === 'moderate' || v === 'low' || v === 'info') {
    return v;
  }
  return 'info';
}

function normalizeVia(raw: unknown): string[] {
  if (!raw) return [];
  if (typeof raw === 'string') return [raw];
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') out.push(item);
    else if (item && typeof item === 'object' && 'name' in item) {
      out.push(String((item as { name: unknown }).name));
    }
  }
  return out;
}

function extractTitle(via: string[], name: string, severity: AuditSeverity): string {
  const first = via[0];
  if (first && first !== name) return `${first} (${severity})`;
  return `Vulnerability in ${name} (${severity})`;
}

function extractUrl(via: unknown): string | undefined {
  if (!Array.isArray(via)) return undefined;
  for (const item of via) {
    if (item && typeof item === 'object' && 'url' in item) {
      const url = (item as { url: unknown }).url;
      if (typeof url === 'string') return url;
    }
  }
  return undefined;
}

function extractCves(via: unknown): string[] | undefined {
  if (!Array.isArray(via)) return undefined;
  const cves = new Set<string>();
  for (const item of via) {
    if (item && typeof item === 'object' && 'cwe' in item) {
      const cwe = (item as { cwe: unknown }).cwe;
      if (Array.isArray(cwe)) for (const c of cwe) if (typeof c === 'string') cves.add(c);
    }
  }
  return cves.size > 0 ? [...cves] : undefined;
}

function severityWeight(s: AuditSeverity): number {
  return { critical: 5, high: 4, moderate: 3, low: 2, info: 1 }[s];
}

function unavailable(reason: string): AuditReport {
  return {
    available: false,
    reason,
    summary: { ...EMPTY_SUMMARY },
    findings: [],
  };
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Convert an AuditReport into projscan Issues for SARIF emission. */
export function auditFindingsToIssues(report: AuditReport): import('../types.js').Issue[] {
  if (!report.available) return [];
  const severityMap: Record<AuditSeverity, 'info' | 'warning' | 'error'> = {
    critical: 'error',
    high: 'error',
    moderate: 'warning',
    low: 'info',
    info: 'info',
  };
  return report.findings.map((f) => ({
    id: `audit-${f.name}`,
    title: f.title,
    description:
      f.url !== undefined
        ? `${f.title} - ${f.url}${f.range ? ` (range: ${f.range})` : ''}`
        : `${f.title}${f.range ? ` (range: ${f.range})` : ''}`,
    severity: severityMap[f.severity],
    category: 'security',
    fixAvailable: f.fixAvailable,
    locations: [{ file: 'package.json' }],
  }));
}
