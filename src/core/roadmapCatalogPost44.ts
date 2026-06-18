import type { RoadmapCatalogEntry } from './roadmapCatalogTypes.js';

export const ROADMAP_POST_4_4_CATALOG: Record<string, RoadmapCatalogEntry> = {
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
