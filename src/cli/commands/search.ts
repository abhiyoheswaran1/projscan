import ora from 'ora';
import chalk from 'chalk';

import {
  program,
  getFormat,
  getRootPath,
  loadProjectConfig,
  setupLogLevel,
  maybeCompactBanner,
} from '../_shared.js';
import { scanRepository } from '../../core/repositoryScanner.js';
import { buildCodeGraph } from '../../core/codeGraph.js';
import { loadCachedGraph, saveCachedGraph } from '../../core/indexCache.js';
import { detectWorkspaces } from '../../core/monorepo.js';
import {
  buildSearchIndex,
  search as searchIndex,
  attachExcerpts,
  expandQuery,
} from '../../core/searchIndex.js';
import {
  buildSemanticIndex,
  semanticSearch,
  reciprocalRankFusion,
} from '../../core/semanticSearch.js';
import { isSemanticAvailable } from '../../core/embeddings.js';

export function registerSearch(): void {
  program
    .command('search <query...>')
    .description('Ranked search - BM25 by default, semantic or hybrid when @xenova/transformers peer is installed')
    .option('--scope <scope>', 'auto | content | symbols | files', 'auto')
    .option('--mode <mode>', 'lexical | semantic | hybrid (content/auto scope only)', 'lexical')
    .option('--semantic', 'shortcut for --mode semantic')
    .option('--limit <n>', 'max results', '15')
    .option('--package <name>', 'monorepo: scope to a single workspace package')
    .action(async (queryParts: string[], cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      const config = await loadProjectConfig();
      const query = queryParts.join(' ').trim();
      if (!query) {
        console.error(chalk.red('\n  search requires a non-empty query\n'));
        process.exit(1);
      }
      const limitRaw = cmdOpts.limit ?? 15;
      const limit = Math.max(1, Math.min(200, typeof limitRaw === 'string' ? parseInt(limitRaw, 10) || 15 : limitRaw));
      const scope = String(cmdOpts.scope ?? 'auto');

      const spinner = format === 'console' ? ora('Indexing repository...').start() : null;
      try {
        const scan = await scanRepository(rootPath, { ignore: config.ignore });
        const cached = await loadCachedGraph(rootPath);
        const graph = await buildCodeGraph(rootPath, scan.files, cached);
        await saveCachedGraph(rootPath, graph);

        let passes: ((file: string) => boolean) | null = null;
        if (cmdOpts.package) {
          const ws = await detectWorkspaces(rootPath);
          const pkg = ws.packages.find((p) => p.name === cmdOpts.package);
          if (!pkg) {
            passes = () => false;
          } else if (pkg.isRoot) {
            passes = () => true;
          } else {
            const prefix = pkg.relativePath + '/';
            passes = (f: string) => f === pkg.relativePath || f.startsWith(prefix);
          }
        }

        if (spinner) spinner.text = 'Searching...';

        let results: unknown;
        let showSemanticTip = false;
        if (scope === 'symbols') {
          const q = query.toLowerCase();
          const matches: Array<{ symbol: string; kind: string; file: string; line: number }> = [];
          for (const [file, entry] of graph.files) {
            if (passes && !passes(file)) continue;
            for (const exp of entry.exports) {
              if (exp.name.toLowerCase().includes(q)) {
                matches.push({ symbol: exp.name, kind: exp.kind, file, line: exp.line });
              }
            }
          }
          matches.sort((a, b) => {
            const aExact = a.symbol.toLowerCase() === q ? 0 : a.symbol.toLowerCase().startsWith(q) ? 1 : 2;
            const bExact = b.symbol.toLowerCase() === q ? 0 : b.symbol.toLowerCase().startsWith(q) ? 1 : 2;
            return aExact - bExact;
          });
          results = { scope, query, matches: matches.slice(0, limit), total: matches.length };
        } else if (scope === 'files') {
          const q = query.toLowerCase();
          const matches = scan.files
            .filter((f) => f.relativePath.toLowerCase().includes(q))
            .filter((f) => !passes || passes(f.relativePath))
            .slice(0, limit)
            .map((f) => ({ file: f.relativePath, sizeBytes: f.sizeBytes }));
          results = { scope, query, matches, total: matches.length };
        } else {
          const mode = cmdOpts.semantic ? 'semantic' : String(cmdOpts.mode ?? 'lexical');
          showSemanticTip =
            mode === 'lexical' && format === 'console' && !(await isSemanticAvailable());
          const index = await buildSearchIndex(rootPath, scan.files, graph);
          const lexicalHitsAll = searchIndex(index, query, { limit });
          const lexicalHits = passes ? lexicalHitsAll.filter((h) => passes!(h.file)) : lexicalHitsAll;
          const tokens = expandQuery(query);

          if (mode === 'lexical') {
            const withExcerpts = await attachExcerpts(rootPath, lexicalHits, tokens);
            results = {
              scope: scope === 'auto' ? 'content' : scope,
              mode: 'lexical',
              query,
              queryTokens: tokens,
              matches: withExcerpts,
              total: withExcerpts.length,
            };
          } else {
            const available = await isSemanticAvailable();
            if (!available) {
              if (spinner) spinner.stop();
              console.error(
                chalk.red(
                  `\n  Semantic search requires the optional peer @xenova/transformers.\n  Install it with: ${chalk.bold('npm install @xenova/transformers')}\n`,
                ),
              );
              process.exit(1);
            }

            if (spinner) spinner.text = 'Building semantic index (first run may take ~10s + model download)...';
            const semIndex = await buildSemanticIndex(rootPath, scan.files, {
              onFirstLoad: (m) => spinner?.text && (spinner.text = m),
              onProgress: (d, t) => {
                if (spinner) spinner.text = `Embedding files... ${d}/${t}`;
              },
            });
            if (!semIndex) {
              if (spinner) spinner.fail('Semantic index build failed');
              process.exit(1);
            }
            if (spinner) spinner.text = 'Searching...';
            const semHitsAll = await semanticSearch(semIndex, query, { limit });
            const semHits = passes ? semHitsAll.filter((h) => passes!(h.file)) : semHitsAll;

            if (mode === 'semantic') {
              const enriched = await attachExcerpts(
                rootPath,
                semHits.map((h) => ({
                  file: h.file,
                  score: h.score,
                  matched: [],
                  symbolMatch: false,
                  pathMatch: false,
                  excerpt: '',
                  line: 0,
                })),
                tokens,
              );
              results = {
                scope: scope === 'auto' ? 'content' : scope,
                mode: 'semantic',
                query,
                model: semIndex.model,
                matches: enriched,
                total: enriched.length,
              };
            } else {
              const fused = reciprocalRankFusion([lexicalHits, semHits]).slice(0, limit);
              const enriched = await attachExcerpts(
                rootPath,
                fused.map((f) => ({
                  file: f.file,
                  score: f.score,
                  matched: [],
                  symbolMatch: false,
                  pathMatch: false,
                  excerpt: '',
                  line: 0,
                })),
                tokens,
              );
              results = {
                scope: scope === 'auto' ? 'content' : scope,
                mode: 'hybrid',
                query,
                queryTokens: tokens,
                model: semIndex.model,
                matches: enriched,
                total: enriched.length,
              };
            }
          }
        }

        if (spinner) spinner.stop();

        if (format === 'json') {
          console.log(JSON.stringify({ search: results }, null, 2));
          return;
        }

        if (format === 'markdown') {
          const r = results as { matches: Array<Record<string, unknown>>; query: string; scope: string };
          console.log(`# Search - \`${r.query}\` (${r.scope})\n`);
          if (r.matches.length === 0) {
            console.log('_No matches._');
            return;
          }
          for (const m of r.matches) {
            if ('symbol' in m) console.log(`- \`${m.symbol}\` (${m.kind}) → \`${m.file}:${m.line}\``);
            else if ('score' in m) console.log(`- \`${m.file}:${m.line}\` - score ${m.score} - ${m.excerpt ?? ''}`);
            else console.log(`- \`${m.file}\``);
          }
          return;
        }

        const r = results as {
          scope: string;
          matches: Array<Record<string, unknown>>;
          total: number;
          queryTokens?: string[];
        };
        console.log(`\n  ${chalk.bold(`Search - "${query}"`)} ${chalk.dim(`[${r.scope}]`)}`);
        if (r.queryTokens) console.log(chalk.dim(`  tokens: ${r.queryTokens.join(', ')}`));
        console.log(chalk.dim('  ─'.repeat(20)));
        if (r.matches.length === 0) {
          console.log(chalk.yellow('\n  No matches.\n'));
          return;
        }
        for (const m of r.matches) {
          if ('symbol' in m) {
            console.log(
              `  ${chalk.bold(String(m.symbol))} ${chalk.dim(`(${m.kind})`)}  →  ${chalk.dim(`${m.file}:${m.line}`)}`,
            );
          } else if ('score' in m) {
            const score = typeof m.score === 'number' ? m.score.toFixed(1) : String(m.score);
            console.log(
              `  ${chalk.bold(score.padStart(5))}  ${chalk.cyan(String(m.file))}${m.line ? chalk.dim(`:${m.line}`) : ''}`,
            );
            if (m.excerpt) console.log(`           ${chalk.dim(String(m.excerpt))}`);
          } else {
            console.log(`  ${chalk.cyan(String(m.file))}`);
          }
        }
        console.log('');
        if (showSemanticTip) {
          console.error(
            chalk.dim(
              `  tip: install ${chalk.bold('@xenova/transformers')} for semantic search; using BM25 only.\n`,
            ),
          );
        }
      } catch (error) {
        if (spinner) spinner.fail('Search failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
