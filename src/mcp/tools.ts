/**
 * MCP tool registry - barrel that aggregates the per-tool modules under
 * `src/mcp/tools/`. New tools live in their own file under that directory and
 * are added to the `tools` array below.
 *
 * The shape exposed here (`getToolDefinitions`, `getToolHandler`,
 * `McpToolHandler`) is consumed by `src/mcp/server.ts`. Re-export `McpTool`
 * + `McpToolHandler` so external callers don't need to know about the
 * directory split.
 */

import { analyzeTool } from './tools/analyze.js';
import { doctorTool } from './tools/doctor.js';
import { hotspotsTool } from './tools/hotspots.js';
import { explainTool } from './tools/explain.js';
import { fileTool } from './tools/file.js';
import { structureTool } from './tools/structure.js';
import { dependenciesTool } from './tools/dependencies.js';
import { outdatedTool } from './tools/outdated.js';
import { auditTool } from './tools/audit.js';
import { upgradeTool } from './tools/upgrade.js';
import { coverageTool } from './tools/coverage.js';
import { graphTool } from './tools/graph.js';
import { couplingTool } from './tools/coupling.js';
import { workspacesTool } from './tools/workspaces.js';
import { prDiffTool } from './tools/prDiff.js';
import { reviewTool } from './tools/review.js';
import { fixSuggestTool } from './tools/fixSuggest.js';
import { explainIssueTool } from './tools/explainIssue.js';
import { searchTool } from './tools/search.js';
import type { McpToolDefinition } from '../types.js';
import type { McpTool, McpToolHandler } from './tools/_shared.js';

export type { McpTool, McpToolHandler };

const tools: McpTool[] = [
  analyzeTool,
  doctorTool,
  hotspotsTool,
  explainTool,
  fileTool,
  structureTool,
  dependenciesTool,
  outdatedTool,
  auditTool,
  upgradeTool,
  coverageTool,
  graphTool,
  couplingTool,
  workspacesTool,
  prDiffTool,
  reviewTool,
  fixSuggestTool,
  explainIssueTool,
  searchTool,
];

export function getToolDefinitions(): McpToolDefinition[] {
  return tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}

export function getToolHandler(name: string): McpToolHandler | undefined {
  return tools.find((t) => t.name === name)?.handler;
}
