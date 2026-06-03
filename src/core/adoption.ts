import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { buildFirstTenMinutes } from './onboarding.js';
import { PLUGIN_PREVIEW_FLAG, discoverPluginManifests } from './plugins.js';
import { analyzeHotspots } from './hotspotAnalyzer.js';
import { collectIssues } from './issueEngine.js';
import { scanRepository } from './repositoryScanner.js';
import { saveBaseline } from '../utils/baseline.js';
import { applyConfigToIssues, loadConfig } from '../utils/config.js';
import type { ProjscanConfig, StartFirstTenMinutes } from '../types.js';

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

export const POLICY_STARTER_TEAMS = ['frontend', 'platform', 'security', 'monorepo'] as const;

export type PolicyStarterTeam = (typeof POLICY_STARTER_TEAMS)[number];

export interface PolicyStarterKit {
  schemaVersion: 1;
  team: PolicyStarterTeam;
  label: string;
  config: ProjscanConfig;
  nextCommands: string[];
  rationale: string[];
}

export interface WritePolicyStarterOptions {
  force?: boolean;
}

export interface WritePolicyStarterResult extends PolicyStarterKit {
  target: string;
  created: boolean;
  reason?: string;
}

export interface GithubActionStarter {
  schemaVersion: 1;
  filename: '.github/workflows/projscan.yml';
  workflow: string;
  nextCommands: string[];
  rationale: string[];
}

export interface WriteGithubActionStarterResult extends GithubActionStarter {
  target: string;
  created: boolean;
  reason?: string;
}

export interface TeamOnboardingStep {
  id: 'review-generated-files' | 'telemetry-opt-in' | 'verify-mcp-setup' | 'open-first-pr' | 'tune-after-baseline';
  title: string;
  why: string;
  command?: string;
  files?: string[];
}

