import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeMissionProofReport } from '../../core/missionProof.js';
import {
  MISSION_PROOF_BASELINE_STATUSES,
  loadMissionProofBaseline,
  missionProofBaselineTemplate,
  parseMissionProofBaselineInput,
  validateMissionProofBaselineRuns,
  type MissionProofBaselineInput,
} from '../../core/missionProofBaseline.js';
import { renderMissionProofMarkdown } from '../../core/missionProofMarkdown.js';
import { renderMissionProofSummary } from '../../core/missionProofSummary.js';
import type { MissionProofBaselineRun, MissionProofReport, MissionRunStatus, ReportFormat } from '../../types.js';

export function registerMissionProof(): void {
  program
    .command('mission-proof')
    .description('Summarize local Mission Control proof and compare it with optional manual baseline runs')
    .option('--mission <dir>', 'Mission Control bundle directory, repeatable (default: .projscan/mission)', collectMission, [])
    .option('--all', 'discover .projscan/mission and direct child bundles under .projscan/missions')
    .option('--latest', 'select the most recently updated saved mission bundle')
    .option('--list', 'list saved mission bundles and exit')
    .option('--needs-attention', 'filter --list to saved mission bundles that are not passed')
    .option('--mission-status <status>', 'filter --list by saved mission status: passed, failed, running, not_run, or unknown')
    .option('--baseline <path>', 'JSON file with manual runs to compare against Mission Control proof')
    .option('--init-baseline <file>', 'write a local manual-baseline JSON template and exit')
    .option('--add-baseline-run <file>', 'append one measured manual run to a local baseline JSON file')
    .option('--check-baseline <file>', 'validate a local manual-baseline JSON file and exit')
    .option('--id <id>', 'manual baseline run id for --add-baseline-run')
    .option('--status <status>', 'manual baseline status for --add-baseline-run: passed, failed, running, not_run, or unknown')
    .option('--minutes-spent <minutes>', 'minutes spent in the manual baseline run', parseNonNegativeNumber)
    .option('--reruns <count>', 'reruns in the manual baseline run', parseNonNegativeNumber)
    .option('--failed-gates <count>', 'failed gates in the manual baseline run', parseNonNegativeNumber)
    .option('--reviewer-approvals <count>', 'reviewer approvals in the manual baseline run', parseNonNegativeNumber)
    .option('--write <file>', 'write a JSON or Markdown mission proof artifact to this path')
    .option('--require-passed', 'exit non-zero unless every selected mission bundle passed proof')
    .option('--summary', 'print one compact Mission Proof status line for terminal logs')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      try {
        const rootPath = getRootPath();
        if (cmdOpts.list === true) {
          const missions = filterSavedMissionBundles(
            sortSavedMissionBundles(await discoverSavedMissionBundles(rootPath)),
            cmdOpts,
          );
          printMissionBundleList(missions, assertFormatSupported('mission-proof'));
          return;
        }
        if (typeof cmdOpts.initBaseline === 'string' && cmdOpts.initBaseline.length > 0) {
          const target = await writeBaselineTemplate(rootPath, cmdOpts.initBaseline);
          printBaselineTemplateWrite(target, assertFormatSupported('mission-proof'));
          return;
        }
        if (typeof cmdOpts.addBaselineRun === 'string' && cmdOpts.addBaselineRun.length > 0) {
          const run = baselineRunFromOptions(cmdOpts);
          const result = await appendBaselineRun(rootPath, cmdOpts.addBaselineRun, run);
          printBaselineRunAppend(result, run, assertFormatSupported('mission-proof'));
          return;
        }
        if (typeof cmdOpts.checkBaseline === 'string' && cmdOpts.checkBaseline.length > 0) {
          const baseline = await loadMissionProofBaseline(rootPath, cmdOpts.checkBaseline);
          const target = path.resolve(rootPath, cmdOpts.checkBaseline);
          printBaselineCheck(baseline, target, assertFormatSupported('mission-proof'));
          return;
        }
        const format = assertFormatSupported('mission-proof');
        const missions = await resolveMissionDirs(rootPath, cmdOpts.mission, cmdOpts.all === true, cmdOpts.latest === true);
        const report = await computeMissionProofReport(rootPath, {
          missions,
          baselineFile: typeof cmdOpts.baseline === 'string' ? cmdOpts.baseline : undefined,
        });
        if (typeof cmdOpts.write === 'string' && cmdOpts.write.length > 0) {
          const writeFormat = resolveWriteFormat(format, cmdOpts.write);
          const target = path.resolve(rootPath, cmdOpts.write);
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, renderMissionProofForFormat(report, writeFormat), 'utf-8');
          if (cmdOpts.summary === true) {
            console.log(renderMissionProofSummary(report));
            enforceRequirePassedGate(report, cmdOpts.requirePassed === true);
            return;
          }
          if (writeFormat === 'json') {
            console.log(JSON.stringify({ writtenTo: target, format: writeFormat }, null, 2));
            enforceRequirePassedGate(report, cmdOpts.requirePassed === true);
            return;
          }
          console.log(chalk.green(`Wrote mission proof report to ${target}`));
          enforceRequirePassedGate(report, cmdOpts.requirePassed === true);
          return;
        }
        if (cmdOpts.summary === true) {
          console.log(renderMissionProofSummary(report));
          enforceRequirePassedGate(report, cmdOpts.requirePassed === true);
          return;
        }
        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          enforceRequirePassedGate(report, cmdOpts.requirePassed === true);
          return;
        }
        if (format === 'markdown') {
          console.log(renderMissionProofMarkdown(report).trimEnd());
          enforceRequirePassedGate(report, cmdOpts.requirePassed === true);
          return;
        }
        printMissionProof(report);
        enforceRequirePassedGate(report, cmdOpts.requirePassed === true);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function collectMission(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseNonNegativeNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('value must be a non-negative number');
  }
  return parsed;
}

