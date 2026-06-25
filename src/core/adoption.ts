import fs from 'node:fs/promises';
import path from 'node:path';

import { analyzeHotspots } from './hotspotAnalyzer.js';
import { collectIssues } from './issueEngine.js';
import { ensureProjectMemoryIgnored } from './memory.js';
import { scanRepository } from './repositoryScanner.js';
import { saveBaseline } from '../utils/baseline.js';
import { applyConfigToIssues, loadConfig } from '../utils/config.js';
import type { ProjscanConfig } from '../types/config.js';

export {
  getMcpConfigGuide,
  isMcpClientId,
  MCP_CLIENT_IDS,
} from './adoptionMcpConfig.js';
export type {
  McpClientId,
  McpConfigCatalog,
  McpConfigGuide,
  McpConfigInstall,
  SingleMcpClientId,
} from './adoptionMcpConfig.js';
export { getWorkflowRecipes } from './adoptionWorkflowRecipes.js';
export type {
  AgentWorkflowRecipe,
  WorkflowRecipeCatalog,
} from './adoptionWorkflowRecipes.js';
export {
  computeFirstRunDiagnostics,
} from './adoptionFirstRunDiagnostics.js';
export type {
  FirstRunDiagnostic,
  FirstRunReport,
  FirstRunStatus,
} from './adoptionFirstRunDiagnostics.js';
export { computeMcpSetupDoctor } from './adoptionMcpDoctor.js';
export type { McpSetupDoctorCheck, McpSetupDoctorReport } from './adoptionMcpDoctor.js';

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
  id:
    | 'review-generated-files'
    | 'telemetry-opt-in'
    | 'verify-mcp-setup'
    | 'open-first-pr'
    | 'tune-after-baseline';
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
  await ensureProjectMemoryIgnored(rootPath);
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
    reasons: [policy.reason, action.reason, codeowners.reason, baseline.reason].filter(
      (item): item is string => typeof item === 'string',
    ),
    onboarding: buildTeamOnboarding(team),
  };
}

function buildTeamOnboarding(team: PolicyStarterTeam): TeamOnboardingStep[] {
  return [
    {
      id: 'review-generated-files',
      title: 'Review generated starter files',
      why: 'Confirm policy thresholds, PR workflow behavior, CODEOWNERS handles, and baseline memory before committing the bootstrap.',
      command:
        'git diff -- .projscanrc.json .github/workflows/projscan.yml .github/CODEOWNERS .projscan-baseline.json .gitignore',
      files: [
        '.projscanrc.json',
        '.github/workflows/projscan.yml',
        '.github/CODEOWNERS',
        '.projscan-baseline.json',
        '.gitignore',
      ],
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
    if (options.force !== true)
      return {
        target,
        created: false,
        reason: '.github/CODEOWNERS already exists; pass --force to overwrite it.',
      };
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
    if (options.force !== true)
      return {
        target,
        created: false,
        reason: '.projscan-baseline.json already exists; pass --force to overwrite it.',
      };
  } catch {
    // file does not exist
  }
  const configResult = await loadConfig(rootPath).catch(() => ({ config: { ignore: [] } }));
  const scan = await scanRepository(rootPath, { ignore: configResult.config.ignore });
  const issues = applyConfigToIssues(
    await collectIssues(rootPath, scan.files),
    configResult.config,
  );
  const hotspotReport = await analyzeHotspots(rootPath, scan.files, issues, { limit: 20 });
  await saveBaseline(rootPath, issues, hotspotReport);
  return { target, created: true };
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
            '### Reviewer Decision',
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
