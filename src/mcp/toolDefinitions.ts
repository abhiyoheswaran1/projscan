import { deprecationDescriptionPrefix } from '../core/deprecations.js';
import type { McpToolDefinition } from '../types.js';
import type { McpTool } from './tools/_shared.js';

export function toToolDefinitions(tools: readonly McpTool[]): McpToolDefinition[] {
  return tools.map(toToolDefinition);
}

function toToolDefinition({
  name,
  description,
  inputSchema,
  deprecated,
}: McpTool): McpToolDefinition {
  const def: McpToolDefinition = {
    name,
    description: deprecated ? deprecationDescriptionPrefix(deprecated) + description : description,
    inputSchema,
  };
  if (deprecated) def.deprecated = deprecated;
  return def;
}