async function writeBaselineTemplate(rootPath: string, targetPath: string): Promise<string> {
  const target = path.resolve(rootPath, targetPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(missionProofBaselineTemplate(), null, 2) + '\n', { flag: 'wx' });
  return target;
}

function baselineRunFromOptions(cmdOpts: Record<string, unknown>): MissionProofBaselineRun {
  const id = typeof cmdOpts.id === 'string' && cmdOpts.id.length > 0 ? cmdOpts.id : undefined;
  if (!id) throw new Error('--add-baseline-run requires --id <id>.');
  const status = parseBaselineStatus(cmdOpts.status);
  const run: MissionProofBaselineRun = { id, status };
  addOptionalNumber(run, 'minutesSpent', cmdOpts.minutesSpent);
  addOptionalNumber(run, 'reruns', cmdOpts.reruns);
  addOptionalNumber(run, 'failedGates', cmdOpts.failedGates);
  addOptionalNumber(run, 'reviewerApprovals', cmdOpts.reviewerApprovals);
  return run;
}

function parseBaselineStatus(value: unknown): MissionRunStatus {
  if (typeof value === 'string' && MISSION_PROOF_BASELINE_STATUSES.includes(value as MissionRunStatus)) return value as MissionRunStatus;
  throw new Error('--add-baseline-run requires --status passed, failed, running, not_run, or unknown.');
}

function addOptionalNumber(
  run: MissionProofBaselineRun,
  field: 'minutesSpent' | 'reruns' | 'failedGates' | 'reviewerApprovals',
  value: unknown,
): void {
  if (typeof value === 'number') run[field] = value;
}

async function appendBaselineRun(
  rootPath: string,
  targetPath: string,
  run: MissionProofBaselineRun,
): Promise<{ target: string; runCount: number }> {
  const target = path.resolve(rootPath, targetPath);
  const existing = await readBaselineForAppend(target, targetPath);
  const runs = validateMissionProofBaselineRuns(existing, targetPath);
  if (runs.some((existingRun) => existingRun.id === run.id)) {
    throw new Error(`Mission proof baseline already has a run with id ${run.id}: ${targetPath}`);
  }
  const nextRuns = [...runs, run];
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify({ ...existing, schemaVersion: 1, runs: nextRuns }, null, 2) + '\n');
  return { target, runCount: nextRuns.length };
}

async function readBaselineForAppend(target: string, targetPath: string): Promise<MissionProofBaselineInput> {
  let raw: string;
  try {
    raw = await fs.readFile(target, 'utf8');
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') return { schemaVersion: 1, runs: [] };
    throw err;
  }
  return parseMissionProofBaselineInput(raw, targetPath);
}