export interface TeamStarterKit {
  schemaVersion: 1;
  team: PolicyStarterTeam;
  created: {
    policy: boolean;
    githubAction: boolean;
    codeowners: boolean;
    baseline: boolean;
  };
  files: {
    policy: string;
    githubAction: string;
    codeowners: string;
    baseline: string;
  };
  nextCommands: string[];
  rationale: string[];
  reasons: string[];
  onboarding: TeamOnboardingStep[];
}

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
  firstTenMinutes: StartFirstTenMinutes;
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
        id: 'team_bootstrap',
        name: 'Team Bootstrap',
        useWhen: 'Adopt projscan for a team or new repository.',
        outcome: 'A team policy, PR workflow, ownership starter, baseline memory, MCP setup check, and first start report that make adoption repeatable.',
        commands: [
          'projscan init team --team platform',
          'projscan start --mode before_edit --format json',
          'projscan mcp doctor --client codex --format json',
        ],
        mcpTools: ['projscan_adoption', 'projscan_start'],
        handoff: 'Run init team once, commit the generated policy/workflow/ownership/baseline files, then tune thresholds after the first PR.',
      },
      {
        id: 'pr_automation',
        name: 'PR Automation',
        useWhen: 'Put projscan evidence directly in pull request review.',
        outcome: 'Pull requests receive an approval comment and fail CI only when preflight returns block.',
        commands: [
          'projscan init github-action',
          'projscan preflight --mode before_merge --format json',
          'projscan evidence-pack --pr-comment',
        ],
        mcpTools: ['projscan_preflight', 'projscan_evidence_pack'],
        handoff: 'Treat block as a hard CI failure; use PR comment next actions for caution-level follow-up.',
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
  const firstTenMinutes = buildFirstTenMinutes();
  return {
    schemaVersion: 1,
    rootPath,
    overall,
    diagnostics,
    firstTenMinutes,
    nextCommands: dedupeCommands([
      ...firstTenMinutes.commands.map((step) => step.command),
      'projscan init mcp --client all',
      'projscan recipes',
      'projscan preflight --mode before_edit --format json',
      'projscan doctor',
    ]),
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

function dedupeCommands(commands: string[]): string[] {
  return [...new Set(commands)];
}

async function git(rootPath: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('git', args, {
    cwd: rootPath,
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  });
}


export function isPolicyStarterTeam(value: unknown): value is PolicyStarterTeam {
  return typeof value === 'string' && (POLICY_STARTER_TEAMS as readonly string[]).includes(value);
}

export function getPolicyStarterKit(team: PolicyStarterTeam): PolicyStarterKit {
  const kit = POLICY_KITS[team];
  return {
    schemaVersion: 1,
    team,
    label: kit.label,
    config: cloneConfig(kit.config),
    nextCommands: [...kit.nextCommands],
    rationale: [...kit.rationale],
  };
}

export async function writePolicyStarterKit(
  rootPath: string,
  team: PolicyStarterTeam,
  options: WritePolicyStarterOptions = {},
): Promise<WritePolicyStarterResult> {
  const target = path.join(rootPath, '.projscanrc.json');
  const kit = getPolicyStarterKit(team);
  try {
    await fs.access(target);
    if (options.force !== true) {
      return {
        ...kit,
        target,
        created: false,
        reason: '.projscanrc.json already exists; pass --force to overwrite it.',
      };
    }
  } catch {
    // file does not exist
  }
  await fs.writeFile(target, `${JSON.stringify(kit.config, null, 2)}\n`, 'utf-8');
  return {
    ...kit,
    target,
    created: true,
  };
}


export async function writeTeamStarterKit(
  rootPath: string,
  team: PolicyStarterTeam,
  options: WritePolicyStarterOptions = {},
): Promise<TeamStarterKit> {
  const policy = await writePolicyStarterKit(rootPath, team, options);
  const action = await writeGithubActionStarter(rootPath, options);
  const codeowners = await writeCodeownersStarter(rootPath, team, options);
  const baseline = await writeInitialBaseline(rootPath, options);
  return {
    schemaVersion: 1,
    team,
    created: {
      policy: policy.created,
      githubAction: action.created,
      codeowners: codeowners.created,
      baseline: baseline.created,
    },
    files: {
      policy: policy.target,
      githubAction: action.target,
      codeowners: codeowners.target,
      baseline: baseline.target,
    },
    nextCommands: [
      'projscan start --mode before_edit --format json',
      'projscan mcp doctor --client codex --format json',
      'projscan telemetry explain',
      'projscan evidence-pack --pr-comment',
    ],
    rationale: [
      'Bootstraps policy, PR evidence automation, ownership routing, and baseline memory in one command.',
      'The generated PR workflow posts evidence before enforcing block-only preflight failure.',
    ],
    reasons: [policy.reason, action.reason, codeowners.reason, baseline.reason].filter((item): item is string => typeof item === 'string'),
    onboarding: buildTeamOnboarding(team),
  };
}

function buildTeamOnboarding(team: PolicyStarterTeam): TeamOnboardingStep[] {
  return [
    {
      id: 'review-generated-files',
      title: 'Review generated starter files',
      why: 'Confirm policy thresholds, PR workflow behavior, CODEOWNERS handles, and baseline memory before committing the bootstrap.',
      command: 'git diff -- .projscanrc.json .github/workflows/projscan.yml .github/CODEOWNERS .projscan-baseline.json',
      files: ['.projscanrc.json', '.github/workflows/projscan.yml', '.github/CODEOWNERS', '.projscan-baseline.json'],
    },
    {
      id: 'telemetry-opt-in',
      title: 'Choose anonymous telemetry explicitly',
      why: 'Telemetry stays off unless the team opts in; the explain command shows the exact product-health fields collected and the data that is never collected.',
      command: 'projscan telemetry explain',
    },
    {
      id: 'verify-mcp-setup',
      title: 'Verify MCP setup',
      why: 'Make sure the coding agent can start projscan before the first team PR depends on MCP evidence.',
      command: 'projscan mcp doctor --client codex --format json',
    },
    {
      id: 'open-first-pr',
      title: 'Open the first PR with evidence',
      why: 'The first PR should show the verdict, trust calibration, owner routing, baseline trend, and next commands in one reviewer surface.',
      command: 'projscan evidence-pack --pr-comment',
    },
    {
      id: 'tune-after-baseline',
      title: `Tune the ${team} policy after the first baseline`,
      why: 'Treat cautions as calibration data first; tighten thresholds only after the first real team review.',
      command: 'projscan preflight --mode before_merge --format json',
    },
  ];
}

async function writeCodeownersStarter(
  rootPath: string,
  team: PolicyStarterTeam,
  options: WritePolicyStarterOptions,
): Promise<{ target: string; created: boolean; reason?: string }> {
  const target = path.join(rootPath, '.github', 'CODEOWNERS');
  try {
    await fs.access(target);
    if (options.force !== true) return { target, created: false, reason: '.github/CODEOWNERS already exists; pass --force to overwrite it.' };
  } catch {
    // file does not exist
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buildCodeownersStarter(team), 'utf-8');
  return { target, created: true };
}

function buildCodeownersStarter(team: PolicyStarterTeam): string {
  const owner = TEAM_OWNER_HANDLES[team];
  return [
    '# Generated by projscan init team. Replace these handles with your real owners.',
    `* ${owner}`,
    `src/** ${owner}`,
    `docs/** ${owner}`,
    `.github/** ${owner}`,
    '',
  ].join('\n');
}

const TEAM_OWNER_HANDLES: Record<PolicyStarterTeam, string> = {
  frontend: '@frontend-team',
  platform: '@platform-team',
  security: '@security-team',
  monorepo: '@monorepo-team',
};

async function writeInitialBaseline(
  rootPath: string,
  options: WritePolicyStarterOptions,
): Promise<{ target: string; created: boolean; reason?: string }> {
  const target = path.join(rootPath, '.projscan-baseline.json');
  try {
    await fs.access(target);
    if (options.force !== true) return { target, created: false, reason: '.projscan-baseline.json already exists; pass --force to overwrite it.' };
  } catch {
    // file does not exist
  }
  const configResult = await loadConfig(rootPath).catch(() => ({ config: { ignore: [] } }));
  const scan = await scanRepository(rootPath, { ignore: configResult.config.ignore });
  const issues = applyConfigToIssues(await collectIssues(rootPath, scan.files), configResult.config);
  const hotspotReport = await analyzeHotspots(rootPath, scan.files, issues, { limit: 20 });
  await saveBaseline(rootPath, issues, hotspotReport);
  return { target, created: true };
}

export async function computeMcpSetupDoctor(
  rootPath: string,
  client: McpClientId = 'all',
): Promise<McpSetupDoctorReport> {
  const guide = getMcpConfigGuide(client);
  const configText = guide.client === 'all'
    ? guide.configs.map((entry) => `# ${entry.displayName}\n${entry.configText}`).join('\n\n')
    : guide.configText;
  const whereToPaste = guide.client === 'all'
    ? 'Use the matching client-specific config block.'
    : guide.whereToPaste;
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
  const status = checks.some((check) => check.status === 'fail') ? 'fail' : checks.some((check) => check.status === 'warn') ? 'warn' : 'pass';
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
    nextCommands: ['projscan init mcp --client all', `projscan mcp doctor --client ${client} --format json`, 'npx -y projscan mcp'],
  };
}

async function checkProjectMcpConfig(rootPath: string, client: McpClientId): Promise<McpSetupDoctorCheck> {
  const candidates = clientConfigCandidates(client);
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(path.join(rootPath, candidate), 'utf-8');
      return {
        id: 'project-config',
        status: raw.includes('projscan') ? 'pass' : 'warn',
        summary: raw.includes('projscan') ? `Found projscan in ${candidate}.` : `Found ${candidate}, but it does not mention projscan.`,
        detail: candidate,
      };
    } catch {
      // try next
    }
  }
  return {
    id: 'project-config',
    status: 'info',
    summary: 'No project-local MCP config found; paste the snippet into the client settings if needed.',
  };
}

