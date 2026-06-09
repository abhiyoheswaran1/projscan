import chalk from 'chalk';

import { program, setupLogLevel, maybeCompactBanner, assertFormatSupported } from '../_shared.js';
import { routeIntent } from '../../core/intentRouter.js';

/**
 * `projscan route [intent...]` (4.x) — map a goal to the right projscan tool.
 * Repo-independent (pure routing); no scan required.
 */
export function registerRoute(): void {
  program
    .command('route [intent...]')
    .description('Find the right projscan tool for a goal')
    .action(async (intentParts: string[]) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('route');
      const intent = (intentParts ?? []).join(' ').trim();
      const result = routeIntent(intent.length > 0 ? intent : undefined);

      if (format === 'json') {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log('');
      if (result.intent === null) {
        console.log(chalk.bold('projscan capability catalog'));
        console.log(chalk.dim('────────────────────────────────────────'));
        let lastCategory = '';
        for (const m of result.matches) {
          if (m.category !== lastCategory) {
            console.log('');
            console.log(chalk.bold(`  ${m.category}`));
            lastCategory = m.category;
          }
          console.log(`    ${chalk.cyan(m.cli)} ${chalk.dim('—')} ${m.what}`);
        }
        console.log('');
        console.log(chalk.dim('  Tip: `projscan route <what you want to do>` to jump straight to a tool.'));
        return;
      }

      console.log(chalk.bold(`Best tools for: ${chalk.italic(result.intent)}`));
      console.log(chalk.dim('────────────────────────────────────────'));
      if (!result.matched) {
        console.log(chalk.dim('  No direct match. Run `projscan route` (no args) to see the full catalog.'));
        return;
      }
      result.matches.slice(0, 3).forEach((m, i) => {
        console.log('');
        console.log(`  ${i + 1}. ${chalk.bold(m.tool)} ${chalk.dim(`(${m.category})`)}`);
        console.log(`     ${chalk.dim(`confidence: ${m.confidence}; matched: ${m.matchedKeywords.join(', ') || 'none'}`)}`);
        console.log(`     ${m.why}`);
        console.log(`     ${chalk.cyan(m.example)}`);
      });
    });
}