async function resolveMissionDirs(
  rootPath: string,
  missions: string[],
  includeAll: boolean,
  latestOnly: boolean,
): Promise<string[]> {
  if (latestOnly) return [await resolveLatestMissionDir(rootPath)];
  if (!includeAll) return missions;
  const selected = new Set(missions);
  await addMissionIfPresent(rootPath, '.projscan/mission', selected);
  await addMissionChildren(rootPath, '.projscan/missions', selected);
  return [...selected];
}

interface SavedMissionBundle {
  missionDir: string;
  status: MissionRunStatus;
  mtimeMs: number;
  updatedAt: string;
}

async function resolveLatestMissionDir(rootPath: string): Promise<string> {
  const candidates = await discoverSavedMissionBundles(rootPath);
  if (candidates.length === 0) {
    throw new Error(
      'No saved mission bundles found under .projscan/mission or .projscan/missions.\n' +
      'Create one with: projscan start --save-mission .projscan/mission --intent "<goal>"',
    );
  }
  return sortSavedMissionBundles(candidates)[0].missionDir;
}

async function discoverSavedMissionBundles(rootPath: string): Promise<SavedMissionBundle[]> {
  const candidates: SavedMissionBundle[] = [];
  const current = await findMissionBundle(rootPath, '.projscan/mission');
  if (current) candidates.push(current);
  let entries: Array<{ name: string; isDirectory(): boolean }>;
  try {
    entries = await fs.readdir(path.resolve(rootPath, '.projscan/missions'), { withFileTypes: true });
  } catch {
    return candidates;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const mission = await findMissionBundle(rootPath, path.join('.projscan/missions', entry.name));
    if (mission) candidates.push(mission);
  }
  return candidates;
}

function sortSavedMissionBundles(candidates: SavedMissionBundle[]): SavedMissionBundle[] {
  return [...candidates].sort((a, b) => b.mtimeMs - a.mtimeMs || a.missionDir.localeCompare(b.missionDir));
}

function filterSavedMissionBundles(
  candidates: SavedMissionBundle[],
  cmdOpts: Record<string, unknown>,
): SavedMissionBundle[] {
  const exactStatus = parseOptionalMissionStatus(cmdOpts.missionStatus);
  return candidates.filter((candidate) => {
    if (cmdOpts.needsAttention === true && candidate.status === 'passed') return false;
    if (exactStatus && candidate.status !== exactStatus) return false;
    return true;
  });
}

function parseOptionalMissionStatus(value: unknown): MissionRunStatus | undefined {
  if (typeof value === 'undefined') return undefined;
  if (typeof value === 'string' && MISSION_PROOF_BASELINE_STATUSES.includes(value as MissionRunStatus)) {
    return value as MissionRunStatus;
  }
  throw new Error('--mission-status must be passed, failed, running, not_run, or unknown.');
}

