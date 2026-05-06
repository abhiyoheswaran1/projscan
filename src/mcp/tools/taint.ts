import { scanRepository } from '../../core/repositoryScanner.js';
import { buildCodeGraph } from '../../core/codeGraph.js';
import { computeTaint } from '../../core/taint.js';
import { loadConfig } from '../../utils/config.js';
import type { McpTool } from './_shared.js';

/**
 * `projscan_taint` (1.6+) — surface source-to-sink reachability flows
 * over the per-function call graph. Sources (e.g. `process.env.X`,
 * `req.body`) and sinks (e.g. `exec`, `eval`, `db.query`) come from a
 * built-in default list; users add project-specific names via the
 * `.projscanrc.json` `taint` block.
 *
 * The flow list is exact-match, dedup'd by (sourceFn, sinkFn). It does
 * NOT track variable-level flow — if a function reads a source AND
 * calls a sink (directly or transitively), it surfaces. False positives
 * are expected for functions that launder taint safely; users can
 * declare safe wrappers as sinks-with-disableRules.
 */
export const taintTool: McpTool = {
  name: 'projscan_taint',
  description:
    'Source-to-sink reachability over the per-function call graph (1.6+). Surfaces "this function reads `process.env`/`req.body` and calls `exec`/`eval`/raw SQL" patterns. Defaults cover common JS / Python sources + sinks; project-specific names go in `.projscanrc.json` `taint`.',
  inputSchema: {
    type: 'object',
    properties: {
      sources: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Additional source names to merge with the defaults. Match is by bare name (rightmost identifier), so `customSecretReader()` adds the literal "customSecretReader".',
      },
      sinks: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Additional sink names to merge with the defaults. Useful for project-specific dangerous wrappers like `runRawSql` or `dangerouslyEval`.',
      },
      max_flows: {
        type: 'number',
        description:
          'Cap the number of flows returned (most-direct first; same-function flows lead). Default 50.',
      },
    },
  },
  handler: async (args, rootPath) => {
    const scan = await scanRepository(rootPath);
    const graph = await buildCodeGraph(rootPath, scan.files);
    const { config } = await loadConfig(rootPath);
    const sources = [
      ...(config.taint?.sources ?? []),
      ...(Array.isArray(args.sources)
        ? args.sources.filter((v): v is string => typeof v === 'string')
        : []),
    ];
    const sinks = [
      ...(config.taint?.sinks ?? []),
      ...(Array.isArray(args.sinks)
        ? args.sinks.filter((v): v is string => typeof v === 'string')
        : []),
    ];
    const max = typeof args.max_flows === 'number' && args.max_flows > 0 ? args.max_flows : 50;
    const report = computeTaint(graph, { sources, sinks });
    if (!report.available) return report;
    return {
      ...report,
      flows: report.flows.slice(0, max),
      truncated: report.flows.length > max,
    };
  },
};
