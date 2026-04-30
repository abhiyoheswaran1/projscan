import chalk from 'chalk';

import { program, getRootPath, setupLogLevel, maybeCompactBanner } from '../_shared.js';
import { startWatcher } from '../../core/watcher.js';
import { collectIssues } from '../../core/issueEngine.js';
import { scanRepository } from '../../core/repositoryScanner.js';
import { calculateScore } from '../../utils/scoreCalculator.js';

export function registerWatch(): void {
  program
    .command('watch')
    .description('Watch the repo for source changes; re-run doctor on every batch (Ctrl-C to stop)')
    .action(async () => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();

      console.log(chalk.dim(`Watching ${rootPath} ...`));
      console.log(chalk.dim('Initial scan in progress.\n'));

      const handle = startWatcher(rootPath, {
        onError: (err) => {
          console.error(chalk.red(`Watcher error: ${err.message}`));
        },
        onChange: async (evt) => {
          // Re-run doctor against the in-place-updated graph. We could pass
          // the graph through to issueEngine, but keeping the call shape the
          // same as a one-shot run means new analyzers light up automatically.
          const scan = await scanRepository(rootPath);
          const issues = await collectIssues(rootPath, scan.files);
          const score = calculateScore(issues);
          const tag = evt.paths.length === 0 ? 'init' : `${evt.paths.length} change(s)`;
          const ts = new Date().toLocaleTimeString();
          console.log(
            `${chalk.dim(`[${ts}]`)} ${chalk.bold(tag)} · score ${chalk.bold(`${score.score}/100`)} (${score.grade}) · ${chalk.red(score.errors)} err / ${chalk.yellow(score.warnings)} warn / ${chalk.dim(score.infos)} info`,
          );
          if (evt.paths.length > 0 && evt.paths.length <= 5) {
            for (const p of evt.paths) console.log(`  ${chalk.dim('•')} ${p}`);
          }
        },
      });

      try {
        await handle.ready;
      } catch (err) {
        console.error(chalk.red(`Initial scan failed: ${err instanceof Error ? err.message : String(err)}`));
        handle.close();
        process.exit(1);
      }

      const onShutdown = () => {
        console.log(chalk.dim('\nWatcher stopped.'));
        handle.close();
        process.exit(0);
      };
      process.on('SIGINT', onShutdown);
      process.on('SIGTERM', onShutdown);

      // Keep the process alive forever; the watcher resolves nothing.
      await new Promise(() => {
        /* never resolves */
      });
    });
}
