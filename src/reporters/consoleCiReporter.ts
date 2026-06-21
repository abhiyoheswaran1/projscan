import chalk from 'chalk';
import type { Issue } from '../types.js';
import type { CiFailOnSeverity } from '../types/config.js';
import { evaluateCiGate } from '../core/ciGate.js';
import { ciFailOnLabel } from '../utils/ciFailOn.js';
import { formatIssueLocations, issueRemediation } from './ciIssueDetails.js';
import { printScoreBreakdown } from './scoreBreakdownReporter.js';

function severityIcon(severity: string): string {
  switch (severity) {
    case 'error':
      return chalk.red('✗');
    case 'warning':
      return chalk.yellow('⚠');
    case 'info':
      return chalk.blue('ℹ');
    default:
      return chalk.dim('·');
  }
}

export function reportCi(
  issues: Issue[],
  threshold: number,
  failOn?: CiFailOnSeverity,
): void {
  const gate = evaluateCiGate(issues, threshold, failOn);
  const status = gate.pass ? chalk.green('PASS') : chalk.red('FAIL');
  const gradeColor =
    gate.grade === 'A' || gate.grade === 'B'
      ? chalk.green
      : gate.grade === 'C'
        ? chalk.yellow
        : chalk.red;

  console.log(
    `projscan: ${gradeColor(chalk.bold(`${gate.grade} (${gate.score}/100)`))} - ${gate.errors} error${gate.errors !== 1 ? 's' : ''}, ${gate.warnings} warning${gate.warnings !== 1 ? 's' : ''}, ${gate.infos} info - ${status} (threshold: ${threshold}, failOn: ${gate.failOn})`,
  );
  printScoreBreakdown(gate.scoreBreakdown);
  if (!gate.scorePass && gate.pass) {
    console.log(
      `  ${chalk.dim(`score is below threshold, but no ${ciFailOnLabel(gate.failOn)} findings were found`)}`,
    );
  }

  if (!gate.pass) {
    for (const issue of issues) {
      console.log(`  ${severityIcon(issue.severity)} ${issue.title} ${chalk.dim(`(${issue.id})`)}`);
      const locations = formatIssueLocations(issue);
      if (locations) console.log(`    ${chalk.dim('where:')} ${locations}`);
      console.log(`    ${chalk.dim('message:')} ${issue.description}`);
      const remediation = issueRemediation(issue);
      if (remediation) console.log(`    ${chalk.dim('remediation:')} ${remediation}`);
    }
  }
}
