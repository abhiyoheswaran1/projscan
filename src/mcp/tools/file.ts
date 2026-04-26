import { inspectFile } from '../../core/fileInspector.js';
import type { McpTool } from './_shared.js';

export const fileTool: McpTool = {
  name: 'projscan_file',
  description:
    'Drill into a single file: purpose, imports, exports, churn/risk/ownership, related health issues, AST cyclomatic complexity, coupling (fan-in / fan-out), and per-function CC ranked by complexity. Use this after projscan_hotspots when deciding how to approach a specific risky file.',
  inputSchema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        description: 'Path to the file relative to the project root.',
      },
    },
    required: ['file'],
  },
  handler: async (args, rootPath) => {
    const rel = typeof args.file === 'string' ? args.file : '';
    if (!rel) throw new Error('file argument is required');
    return await inspectFile(rootPath, rel);
  },
};