function clientConfigCandidates(client: McpClientId): string[] {
  if (client === 'cursor') return ['.cursor/mcp.json'];
  if (client === 'continue') return ['.continue/config.json'];
  if (client === 'codex') return ['.codex/config.toml'];
  if (client === 'all') return ['.cursor/mcp.json', '.continue/config.json', '.codex/config.toml'];
  return [];
}

const POLICY_KITS: Record<PolicyStarterTeam, Omit<PolicyStarterKit, 'schemaVersion' | 'team'>> = {
  frontend: {
    label: 'Frontend team policy',
    config: {
      minScore: 75,
      hotspots: { limit: 12, since: '90 days ago' },
      ignore: ['.next', 'dist', 'build', 'coverage', 'storybook-static'],
      disableRules: [],
      severityOverrides: {
        'test-missing': 'warning',
      },
    },
    nextCommands: [
      'projscan start --mode before_edit --format json',
      'projscan preflight --mode before_edit --format json',
      'projscan quality-scorecard --format json',
    ],
    rationale: [
      'Frontend teams need fast feedback on generated build directories and test readiness.',
      'The starter keeps generated output quiet while still surfacing changed-code risk.',
    ],
  },
  platform: {
    label: 'Platform team policy',
    config: {
      minScore: 80,
      baseRef: 'main',
      hotspots: { limit: 15, since: '120 days ago' },
      ignore: ['dist', 'build', 'coverage', '.turbo', '.cache'],
      disableRules: [],
    },
    nextCommands: [
      'projscan start --mode before_edit --format json',
      'projscan workplan --mode before_merge --format json',
      'projscan regression-plan --level focused --format json',
    ],
    rationale: [
      'Platform teams usually care about stable merge gates and broad blast radius.',
      'This starter pins the base ref and keeps hotspot windows wide enough for infrastructure churn.',
    ],
  },
  security: {
    label: 'Security team policy',
    config: {
      minScore: 90,
      baseRef: 'main',
      hotspots: { limit: 20, since: '180 days ago' },
      ignore: ['dist', 'build', 'coverage'],
      disableRules: [],
      severityOverrides: {
        'unused-dependency': 'warning',
      },
      taint: {
        sources: ['req.body', 'request.json', 'process.env', 'cookies', 'headers'],
        sinks: ['exec', 'eval', 'spawn', 'query', 'raw', 'innerHTML'],
      },
    },
    nextCommands: [
      'projscan preflight --mode before_edit --format json',
      'projscan dataflow --format json',
      'projscan audit --format sarif',
    ],
    rationale: [
      'Security teams need stricter score thresholds and project-specific taint names.',
      'The starter keeps custom source/sink expansion explicit and reviewable in git.',
    ],
  },
  monorepo: {
    label: 'Monorepo team policy',
    config: {
      minScore: 80,
      baseRef: 'main',
      hotspots: { limit: 20, since: '120 days ago' },
      ignore: ['dist', 'build', 'coverage', '.turbo', '.nx', '.next'],
      disableRules: [],
      monorepo: {
        importPolicy: [{ from: '*', allow: ['*'] }],
      },
    },
    nextCommands: [
      'projscan workspaces --format json',
      'projscan start --mode before_edit --format json',
      'projscan review --package <name> --format json',
    ],
    rationale: [
      'Monorepos need package ownership and import boundaries to be visible early.',
      'The starter makes the policy block explicit so teams can tighten it package by package.',
    ],
  },
};

