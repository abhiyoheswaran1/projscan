export const MCP_CLIENT_IDS = [
  'all',
  'claude-desktop',
  'claude-code',
  'cursor',
  'codex',
  'continue',
  'windsurf',
  'cline',
  'zed',
  'gemini',
] as const;

export type McpClientId = (typeof MCP_CLIENT_IDS)[number];
export type SingleMcpClientId = Exclude<McpClientId, 'all'>;

export interface McpConfigInstall {
  command: string;
  runWithoutInstall: string;
  mcpServerCommand: string;
}

export interface McpConfigGuide {
  schemaVersion: 1;
  client: SingleMcpClientId;
  displayName: string;
  whereToPaste: string;
  install: McpConfigInstall;
  config: Record<string, unknown>;
  configText: string;
  notes: string[];
}

export interface McpConfigCatalog {
  schemaVersion: 1;
  client: 'all';
  install: McpConfigInstall;
  configs: McpConfigGuide[];
}

export const INSTALL: McpConfigInstall = {
  command: 'npm install -g projscan',
  runWithoutInstall: 'npx projscan',
  mcpServerCommand: 'npx -y projscan mcp',
};

const SERVER = {
  command: 'npx',
  args: ['-y', 'projscan', 'mcp'],
};

const CLIENTS: Record<SingleMcpClientId, Omit<McpConfigGuide, 'schemaVersion' | 'install'>> = {
  'claude-desktop': {
    client: 'claude-desktop',
    displayName: 'Claude Desktop',
    whereToPaste: 'Claude Desktop MCP settings JSON.',
    config: { mcpServers: { projscan: SERVER } },
    configText: JSON.stringify({ mcpServers: { projscan: SERVER } }, null, 2),
    notes: ['Restart Claude Desktop after saving the config.'],
  },
  'claude-code': {
    client: 'claude-code',
    displayName: 'Claude Code',
    whereToPaste: 'Claude Code MCP server settings.',
    config: { mcpServers: { projscan: SERVER } },
    configText: JSON.stringify({ mcpServers: { projscan: SERVER } }, null, 2),
    notes: ['Keep projscan as a stdio server so code never leaves the repo.'],
  },
  cursor: {
    client: 'cursor',
    displayName: 'Cursor',
    whereToPaste: 'Cursor MCP settings, usually `.cursor/mcp.json` or Settings > MCP.',
    config: { mcpServers: { projscan: SERVER } },
    configText: JSON.stringify({ mcpServers: { projscan: SERVER } }, null, 2),
    notes: ['Open a repo before invoking projscan tools so the server starts in the project root.'],
  },
  codex: {
    client: 'codex',
    displayName: 'Codex CLI',
    whereToPaste: 'Codex MCP server configuration.',
    config: { mcpServers: { projscan: SERVER } },
    configText: [
      '[mcp_servers.projscan]',
      'command = "npx"',
      'args = ["-y", "projscan", "mcp"]',
    ].join('\n'),
    notes: ['Use this as a local stdio MCP server config; no projscan API key is required.'],
  },
  continue: {
    client: 'continue',
    displayName: 'Continue',
    whereToPaste: 'Continue MCP server config.',
    config: { mcpServers: { projscan: SERVER } },
    configText: JSON.stringify({ mcpServers: { projscan: SERVER } }, null, 2),
    notes: ['Use alongside Continue context providers when agents need structured repo evidence.'],
  },
  windsurf: {
    client: 'windsurf',
    displayName: 'Windsurf',
    whereToPaste: 'Windsurf MCP settings.',
    config: { mcpServers: { projscan: SERVER } },
    configText: JSON.stringify({ mcpServers: { projscan: SERVER } }, null, 2),
    notes: ['Run `projscan first-run` in the target repo if tools fail to start.'],
  },
  cline: {
    client: 'cline',
    displayName: 'Cline',
    whereToPaste: 'Cline MCP settings JSON.',
    config: { mcpServers: { projscan: SERVER } },
    configText: JSON.stringify({ mcpServers: { projscan: SERVER } }, null, 2),
    notes: ['Keep the command as `npx` so Cline can launch the published server directly.'],
  },
  zed: {
    client: 'zed',
    displayName: 'Zed',
    whereToPaste: 'Zed assistant MCP/context server settings.',
    config: { context_servers: { projscan: SERVER } },
    configText: JSON.stringify({ context_servers: { projscan: SERVER } }, null, 2),
    notes: [
      'If your Zed build expects `mcpServers`, use the generic MCP JSON from `--client all`.',
    ],
  },
  gemini: {
    client: 'gemini',
    displayName: 'Gemini CLI',
    whereToPaste: 'Gemini CLI MCP settings.',
    config: { mcpServers: { projscan: SERVER } },
    configText: JSON.stringify({ mcpServers: { projscan: SERVER } }, null, 2),
    notes: ['Use `npx -y projscan mcp` as the stdio server command.'],
  },
};

export function isMcpClientId(value: unknown): value is McpClientId {
  return typeof value === 'string' && (MCP_CLIENT_IDS as readonly string[]).includes(value);
}

export function getMcpConfigGuide(client: McpClientId = 'all'): McpConfigCatalog | McpConfigGuide {
  if (client === 'all') {
    return {
      schemaVersion: 1,
      client: 'all',
      install: INSTALL,
      configs: (MCP_CLIENT_IDS.filter((id) => id !== 'all') as SingleMcpClientId[]).map((id) =>
        buildGuide(id),
      ),
    };
  }
  return buildGuide(client);
}

function buildGuide(client: SingleMcpClientId): McpConfigGuide {
  return {
    schemaVersion: 1,
    install: INSTALL,
    ...CLIENTS[client],
  };
}
