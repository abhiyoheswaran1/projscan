import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeMissionProofReport } from '../../core/missionProof.js';
import type { MissionProofReport } from '../../types.js';

export function registerMissionProof(): void {
  program
    .command('mission-proof')
    .description('Summarize local Mission Control proof and compare it with optional manual baseline runs')
    .option('--mission <dir>', 'Mission Control bundle directory, repeatable (default: .projscan/mission)', collectMission, [])
    .option('--baseline <path>', 'JSON file with manual runs to compare against Mission Control proof')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('mission-proof');
      try {
        const report = await computeMissionProofReport(getRootPath(), {
          missions: cmdOpts.mission,
          baselineFile: typeof cmdOpts.baseline === 'string' ? cmdOpts.baseline : undefined,
        });
        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        printMissionProof(report);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function collectMission(value: string, previous: string[]): string[] {
  return [...previous, value];
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
