/**
 * A reversible deprecation marker (3.8 deprecation pass). Present on a tool
 * means "still works, but slated for removal in 4.0 - prefer `replacedBy`".
 */
export interface ToolDeprecation {
  /** Version the deprecation was announced in (e.g. "3.8.0"). */
  since: string;
  /** The recommended replacement (tool name for MCP, invocation for CLI). */
  replacedBy: string;
  /** Optional one-line rationale shown to humans/agents. */
  note?: string;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Set when the tool is deprecated and scheduled for removal in 4.0. */
  deprecated?: ToolDeprecation;
}

export interface McpPromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

export interface McpPromptDefinition {
  name: string;
  description: string;
  arguments?: McpPromptArgument[];
}

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}