function cloneConfig(config: ProjscanConfig): ProjscanConfig {
  return JSON.parse(JSON.stringify(config)) as ProjscanConfig;
}

export function getGithubActionStarter(): GithubActionStarter {
  return {
    schemaVersion: 1,
    filename: '.github/workflows/projscan.yml',
    workflow: GITHUB_ACTION_WORKFLOW,
    nextCommands: [
      'git add .github/workflows/projscan.yml',
      'git commit -m "ci: add projscan PR workflow"',
    ],
    rationale: [
      'Runs projscan where review decisions already happen: the pull request.',
      'Posts the same concise approval evidence that `projscan evidence-pack --pr-comment` prints locally.',
      'Validates the generated PR comment before posting so the first review surface keeps verdict, trust calibration, routing, and commands intact.',
      'Fails CI only when the machine-readable preflight verdict is block.',
      'Keeps the workflow tool-only: no source upload, no API key, no embedded LLM.',
    ],
  };
}

export async function writeGithubActionStarter(
  rootPath: string,
  options: WritePolicyStarterOptions = {},
): Promise<WriteGithubActionStarterResult> {
  const starter = getGithubActionStarter();
  const target = path.join(rootPath, starter.filename);
  try {
    await fs.access(target);
    if (options.force !== true) {
      return {
        ...starter,
        target,
        created: false,
        reason: '.github/workflows/projscan.yml already exists; pass --force to overwrite it.',
      };
    }
  } catch {
    // file does not exist
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, starter.workflow, 'utf-8');
  return {
    ...starter,
    target,
    created: true,
  };
}

const GITHUB_ACTION_WORKFLOW = `name: projscan

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    name: projscan PR evidence
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v5
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: 22

      - name: Orient workflow
        run: npx -y projscan start --mode before_merge --format json --quiet > projscan-start.json

      - name: Run preflight gate
        run: npx -y projscan preflight --mode before_merge --format json --quiet > projscan-preflight.json

      - name: Build PR comment
        run: npx -y projscan evidence-pack --pr-comment --quiet > projscan-comment.md

      - name: Validate PR comment
        run: |
          node <<'NODE'
          const fs = require('node:fs');
          const body = fs.readFileSync('projscan-comment.md', 'utf8');
          const required = [
            '## projscan approval evidence',
            '### Verdict',
            '### Trust Calibration',
            '### Baseline Trend',
            '### Top Risks',
            '### First Fix',
            '### Team Routing',
            '### Verification',
            '### Next Commands',
            '### Suggested Next Actions',
          ];
          const missing = required.filter((section) => !body.includes(section));
          const actionable = ['projscan ', 'npm ', 'npx ', 'gh ', 'git '].some((command) => body.includes(command));
          const invalidTokens = body.includes('undefined') || body.includes('[object Object]');
          if (missing.length > 0 || body.length > 65536 || invalidTokens || !actionable) {
            console.error('Invalid projscan PR comment: ' + missing.concat(actionable ? [] : ['missing actionable command']).join(', '));
            process.exit(1);
          }
          NODE

      - name: Publish PR comment
        if: github.event_name == 'pull_request'
        env:
          GH_TOKEN: \${{ github.token }}
        run: |
          if ! gh pr comment "\${{ github.event.pull_request.number }}" --body-file projscan-comment.md --edit-last; then
            gh pr comment "\${{ github.event.pull_request.number }}" --body-file projscan-comment.md
          fi

      - name: Enforce preflight verdict
        run: >
          node -e "const fs = require('node:fs'); const r = JSON.parse(fs.readFileSync('projscan-preflight.json', 'utf8')); if (r.verdict === 'block') { console.error(r.summary || 'projscan preflight blocked this change'); process.exit(1); }"
`;
