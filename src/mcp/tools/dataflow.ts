import { scanRepository } from '../../core/repositoryScanner.js';
import { buildCodeGraph } from '../../core/codeGraph.js';
import { computeDataflow } from '../../core/dataflow.js';
import { loadConfig } from '../../utils/config.js';
import type { McpTool } from './_shared.js';

export const dataflowTool: McpTool = {
  name: 'projscan_dataflow',
  description:
    'Return v3 dataflow risks over the function graph. Includes legacy direct/propagated taint projections plus bridge-helper risks where a wrapper calls both a source reader and a dangerous sink.',
  inputSchema: {
    type: 'object',
    properties: {
      sources: {
        type: 'array',
        items: { type: 'string' },
        description: 'Additional source names to merge with defaults and .projscanrc taint.sources.',
      },
      sinks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Additional sink names to merge with defaults and .projscanrc taint.sinks.',
      },
      max_risks: {
        type: 'number',
        description: 'Maximum risks to return. Default 50, max 500.',
      },
      max_tokens: {
        type: 'number',
        description: 'Cap the response to roughly this many tokens.',
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
        ? args.sources.filter((value): value is string => typeof value === 'string')
        : []),
    ];
    const sinks = [
      ...(config.taint?.sinks ?? []),
      ...(Array.isArray(args.sinks)
        ? args.sinks.filter((value): value is string => typeof value === 'string')
        : []),
    ];
    const maxRisks =
      typeof args.max_risks === 'number' && Number.isFinite(args.max_risks)
        ? Math.max(1, Math.min(500, Math.floor(args.max_risks)))
        : 50;
    const report = computeDataflow(graph, { sources, sinks });
    return {
      ...report,
      risks: report.risks.slice(0, maxRisks),
      truncated: report.risks.length > maxRisks || report.truncated,
    };
  },
};
