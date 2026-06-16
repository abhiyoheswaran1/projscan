import type { ReleaseTrainTask, ReleaseTrainTrack } from '../types.js';

interface RoadmapCatalogEntry {
  line: string;
  track: Omit<ReleaseTrainTrack, 'line'>;
  tasks: ReleaseTrainTask[];
}

export const ROADMAP_3_2_LINES = [
  '3.2.x',
  '3.3.x',
  '3.4.x',
  '3.5.x',
  '3.6.x',
  '3.7.x',
  '3.8.x',
  '3.9.x',
] as const;
export const ROADMAP_3_4_LINES = ['3.4.x'] as const;

const ROADMAP_3_2_CATALOG: Record<string, RoadmapCatalogEntry> = {
  '3.2.x': {
    line: '3.2.x',
    track: {
      theme: 'Roadmap Canonicalization',
      outcome:
        'The release-train surface names the real product roadmap instead of generic quality placeholders.',
      includedInPlan: true,
      scope: [
        'catalog-backed release train',
        'roadmap documentation alignment',
        'read-only planning evidence',
      ],
      successCriteria: [
        'release-train defaults to all eight approved workstreams',
        'docs/ROADMAP.md matches the generated plan',
        'planning output remains read-only',
      ],
    },
    tasks: [
      {
        id: 'rt-3-2-roadmap-canonicalization',
        priority: 'p0',
        title: 'Canonicalize the 3.2 roadmap train',
        why: 'A useful release-train command should tell maintainers which product bets are actually next.',
        track: '3.2.x',
        files: ['src/core/roadmapCatalog.ts', 'src/core/releaseTrain.ts', 'docs/ROADMAP.md'],
        verification: {
          commands: ['projscan release-train --format json', 'npm test'],
          expected:
            'Release train returns the eight roadmap workstreams with concrete tasks and stays read-only.',
        },
      },
    ],
  },
  '3.3.x': {
    line: '3.3.x',
    track: {
      theme: 'Adoption Proof Polish',
      outcome: 'Teams can see the next missing proof gate before calling adoption proven.',
      includedInPlan: true,
      scope: [
        'proof-gate summaries',
        'reviewer feedback prioritization',
        'trial verdict explanation',
      ],
      successCriteria: [
        'dogfood names the next proof step',
        'trial output carries adoption blockers clearly',
        'website proof remains measured and provisional until proven',
      ],
    },
    tasks: [
      {
        id: 'rt-3-3-adoption-proof-polish',
        priority: 'p0',
        title: 'Sharpen adoption proof gates',
        why: 'Adoption validation should explain the one next action that moves a team from setup to proof.',
        track: '3.3.x',
        files: [
          'src/core/dogfood.ts',
          'src/core/trial.ts',
          'docs/ADOPTION-PROOF.md',
          'docs/MARKET-VALIDATION.md',
        ],
        verification: {
          commands: [
            'projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json',
          ],
          expected:
            'Dogfood reports proof gates, the next proof step, reviewer value, repeat use, and false-positive pressure.',
        },
      },
    ],
  },
  '3.4.x': {
    line: '3.4.x',
    track: {
      theme: 'Repo Understanding',
      outcome:
        'Working engineers can ask one command for cited map, flow, contracts, change readiness, and verification proof before editing.',
      includedInPlan: true,
      scope: [
        'cited repo map',
        'runtime flow map',
        'contract map',
        'change-readiness guidance',
        'verification proof tiers',
      ],
      successCriteria: [
        'understand exposes map, flow, contracts, change, and verify views',
        'MCP and CLI return the same report shape',
        'docs and website prompt name all shipped views',
      ],
    },
    tasks: [
      {
        id: 'rt-3-4-repo-understanding',
        priority: 'p0',
        title: 'Ship cited repo understanding',
        why: 'Real engineers need a reliable map of entrypoints, flows, contracts, change blast radius, and proof commands before they trust an agent to edit.',
        track: '3.4.x',
        files: [
          'src/core/understand.ts',
          'src/cli/commands/understand.ts',
          'src/mcp/tools/understand.ts',
          'README.md',
          'docs/WEBSITE-UPDATE-PROMPT.md',
        ],
        verification: {
          commands: [
            'projscan understand --view map --format json',
            'projscan understand --view verify --format json',
            'npm test',
          ],
          expected:
            'Understand returns cited repo, flow, contract, change-readiness, and verification maps through CLI and MCP.',
        },
      },
    ],
  },
  '3.5.x': {
    line: '3.5.x',
    track: {
      theme: 'Plugin Trust',
      outcome:
        'The surfaces that touch untrusted repositories cannot execute their code without explicit approval.',
      includedInPlan: true,
      scope: [
        'fix-layer --ignore-scripts',
        'plugin trust-on-first-use',
        'embedding model graceful degradation',
      ],
      successCriteria: [
        'projscan fix never runs a scanned repo lifecycle script',
        'plugins execute only after projscan plugin trust',
        'an embedding model-load failure degrades to BM25 instead of throwing',
      ],
    },
    tasks: [
      {
        id: 'rt-3-5-plugin-trust',
        priority: 'p1',
        title: 'Gate untrusted-repo code execution',
        why: 'A scanned repo is untrusted input; fix-layer installs and local plugins must not execute its code without explicit, per-artifact approval.',
        track: '3.5.x',
        files: ['src/fixes/eslintFix.ts', 'src/core/pluginTrust.ts', 'src/core/plugins.ts'],
        verification: {
          commands: ['npm test', 'projscan plugin trust --all'],
          expected: 'Fix installs use --ignore-scripts and plugins run only once trusted.',
        },
      },
    ],
  },
  '3.6.x': {
    line: '3.6.x',
    track: {
      theme: 'Swarm Collision Detection',
      outcome:
        'When two in-flight worktrees have overlapping blast radius, an agent learns before the changes collide.',
      includedInPlan: true,
      scope: [
        'per-worktree changed-symbol blast radius',
        'pairwise overlap detection',
        'projscan_collision MCP + CLI',
      ],
      successCriteria: [
        'collision report names overlapping worktree pairs with the files and symbols at risk',
        'blast radius reuses the impact graph',
        'stays local-first over sibling git worktrees',
      ],
    },
    tasks: [
      {
        id: 'rt-3-6-collision-detection',
        priority: 'p1',
        title: 'Detect cross-worktree change collisions',
        why: 'Parallel agents editing one repo collide when their blast radii overlap; surfacing that pre-merge is the flagship coordination value.',
        track: '3.6.x',
        files: [
          'src/core/collisionDetector.ts',
          'src/mcp/tools/collision.ts',
          'src/cli/commands/collision.ts',
        ],
        verification: {
          commands: ['projscan collisions --format json'],
          expected: 'Report lists worktree pairs whose changed-symbol blast radii overlap.',
        },
      },
    ],
  },
  '3.7.x': {
    line: '3.7.x',
    track: {
      theme: 'Claims And Leases',
      outcome:
        'An agent can claim a file, symbol, or subsystem so the swarm sees who owns what and warns on contention.',
      includedInPlan: true,
      scope: [
        'local claim store under .projscan-cache',
        'contention warnings',
        'projscan_claim MCP + CLI',
      ],
      successCriteria: [
        'claims persist locally and are scoped to the active repo',
        'overlapping claims surface a contention warning',
        'claims can be released explicitly',
      ],
    },
    tasks: [
      {
        id: 'rt-3-7-claims-leases',
        priority: 'p1',
        title: 'Add local claims / leases for swarm work',
        why: 'Coordination needs a lightweight ownership signal so two agents do not silently take the same file or symbol.',
        track: '3.7.x',
        files: ['src/core/claims.ts', 'src/mcp/tools/claim.ts', 'src/cli/commands/claim.ts'],
        verification: {
          commands: [
            'projscan claim add src/auth.ts --agent a',
            'projscan claim list --format json',
          ],
          expected: 'Claims persist locally and overlapping claims warn on contention.',
        },
      },
    ],
  },
  '3.8.x': {
    line: '3.8.x',
    track: {
      theme: 'Merge-Risk Preflight',
      outcome:
        'Given the set of in-flight worktrees, preflight returns the safe integration order and where conflict risk concentrates.',
      includedInPlan: true,
      scope: ['multi-branch preflight verdict', 'integration order', 'conflict-risk concentration'],
      successCriteria: [
        'preflight accepts multiple in-flight worktrees',
        'returns a safe integration order',
        'flags files where multiple branches and blast radii concentrate',
      ],
    },
    tasks: [
      {
        id: 'rt-3-8-merge-risk-preflight',
        priority: 'p1',
        title: 'Extend preflight to a multi-branch integration verdict',
        why: 'Once collisions and claims exist, teams need an ordering: which in-flight branch is safe to merge first.',
        track: '3.8.x',
        files: ['src/core/preflight.ts', 'src/core/collisionDetector.ts'],
        verification: {
          commands: ['projscan preflight --mode before_merge --format json'],
          expected:
            'Preflight returns integration order and conflict-risk concentration across in-flight worktrees.',
        },
      },
    ],
  },
  '3.9.x': {
    line: '3.9.x',
    track: {
      theme: 'Agent Ergonomics And Coordination Proof',
      outcome:
        'Agents reach the right capability through one budget-shaped entry point, and the coordination layer is measured for outcome value.',
      includedInPlan: true,
      scope: [
        'adaptive intent router over the tool surface',
        'budget-shaped next actions',
        'with/without coordination outcome metrics',
      ],
      successCriteria: [
        'a single entry tool routes to the right capability',
        'router output is budget-shaped and shrinks the tool-list footprint',
        'dogfood/trial reports compare task success and token cost with vs without coordination',
      ],
    },
    tasks: [
      {
        id: 'rt-3-9-agent-ergonomics-and-proof',
        priority: 'p1',
        title: 'Add an intent router and coordination outcome proof',
        why: 'A 41-tool surface costs context every turn; one adaptive entry point plus measured outcomes proves the coordination arc earns its keep.',
        track: '3.9.x',
        files: ['src/mcp/tools', 'src/core/dogfood.ts', 'src/core/trial.ts'],
        verification: {
          commands: ['projscan dogfood --format json'],
          expected:
            'Routing shrinks the tool footprint and proof reports compare with/without coordination.',
        },
      },
    ],
  },
};

export function defaultRoadmapLinesForVersion(version: string | null): string[] | undefined {
  if (!version) return undefined;
  const [major = 0, minor = 0] = version.split('.').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return undefined;
  if (major > 3 || (major === 3 && minor >= 4)) return [...ROADMAP_3_4_LINES];
  if (major === 3 && minor >= 1) return [...ROADMAP_3_2_LINES];
  return undefined;
}

export function roadmapTrackForLine(line: string): ReleaseTrainTrack | undefined {
  const entry = ROADMAP_3_2_CATALOG[line];
  return entry ? { line: entry.line, ...entry.track } : undefined;
}

export function roadmapTasksForLine(line: string): ReleaseTrainTask[] {
  return (
    ROADMAP_3_2_CATALOG[line]?.tasks.map((task) => ({
      ...task,
      files: [...task.files],
      verification: { ...task.verification, commands: [...task.verification.commands] },
    })) ?? []
  );
}
