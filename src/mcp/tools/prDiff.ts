import { computePrDiff } from '../../core/prDiff.js';
import { emitProgress } from '../progress.js';
import { PACKAGE_ARG_SCHEMA, resolvePackageFilter, type McpTool } from './_shared.js';

export const prDiffTool: McpTool = {
  name: 'projscan_pr_diff',
  description:
    'Structural (AST) diff between two refs - what changed in exports, imports, call sites, cyclomatic complexity, and fan-in. Not a text diff: this surfaces the symbols and edges that an agent reviewing a PR actually cares about. Defaults: base=origin/main (falls back to main/master/HEAD~1), head=HEAD. Spins up a throwaway git worktree at the base ref to get a clean second graph.',
  inputSchema: {
    type: 'object',
    properties: {
      base: {
        type: 'string',
        description: 'Base ref (branch, tag, sha). Default: origin/main, falling back to main/master/HEAD~1.',
      },
      head: { type: 'string', description: 'Head ref. Default: HEAD.' },
      max_tokens: { type: 'number', description: 'Cap the response to roughly this many tokens.' },
      package: PACKAGE_ARG_SCHEMA,
    },
  },
  handler: async (args, rootPath) => {
    emitProgress(0, 3, 'resolving refs');
    const base = typeof args.base === 'string' ? args.base : undefined;
    const head = typeof args.head === 'string' ? args.head : undefined;
    emitProgress(1, 3, 'building base + head graphs');
    const report = await computePrDiff(rootPath, { base, head });
    emitProgress(2, 3, 'diffing');
    const passes = await resolvePackageFilter(rootPath, args);
    if (passes) {
      report.filesAdded = report.filesAdded.filter(passes);
      report.filesRemoved = report.filesRemoved.filter(passes);
      report.filesModified = report.filesModified.filter((f) => passes(f.relativePath));
      report.totalFilesChanged =
        report.filesAdded.length + report.filesRemoved.length + report.filesModified.length;
    }
    emitProgress(3, 3, 'done');
    return report;
  },
};
