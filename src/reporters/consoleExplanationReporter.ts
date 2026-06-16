import chalk from 'chalk';
import type { FileExplanation } from '../types.js';

function header(title: string): string {
  const line = '─'.repeat(Math.max(title.length + 2, 40));
  return `\n${chalk.bold.cyan(title)}\n${chalk.dim(line)}`;
}

export function reportExplanation(explanation: FileExplanation): void {
  console.log(header('File Explanation'));

  console.log(`\n  ${chalk.bold('File:')}    ${explanation.filePath}`);
  console.log(`  ${chalk.bold('Lines:')}   ${explanation.lineCount}`);
  console.log(`  ${chalk.bold('Purpose:')} ${explanation.purpose}`);

  if (explanation.imports.length > 0) {
    console.log(header('Dependencies'));
    for (const imp of explanation.imports) {
      const prefix = imp.isRelative ? chalk.dim('(local)') : chalk.cyan('(package)');
      console.log(`  ${prefix} ${imp.source}`);
    }
  }

  if (explanation.exports.length > 0) {
    console.log(header('Key Exports'));
    for (const exp of explanation.exports) {
      const typeLabel = chalk.dim(`[${exp.type}]`);
      console.log(`  ${chalk.green('→')} ${exp.name} ${typeLabel}`);
    }
  }

  if (explanation.potentialIssues.length > 0) {
    console.log(header('Potential Issues'));
    for (const issue of explanation.potentialIssues) {
      console.log(`  ${chalk.yellow('⚠')} ${issue}`);
    }
  }

  console.log('');
}
