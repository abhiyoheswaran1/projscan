import path from 'node:path';
import fs from 'node:fs/promises';
import { explainFile, type McpTool } from './_shared.js';

export const explainTool: McpTool = {
  name: 'projscan_explain',
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
    if (!rel) throw new Error('file argument is required');
    const absolutePath = path.resolve(rootPath, rel);
    const resolvedRoot = path.resolve(rootPath);
    if (!absolutePath.startsWith(resolvedRoot + path.sep) && absolutePath !== resolvedRoot) {
      throw new Error('file must be inside the project root');
    }
    const content = await fs.readFile(absolutePath, 'utf-8');
    return explainFile(absolutePath, content, rootPath);
  },
};
