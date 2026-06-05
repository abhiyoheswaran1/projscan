import path from 'node:path';
import { explainFile, type McpTool } from './_shared.js';

export const explainTool: McpTool = {
  name: 'projscan_explain',
  deprecated: {
    since: '3.8.0',
    replacedBy: 'projscan_file',
    note: 'projscan_file is a strict superset (same purpose/imports/exports plus churn, risk, ownership, and related health).',
  },
  description:
    'Explain a single file: purpose, imports, exports, and potential issues. Useful for understanding unfamiliar code before editing.',
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
    if (!rel) {
      throw new Error(
        'file argument is required: pass a repo-relative path (e.g. "src/auth.ts").',
      );
    }
    const absolutePath = path.resolve(rootPath, rel);
    const resolvedRoot = path.resolve(rootPath);
    if (!absolutePath.startsWith(resolvedRoot + path.sep) && absolutePath !== resolvedRoot) {
      throw new Error(
        `file must be inside the project root (got "${rel}"; absolute or "../" paths are rejected for security).`,
      );
    }
    return await explainFile(absolutePath, rootPath);
  },
};
