/**
 * MCP tool registry lookup helpers. Static catalog data lives in
 * `src/mcp/toolCatalog.ts`; new tool modules are added there.
 *
 * The shape exposed here (`getToolDefinitions`, `getToolHandler`,
 * `McpToolHandler`) is consumed by `src/mcp/server.ts`. Re-export `McpTool`
 * + `McpToolHandler` so external callers don't need to know about the
 * directory split.
 */

import { deprecationDescriptionPrefix } from '../core/deprecations.js';
import type { McpToolDefinition } from '../types.js';
import { mcpTools } from './toolCatalog.js';
import type { McpTool, McpToolHandler } from './tools/_shared.js';

export type { McpTool, McpToolHandler };

export function getToolDefinitions(): McpToolDefinition[] {
  return mcpTools.map(({ name, description, inputSchema, deprecated }) => {
    const def: McpToolDefinition = {
      name,
      description: deprecated
        ? deprecationDescriptionPrefix(deprecated) + description
        : description,
      inputSchema,
    };
    if (deprecated) def.deprecated = deprecated;
    return def;
  });
}

export function getToolHandler(name: string): McpToolHandler | undefined {
  return mcpTools.find((tool) => tool.name === name)?.handler;
}
