import fs from 'node:fs/promises';
import path from 'node:path';

import { checkNodeVersion } from './adoptionFirstRunDiagnostics.js';
import { getMcpConfigGuide, INSTALL } from './adoptionMcpConfig.js';
import type { McpClientId } from './adoptionMcpConfig.js';

export interface McpSetupDoctorCheck {
  id: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  summary: string;
  detail?: string;
}

export interface McpSetupDoctorReport {
  schemaVersion: 1;
  client: McpClientId;
  status: 'pass' | 'warn' | 'fail';
  summary: string;
  expected: { command: string; runWithoutInstall: string; install: string };
  whereToPaste: string;
  configText: string;
  checks: McpSetupDoctorCheck[];
  nextCommands: string[];
}

export async function computeMcpSetupDoctor(
  rootPath: string,
  client: McpClientId = 'all',
): Promise<McpSetupDoctorReport> {
  const guide = getMcpConfigGuide(client);
  const configText =
    guide.client === 'all'
      ? guide.configs.map((entry) => `# ${entry.displayName}\n${entry.configText}`).join('\n\n')
      : guide.configText;
  const whereToPaste =
    guide.client === 'all' ? 'Use the matching client-specific config block.' : guide.whereToPaste;
  const checks: McpSetupDoctorCheck[] = [
    checkNodeVersion(),
    {
      id: 'server-command',
      status: 'pass',
      summary: 'MCP server command uses local stdio startup.',
      detail: INSTALL.mcpServerCommand,
    },
    {
      id: 'config-shape',
      status: configText.includes('projscan') && configText.includes('npx') ? 'pass' : 'fail',
      summary: 'Config snippet includes the projscan stdio server.',
      detail: whereToPaste,
    },
    await checkProjectMcpConfig(rootPath, client),
  ];
  const status = checks.some((check) => check.status === 'fail')
    ? 'fail'
    : checks.some((check) => check.status === 'warn')
      ? 'warn'
      : 'pass';
  return {
    schemaVersion: 1,
    client,
    status,
    summary: `${status}: ${client} MCP setup uses ${INSTALL.mcpServerCommand}`,
    expected: {
      command: INSTALL.mcpServerCommand,
      runWithoutInstall: INSTALL.runWithoutInstall,
      install: INSTALL.command,
    },
    whereToPaste,
    configText,
    checks,
    nextCommands: [
      'projscan init mcp --client all',
      `projscan mcp doctor --client ${client} --format json`,
      'npx -y projscan mcp',
    ],
  };
}

async function checkProjectMcpConfig(
  rootPath: string,
  client: McpClientId,
): Promise<McpSetupDoctorCheck> {
  const candidates = clientConfigCandidates(client);
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(path.join(rootPath, candidate), 'utf-8');
      return {
        id: 'project-config',
        status: raw.includes('projscan') ? 'pass' : 'warn',
        summary: raw.includes('projscan')
          ? `Found projscan in ${candidate}.`
          : `Found ${candidate}, but it does not mention projscan.`,
        detail: candidate,
      };
    } catch {
      // try next
    }
  }
  return {
    id: 'project-config',
    status: 'info',
    summary:
      'No project-local MCP config found; paste the snippet into the client settings if needed.',
  };
}

function clientConfigCandidates(client: McpClientId): string[] {
  if (client === 'cursor') return ['.cursor/mcp.json'];
  if (client === 'continue') return ['.continue/config.json'];
  if (client === 'codex') return ['.codex/config.toml'];
  if (client === 'all') return ['.cursor/mcp.json', '.continue/config.json', '.codex/config.toml'];
  return [];
}