async function addMissionChildren(rootPath: string, relativeRoot: string, selected: Set<string>): Promise<void> {
  let entries: Array<{ name: string; isDirectory(): boolean }>;
  try {
    entries = await fs.readdir(path.resolve(rootPath, relativeRoot), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    await addMissionIfPresent(rootPath, path.join(relativeRoot, entry.name), selected);
  }
}

async function addMissionIfPresent(rootPath: string, missionDir: string, selected: Set<string>): Promise<void> {
  if (selected.has(missionDir)) return;
  const mission = await findMissionBundle(rootPath, missionDir);
  if (mission) selected.add(mission.missionDir);
}

async function findMissionBundle(
  rootPath: string,
  missionDir: string,
): Promise<SavedMissionBundle | null> {
  const summaryPath = path.resolve(rootPath, missionDir, 'proof-logs', 'summary.json');
  try {
    const stat = await fs.stat(summaryPath);
    if (stat.isFile()) {
      return {
        missionDir,
        status: await readMissionSummaryStatus(summaryPath),
        mtimeMs: stat.mtimeMs,
        updatedAt: new Date(stat.mtimeMs).toISOString(),
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function readMissionSummaryStatus(summaryPath: string): Promise<MissionRunStatus> {
  try {
    const parsed = JSON.parse(await fs.readFile(summaryPath, 'utf8')) as { status?: unknown };
    return parseMissionRunStatus(parsed.status);
  } catch {
    return 'unknown';
  }
}

function parseMissionRunStatus(value: unknown): MissionRunStatus {
  return typeof value === 'string' && MISSION_PROOF_BASELINE_STATUSES.includes(value as MissionRunStatus)
    ? value as MissionRunStatus
    : 'unknown';
}

function resolveWriteFormat(format: ReportFormat, target: string): 'json' | 'markdown' {
  if (format === 'json' || format === 'markdown') return format;
  const ext = path.extname(target).toLowerCase();
  if (ext === '.json') return 'json';
  return 'markdown';
}

function renderMissionProofForFormat(report: MissionProofReport, format: 'json' | 'markdown'): string {
  return format === 'json'
    ? JSON.stringify(report, null, 2) + '\n'
    : renderMissionProofMarkdown(report);
}

function printBaselineTemplateWrite(target: string, format: ReportFormat): void {
  if (format === 'json') {
    console.log(JSON.stringify({ writtenTo: target, runCount: 0, template: true }, null, 2));
    return;
  }
  if (format === 'markdown') {
    console.log([
      '# Mission Proof Baseline',
      '',
      `- Template written: ${target}`,
      '- Runs: 0',
      '',
    ].join('\n'));
    return;
  }
  console.log(chalk.green(`Wrote mission proof baseline template to ${target}`));
}

function printBaselineRunAppend(
  result: { target: string; runCount: number },
  run: MissionProofBaselineRun,
  format: ReportFormat,
): void {
  if (format === 'json') {
    console.log(JSON.stringify({ writtenTo: result.target, addedRun: run, runCount: result.runCount }, null, 2));
    return;
  }
  if (format === 'markdown') {
    console.log([
      '# Mission Proof Baseline',
      '',
      `- Added run: ${run.id}`,
      `- File: ${result.target}`,
      `- Runs: ${result.runCount}`,
      '',
    ].join('\n'));
    return;
  }
  console.log(chalk.green(`Added baseline run ${run.id} to ${result.target}`));
}

function printBaselineCheck(
  baseline: NonNullable<MissionProofReport['baseline']>,
  target: string,
  format: ReportFormat,
): void {
  if (format === 'json') {
    console.log(JSON.stringify({
      valid: true,
      path: target,
      runCount: baseline.runs.length,
      totals: baseline.totals,
    }, null, 2));
    return;
  }
  if (format === 'markdown') {
    console.log([
      '# Mission Proof Baseline',
      '',
      `- Valid: true`,
      `- Path: ${target}`,
      `- Runs: ${baseline.runs.length}`,
      `- Minutes spent: ${baseline.totals.minutesSpent}`,
      `- Reruns: ${baseline.totals.reruns}`,
      `- Failed gates: ${baseline.totals.failedGates}`,
      '',
    ].join('\n'));
    return;
  }
  console.log(chalk.green(`Mission proof baseline valid: ${target} (${baseline.runs.length} run(s))`));
}

function printMissionBundleList(missions: SavedMissionBundle[], format: ReportFormat): void {
  const payload = {
    missions: missions.map(missionBundleListItem),
    totals: missionBundleListTotals(missions),
  };
  if (format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  if (format === 'markdown') {
    const lines = ['# Saved Mission Bundles', ''];
    if (payload.missions.length === 0) {
      lines.push('No saved mission bundles found.');
    } else {
      lines.push('## Totals');
      lines.push(`- Missions: ${payload.totals.missions}`);
      lines.push(`- Passed: ${payload.totals.passed}`);
      lines.push(`- Failed: ${payload.totals.failed}`);
      lines.push(`- Running: ${payload.totals.running}`);
      lines.push(`- Not run: ${payload.totals.notRun}`);
      lines.push(`- Unknown: ${payload.totals.unknown}`);
      lines.push('');
      for (const mission of payload.missions) {
        lines.push(`## ${mission.missionDir}`);
        lines.push(`- Status: ${mission.status}`);
        lines.push(`- Updated: ${mission.updatedAt}`);
        lines.push('- Resume:');
        lines.push('```bash');
        lines.push(mission.resumeCommand);
        lines.push('```');
        lines.push('- Proof:');
        lines.push('```bash');
        lines.push(mission.proofCommand);
        lines.push('```');
        lines.push('');
      }
    }
    console.log(lines.join('\n'));
    return;
  }
  if (payload.missions.length === 0) {
    console.log('No saved mission bundles found under .projscan/mission or .projscan/missions.');
    return;
  }
  console.log(chalk.bold('Saved Mission Bundles'));
  for (const mission of payload.missions) {
    console.log(`- ${mission.missionDir}: ${mission.status} (${mission.updatedAt})`);
    console.log(`  Resume: ${mission.resumeCommand}`);
    console.log(`  Proof: ${mission.proofCommand}`);
  }
}

function missionBundleListItem(mission: SavedMissionBundle): {
  missionDir: string;
  status: MissionRunStatus;
  updatedAt: string;
  resumeCommand: string;
  proofCommand: string;
} {
  return {
    missionDir: mission.missionDir,
    status: mission.status,
    updatedAt: mission.updatedAt,
    resumeCommand: `projscan start --mission ${shellToken(mission.missionDir)}`,
    proofCommand: `projscan mission-proof --mission ${shellToken(mission.missionDir)} --format markdown`,
  };
}

function missionBundleListTotals(missions: SavedMissionBundle[]): {
  missions: number;
  passed: number;
  failed: number;
  running: number;
  notRun: number;
  unknown: number;
} {
  return {
    missions: missions.length,
    passed: missions.filter((mission) => mission.status === 'passed').length,
    failed: missions.filter((mission) => mission.status === 'failed').length,
    running: missions.filter((mission) => mission.status === 'running').length,
    notRun: missions.filter((mission) => mission.status === 'not_run').length,
    unknown: missions.filter((mission) => mission.status === 'unknown').length,
  };
}

function shellToken(value: string): string {
  return /^[A-Za-z0-9_./:-]+$/.test(value) ? value : JSON.stringify(value);
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && 'code' in value;
}

function enforceRequirePassedGate(report: MissionProofReport, enabled: boolean): void {
  if (!enabled) return;
  const totals = report.missionControl.totals;
  if (totals.missions > 0 && totals.passed === totals.missions) return;
  console.error(chalk.red('Mission proof gate failed: ' + summarizeGateFailure(totals)));
  process.exit(1);
}

function summarizeGateFailure(totals: MissionProofReport['missionControl']['totals']): string {
  const details = [
    totals.failed > 0 ? `${totals.failed} failed` : undefined,
    totals.running > 0 ? `${totals.running} running` : undefined,
    totals.notRun > 0 ? `${totals.notRun} not run` : undefined,
    totals.unavailable > 0 ? `${totals.unavailable} unavailable` : undefined,
  ].filter(Boolean);
  const suffix = details.length > 0 ? `; ${details.join('; ')}` : '';
  return `${totals.passed} of ${totals.missions} mission bundle(s) passed${suffix}.`;
}

function printMissionProof(report: MissionProofReport): void {
  const totals = report.missionControl.totals;
  const color = totals.failed > 0 || totals.unavailable > 0 ? chalk.yellow : chalk.green;
  console.log(color(`Mission proof: ${totals.missions} mission bundle(s)`));
  console.log(report.summary);
  console.log(`Passed: ${totals.passed}; failed: ${totals.failed}; running: ${totals.running}; not run: ${totals.notRun}`);
  console.log(`Reruns: ${totals.reruns}; failed gates: ${totals.failedGates}; reviewer approvals: ${totals.reviewerApprovals}`);
  if (report.comparison) {
    console.log('');
    console.log(chalk.bold('Compared With Baseline'));
    console.log(`Completion delta: ${report.comparison.completionRateDelta}`);
    console.log(`Reruns avoided: ${report.comparison.rerunsAvoided}`);
    console.log(`Failed gates avoided: ${report.comparison.failedGatesAvoided}`);
    console.log(`Minutes saved: ${report.comparison.minutesSaved}`);
  }
  console.log('');
  console.log(chalk.bold('Risk Avoided'));
  for (const item of report.riskAvoided) console.log('- ' + item);
  console.log('');
  console.log(chalk.bold('Next Actions'));
  for (const action of report.nextActions) {
    if (action.command) console.log('- ' + action.command);
  }
}
