import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { PLUGIN_PREVIEW_FLAG, discoverPluginManifests } from './plugins.js';

const execFileAsync = promisify(execFile);

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

export interface AgentWorkflowRecipe {
  id: string;
  name: string;
  useWhen: string;
  outcome: string;
  commands: string[];
  mcpTools: string[];
  handoff: string;
}

export interface WorkflowRecipeCatalog {
  schemaVersion: 1;
  recipes: AgentWorkflowRecipe[];
}

export type FirstRunStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface FirstRunDiagnostic {
  id: string;
  label: string;
  status: FirstRunStatus;
  summary: string;
  detail?: string;
  command?: string;
}

export interface FirstRunReport {
  schemaVersion: 1;
  rootPath: string;
  overall: FirstRunStatus;
  diagnostics: FirstRunDiagnostic[];
  nextCommands: string[];
}

const INSTALL: McpConfigInstall = {
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
    notes: ['If your Zed build expects `mcpServers`, use the generic MCP JSON from `--client all`.'],
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

export function getWorkflowRecipes(): WorkflowRecipeCatalog {
  return {
    schemaVersion: 1,
    recipes: [
      {
        id: 'before_edit',
        name: 'Before Edit',
        useWhen: 'Start here before an agent changes code.',
        outcome: 'A proceed/caution/block gate plus the next tool calls that explain any risk.',
        commands: [
          'projscan preflight --mode before_edit --format json',
          'projscan workplan --mode before_edit --format json',
        ],
        mcpTools: ['projscan_preflight', 'projscan_workplan'],
        handoff: 'If preflight returns caution or block, follow suggestedNextActions before editing.',
      },
      {
        id: 'bug_hunt',
        name: 'Bug Hunt',
        useWhen: 'Run a focused polish or stabilization pass.',
        outcome: 'A ranked fix queue with evidence and verification commands.',
        commands: [
          'projscan bug-hunt --format json',
          'projscan quality-scorecard --format json',
          'projscan regression-plan --level focused --format json',
        ],
        mcpTools: ['projscan_bug_hunt', 'projscan_quality_scorecard', 'projscan_regression_plan'],
        handoff: 'Fix top-ranked targets first, then rerun the regression plan.',
      },
      {
        id: 'release_approval',
        name: 'Release Approval',
        useWhen: 'Prepare a maintainer or CI environment approval packet.',
        outcome: 'Version readiness, risks, regression commands, and website update copy in one loop.',
        commands: [
          'projscan release-train --format json',
          'projscan evidence-pack --website-prompt --format json',
          'projscan regression-plan --level full --format json',
        ],
        mcpTools: ['projscan_release_train', 'projscan_evidence_pack', 'projscan_regression_plan'],
        handoff: 'Use the evidence pack as the approval artifact; do not skip the full release gate.',
      },
      {
        id: 'handoff',
        name: 'Agent Handoff',
        useWhen: 'Compress repo context for the next agent or a resumed session.',
        outcome: 'A compact brief with focus items, guardrails, and suggested next actions.',
        commands: [
          'projscan agent-brief --intent handoff --format json',
          'projscan handoff --format json',
        ],
        mcpTools: ['projscan_agent_brief', 'projscan_workplan'],
        handoff: 'Paste the brief into the next agent session before asking it to edit.',
      },
      {
        id: 'pre_merge',
        name: 'Pre-Merge',
        useWhen: 'Check a branch before merge or release tagging.',
        outcome: 'Changed-file health, review verdict, taint flow evidence, and required checks.',
        commands: [
          'projscan preflight --mode before_merge --format json',
          'projscan review --format json',
          'projscan regression-plan --level smoke --format json',
        ],
        mcpTools: ['projscan_preflight', 'projscan_review', 'projscan_regression_plan'],
        handoff: 'Treat block as a hard stop and caution as a request for explicit review.',
      },
    ],
  };
}

export async function computeFirstRunDiagnostics(rootPath: string): Promise<FirstRunReport> {
  const diagnostics: FirstRunDiagnostic[] = [
    checkNodeVersion(),
    await checkPackageJson(rootPath),
    await checkGit(rootPath),
    await checkConfig(rootPath),
    await checkTreeSitter(rootPath),
    await checkPlugins(rootPath),
    checkMcpStartup(),
  ];
  const overall = summarizeDiagnostics(diagnostics);
  return {
    schemaVersion: 1,
    rootPath,
    overall,
    diagnostics,
    nextCommands: [
      'projscan init mcp --client all',
      'projscan recipes',
      'projscan preflight --mode before_edit --format json',
      'projscan doctor',
    ],
  };
}

function buildGuide(client: SingleMcpClientId): McpConfigGuide {
  return {
    schemaVersion: 1,
    install: INSTALL,
    ...CLIENTS[client],
  };
}

function checkNodeVersion(): FirstRunDiagnostic {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  if (Number.isFinite(major) && major >= 18) {
    return {
      id: 'node',
      label: 'Node.js',
      status: 'pass',
      summary: `Node ${process.versions.node} satisfies projscan's >=18 requirement.`,
    };
  }
  return {
    id: 'node',
    label: 'Node.js',
    status: 'fail',
    summary: `Node ${process.versions.node} is below projscan's >=18 requirement.`,
    command: 'node --version',
  };
}

async function checkPackageJson(rootPath: string): Promise<FirstRunDiagnostic> {
  const file = path.join(rootPath, 'package.json');
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as { name?: unknown; scripts?: unknown };
    const name = typeof parsed.name === 'string' ? parsed.name : path.basename(rootPath);
    const scripts = parsed.scripts && typeof parsed.scripts === 'object' ? Object.keys(parsed.scripts).length : 0;
    return {
      id: 'package-json',
      label: 'Package metadata',
      status: 'pass',
      summary: `Found package.json for ${name}.`,
      detail: scripts > 0 ? `${scripts} npm script(s) detected for release/test recipes.` : 'No npm scripts detected.',
    };
  } catch (err) {
    return {
      id: 'package-json',
      label: 'Package metadata',
      status: 'warn',
      summary: 'No readable package.json found; Node dependency and script checks will be limited.',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkGit(rootPath: string): Promise<FirstRunDiagnostic> {
  try {
    const inside = await git(rootPath, ['rev-parse', '--is-inside-work-tree']);
    if (inside.stdout.trim() !== 'true') {
      return {
        id: 'git',
        label: 'Git',
        status: 'warn',
        summary: 'This directory is not inside a Git worktree.',
        detail: 'Review, changed-file, and pre-merge recipes need Git history.',
      };
    }
    const status = await git(rootPath, ['status', '--short']);
    const remote = await git(rootPath, ['remote']);
    const dirty = status.stdout.trim().length > 0;
    return {
      id: 'git',
      label: 'Git',
      status: dirty ? 'warn' : 'pass',
      summary: dirty ? 'Git worktree has local changes.' : 'Git worktree detected and clean.',
      detail: remote.stdout.trim().length > 0 ? `Remotes: ${remote.stdout.trim().split(/\s+/).join(', ')}` : 'No git remote configured.',
    };
  } catch (err) {
    return {
      id: 'git',
      label: 'Git',
      status: 'warn',
      summary: 'Git metadata is unavailable.',
      detail: err instanceof Error ? err.message : String(err),
      command: 'git status --short',
    };
  }
}

async function checkConfig(rootPath: string): Promise<FirstRunDiagnostic> {
  try {
    await fs.access(path.join(rootPath, '.projscanrc.json'));
    return {
      id: 'projscan-config',
      label: 'projscan config',
      status: 'pass',
      summary: 'Found .projscanrc.json.',
    };
  } catch {
    return {
      id: 'projscan-config',
      label: 'projscan config',
      status: 'info',
      summary: 'No .projscanrc.json yet; defaults are fine for first use.',
      command: 'projscan init',
    };
  }
}

async function checkTreeSitter(rootPath: string): Promise<FirstRunDiagnostic> {
  const candidates = [
    path.join(rootPath, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm'),
    path.join(rootPath, 'dist', 'grammars', 'web-tree-sitter.wasm'),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return {
        id: 'tree-sitter',
        label: 'Tree-sitter runtime',
        status: 'pass',
        summary: 'Tree-sitter WASM runtime is present.',
      };
    } catch {
      // try next
    }
  }
  return {
    id: 'tree-sitter',
    label: 'Tree-sitter runtime',
    status: 'info',
    summary: 'Tree-sitter runtime was not found in this project checkout.',
    detail: 'This is normal when using npx; projscan ships its runtime with the package.',
  };
}

async function checkPlugins(rootPath: string): Promise<FirstRunDiagnostic> {
  const entries = await discoverPluginManifests(rootPath);
  if (entries.length === 0) {
    return {
      id: 'plugins',
      label: 'Local plugins',
      status: 'info',
      summary: 'No local plugin manifests found.',
      detail: `Set ${PLUGIN_PREVIEW_FLAG}=1 only when you want projscan to execute trusted local plugins.`,
      command: 'projscan plugin init --kind analyzer --name policy',
    };
  }
  const broken = entries.filter((entry) => entry.manifest === null);
  return {
    id: 'plugins',
    label: 'Local plugins',
    status: broken.length > 0 ? 'warn' : 'pass',
    summary:
      broken.length > 0
        ? `${broken.length} of ${entries.length} plugin manifest(s) need attention.`
        : `${entries.length} plugin manifest(s) validate.`,
    command: 'projscan plugin list',
  };
}

function checkMcpStartup(): FirstRunDiagnostic {
  return {
    id: 'mcp-startup',
    label: 'MCP startup',
    status: 'pass',
    summary: 'Use stdio startup for every MCP client.',
    detail: INSTALL.mcpServerCommand,
    command: 'npx -y projscan mcp',
  };
}

function summarizeDiagnostics(diagnostics: FirstRunDiagnostic[]): FirstRunStatus {
  if (diagnostics.some((diagnostic) => diagnostic.status === 'fail')) return 'fail';
  if (diagnostics.some((diagnostic) => diagnostic.status === 'warn')) return 'warn';
  return 'pass';
}

async function git(rootPath: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('git', args, {
    cwd: rootPath,
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  });
}
