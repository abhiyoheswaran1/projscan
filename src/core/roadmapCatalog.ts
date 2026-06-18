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
export const ROADMAP_POST_4_4_LINES = [
  '4.5.x',
  '4.6.x',
  '4.7.x',
  '4.8.x',
  '4.9.x',
] as const;

const DEFAULT_ROADMAP_LINE_RULES = [
  { minimumMajor: 4, minimumMinor: 4, lines: ROADMAP_POST_4_4_LINES },
  { minimumMajor: 3, minimumMinor: 4, lines: ROADMAP_3_4_LINES },
  { minimumMajor: 3, minimumMinor: 1, lines: ROADMAP_3_2_LINES },
] as const;

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
  '4.5.x': {
    line: '4.5.x',
    track: {
      theme: 'Roadmap And Release-Train Reliability',
      outcome:
        'Planning surfaces describe the current post-4.4 product direction instead of stale shipped 3.x/4.0 work.',
      includedInPlan: true,
      scope: [
        'post-4.4 roadmap refresh',
        'release-train default-line refresh',
        'product-planning route verification',
      ],
      successCriteria: [
        'release-train defaults to post-4.4 lines on 4.4.x and newer',
        'docs/ROADMAP.md names already-shipped 4.0 through 4.4 work as completed',
        'planning output remains read-only and does not bump versions',
      ],
    },
    tasks: [
      {
        id: 'rt-4-5-roadmap-release-train-refresh',
        priority: 'p0',
        title: 'Refresh roadmap and release-train surfaces',
        why: 'Maintainers and agents should see the real next product bets after 4.4.0 instead of a completed 3.4/3.6/4.0 plan.',
        track: '4.5.x',
        files: [
          'src/core/roadmapCatalog.ts',
          'src/core/releaseTrain.ts',
          'docs/ROADMAP.md',
          'docs/GUIDE.md',
        ],
        verification: {
          commands: [
            'projscan release-train --format json',
            'projscan start --intent "what should we build next?" --format json',
          ],
          expected:
            'Planning output names post-4.4 workstreams and stays read-only without package version changes.',
        },
      },
    ],
  },
  '4.6.x': {
    line: '4.6.x',
    track: {
      theme: 'Swarm Coordination Evidence',
      outcome:
        'Teams can validate which coordination commands agents actually use before investing in deeper swarm automation.',
      includedInPlan: true,
      scope: [
        'coordination workflow examples',
        'claims and collision evidence recipes',
        'coordinate-watch adoption proof',
      ],
      successCriteria: [
        'docs show a real local workflow for collisions, claims, merge-risk, coordinate, and coordinate --watch',
        'agent-brief and preflight coordination evidence stay separated from remembered session context',
        'validation examples stay local-first and require no daemon or cloud service',
      ],
    },
    tasks: [
      {
        id: 'rt-4-6-swarm-coordination-validation',
        priority: 'p0',
        title: 'Validate swarm coordination in real agent workflows',
        why: 'The coordination surface is only valuable if teams can see where it prevents collisions and which command answered the coordination question.',
        track: '4.6.x',
        files: [
          'docs/GUIDE.md',
          'README.md',
          'docs/examples/swarm-coordination.md',
          'src/core/agentBrief.ts',
          'src/core/preflight.ts',
        ],
        verification: {
          commands: [
            'projscan collisions --format json',
            'projscan coordinate --format json',
            'projscan preflight --mode before_edit --format json',
            'projscan agent-brief --format json',
          ],
          expected:
            'Coordination evidence names the active command path, current worktree state, preflight proof path, and local-only validation workflow.',
        },
      },
    ],
  },
  '4.7.x': {
    line: '4.7.x',
    track: {
      theme: 'Framework Dataflow Precision',
      outcome:
        'Framework-specific request sources continue to expand through narrow, tested source patterns instead of broad name matching.',
      includedInPlan: true,
      scope: [
        'Fastify and Koa request source coverage',
        'receiver-sensitive database sink checks',
        'regression fixtures for false-positive suppression',
      ],
      successCriteria: [
        'dataflow detects tested framework request sources into database sinks',
        'ordinary helper functions with similar names stay quiet',
        'custom source and sink configuration still overrides defaults',
      ],
    },
    tasks: [
      {
        id: 'rt-4-7-framework-dataflow-precision',
        priority: 'p1',
        title: 'Broaden framework dataflow precision',
        why: 'Deeper framework precision is the right static-analysis moat when it is added as small tested patterns.',
        track: '4.7.x',
        files: ['src/core/frameworkSources.ts', 'src/core/dataflow.ts', 'tests/core/dataflow.test.ts'],
        verification: {
          commands: ['npm run test -- tests/core/dataflow.test.ts', 'projscan dataflow --format json'],
          expected:
            'New framework request-source fixtures report real source-to-sink paths and suppress lookalike helpers.',
        },
      },
    ],
  },
  '4.8.x': {
    line: '4.8.x',
    track: {
      theme: 'Scoped Evidence Exports',
      outcome:
        'Teams can share report artifacts with scoped or redacted paths without exposing broader repository structure.',
      includedInPlan: true,
      scope: [
        'path-scope filtering',
        'stable path redaction labels',
        'SARIF and JSON evidence shaping',
      ],
      successCriteria: [
        'issue reports can be filtered to a requested path scope',
        'redacted reports replace file paths with stable labels',
        'redaction never reads .env values or adds network calls',
      ],
    },
    tasks: [
      {
        id: 'rt-4-8-scoped-redacted-evidence',
        priority: 'p1',
        title: 'Add scoped and redacted report export controls',
        why: 'Security reviewers need useful artifacts they can share without leaking paths outside the reviewed area.',
        track: '4.8.x',
        files: [
          'src/core/reportScope.ts',
          'src/cli/commands/analyze.ts',
          'src/cli/commands/doctor.ts',
          'src/cli/commands/ci.ts',
          'src/reporters/sarifReporter.ts',
        ],
        verification: {
          commands: [
            'projscan doctor --report-scope src --redact-paths --format json',
            'projscan analyze --report-scope src --redact-paths --format sarif',
          ],
          expected:
            'Reports include only scoped issue evidence and expose redacted path labels instead of raw file paths.',
        },
      },
    ],
  },
  '4.9.x': {
    line: '4.9.x',
    track: {
      theme: 'Python Upgrade Intelligence And Hotspot Maintainability',
      outcome:
        'Python dependency upgrade previews become useful offline, while the highest-churn projscan surfaces keep shrinking through focused tests and extraction.',
      includedInPlan: true,
      scope: [
        'requirements.txt and Poetry dependency lookup',
        'Python importers for upgrade preview',
        'start/types/test hotspot coverage and extraction',
        'real adoption examples for orchestration, ownership, and plugins',
      ],
      successCriteria: [
        'projscan_upgrade can preview Python dependencies from local manifests',
        'README and guide no longer describe Python upgrade support as only planned',
        'hotspot work adds focused coverage or extraction without unrelated refactors',
        'docs include concrete adoption examples for agent orchestration, package ownership, and policy plugins',
      ],
    },
    tasks: [
      {
        id: 'rt-4-9-python-upgrade-and-hotspot-maintainability',
        priority: 'p1',
        title: 'Ship Python upgrade intelligence and keep reducing hotspots',
        why: 'Python repos should get the same offline upgrade impact preview as Node repos, and the repo should keep paying down known high-churn surfaces.',
        track: '4.9.x',
        files: [
          'src/core/upgradePreview.ts',
          'src/core/languages/pythonManifests.ts',
          'src/types/dependencyHealth.ts',
          'tests/core/upgradePreview.test.ts',
          'src/core/start.ts',
          'src/types.ts',
          'tests/core/start.test.ts',
        ],
        verification: {
          commands: [
            'npm run test -- tests/core/upgradePreview.test.ts tests/mcp/pythonUpgradeFallback.test.ts',
            'npm run typecheck:public-types',
            'projscan hotspots --format json',
          ],
          expected:
            'Python upgrade previews return declared versions and importers, public types compile, and hotspot risk is covered or explicitly deferred.',
        },
      },
    ],
  },
};

export function defaultRoadmapLinesForVersion(version: string | null): string[] | undefined {
  if (!version) return undefined;
  const roadmapVersion = roadmapVersionParts(version);
  if (!roadmapVersion) return undefined;
  const rule = DEFAULT_ROADMAP_LINE_RULES.find((candidate) =>
    isAtLeastRoadmapVersion(roadmapVersion, candidate),
  );
  return rule ? [...rule.lines] : undefined;
}

function roadmapVersionParts(version: string): { major: number; minor: number } | null {
  const [majorPart, minorPart = '0'] = version.split('.');
  const major = Number.parseInt(majorPart ?? '', 10);
  const minor = Number.parseInt(minorPart, 10);
  return Number.isFinite(major) && Number.isFinite(minor) ? { major, minor } : null;
}

function isAtLeastRoadmapVersion(
  version: { major: number; minor: number },
  rule: (typeof DEFAULT_ROADMAP_LINE_RULES)[number],
): boolean {
  return (
    version.major > rule.minimumMajor ||
    (version.major === rule.minimumMajor && version.minor >= rule.minimumMinor)
  );
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
