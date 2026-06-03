import type { ReleaseTrainTask, ReleaseTrainTrack } from '../types.js';

interface RoadmapCatalogEntry {
  line: string;
  track: Omit<ReleaseTrainTrack, 'line'>;
  tasks: ReleaseTrainTask[];
}

export const ROADMAP_3_2_LINES = ['3.2.x', '3.3.x', '3.4.x', '3.5.x', '3.6.x', '3.7.x', '3.8.x', '3.9.x'] as const;
export const ROADMAP_3_4_LINES = ['3.4.x'] as const;

const ROADMAP_3_2_CATALOG: Record<string, RoadmapCatalogEntry> = {
  '3.2.x': {
    line: '3.2.x',
    track: {
      theme: 'Roadmap Canonicalization',
      outcome: 'The release-train surface names the real product roadmap instead of generic quality placeholders.',
      includedInPlan: true,
      scope: ['catalog-backed release train', 'roadmap documentation alignment', 'read-only planning evidence'],
      successCriteria: ['release-train defaults to all eight approved workstreams', 'docs/ROADMAP.md matches the generated plan', 'planning output remains read-only'],
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
          expected: 'Release train returns the eight roadmap workstreams with concrete tasks and stays read-only.',
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
      scope: ['proof-gate summaries', 'reviewer feedback prioritization', 'trial verdict explanation'],
      successCriteria: ['dogfood names the next proof step', 'trial output carries adoption blockers clearly', 'website proof remains measured and provisional until proven'],
    },
    tasks: [
      {
        id: 'rt-3-3-adoption-proof-polish',
        priority: 'p0',
        title: 'Sharpen adoption proof gates',
        why: 'Adoption validation should explain the one next action that moves a team from setup to proof.',
        track: '3.3.x',
        files: ['src/core/dogfood.ts', 'src/core/trial.ts', 'docs/ADOPTION-PROOF.md', 'docs/MARKET-VALIDATION.md'],
        verification: {
          commands: ['projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json'],
          expected: 'Dogfood reports proof gates, the next proof step, reviewer value, repeat use, and false-positive pressure.',
        },
      },
    ],
  },
  '3.4.x': {
    line: '3.4.x',
    track: {
      theme: 'Repo Understanding',
      outcome: 'Working engineers can ask one command for cited map, flow, contracts, change readiness, and verification proof before editing.',
      includedInPlan: true,
      scope: ['cited repo map', 'runtime flow map', 'contract map', 'change-readiness guidance', 'verification proof tiers'],
      successCriteria: ['understand exposes map, flow, contracts, change, and verify views', 'MCP and CLI return the same report shape', 'docs and website prompt name all shipped views'],
    },
    tasks: [
      {
        id: 'rt-3-4-repo-understanding',
        priority: 'p0',
        title: 'Ship cited repo understanding',
        why: 'Real engineers need a reliable map of entrypoints, flows, contracts, change blast radius, and proof commands before they trust an agent to edit.',
        track: '3.4.x',
        files: ['src/core/understand.ts', 'src/cli/commands/understand.ts', 'src/mcp/tools/understand.ts', 'README.md', 'docs/WEBSITE-UPDATE-PROMPT.md'],
        verification: {
          commands: ['projscan understand --view map --format json', 'projscan understand --view verify --format json', 'npm test'],
          expected: 'Understand returns cited repo, flow, contract, change-readiness, and verification maps through CLI and MCP.',
        },
      },
    ],
  },
  '3.5.x': {
    line: '3.5.x',
    track: {
      theme: 'First 10 Minutes UX',
      outcome: 'A new user gets a single guided path from trust boundary to first PR evidence.',
      includedInPlan: true,
      scope: ['first-ten-minutes command path', 'start report guidance', 'adoption docs alignment'],
      successCriteria: ['start output includes the guided path', 'docs lead with the same path', 'MCP and CLI onboarding stay consistent'],
    },
    tasks: [
      {
        id: 'rt-3-5-first-10-minutes-ux',
        priority: 'p1',
        title: 'Add first-ten-minutes guidance',
        why: 'The broad command catalog should not be the first experience for a new team.',
        track: '3.5.x',
        files: ['src/core/start.ts', 'src/core/adoption.ts', 'docs/FIRST-10-MINUTES.md'],
        verification: {
          commands: ['projscan start --mode before_edit --format json', 'projscan first-run --format json'],
          expected: 'Start and first-run surfaces point to the same first-ten-minutes path.',
        },
      },
    ],
  },
  '3.6.x': {
    line: '3.6.x',
    track: {
      theme: 'Maintainability Hardening',
      outcome: 'Future roadmap and evidence changes land in smaller focused modules instead of growing hotspots.',
      includedInPlan: true,
      scope: ['roadmap catalog extraction', 'evidence formatting boundaries', 'stable public exports'],
      successCriteria: ['core orchestration remains small and readable', 'public API exports remain stable', 'focused tests cover extracted helpers'],
    },
    tasks: [
      {
        id: 'rt-3-6-maintainability-hardening',
        priority: 'p1',
        title: 'Extract planning and evidence helpers',
        why: 'The product surface is large enough that static planning data and formatting helpers need clear ownership.',
        track: '3.6.x',
        files: ['src/core/roadmapCatalog.ts', 'src/core/releaseTrain.ts', 'src/core/releaseEvidence.ts', 'src/types.ts'],
        verification: {
          commands: ['npm run build', 'npm test'],
          expected: 'Extraction preserves stable exports, output schemas, and test behavior.',
        },
      },
    ],
  },
  '3.7.x': {
    line: '3.7.x',
    track: {
      theme: 'Graph And Dataflow Precision',
      outcome: 'Dataflow catches one more real framework source pattern while keeping false positives narrow.',
      includedInPlan: true,
      scope: ['framework request-source precision', 'review-time dataflow calibration', 'false-positive guard tests'],
      successCriteria: ['new source pattern is detected', 'unrelated helpers are not treated as request data', 'generated and test filters remain quiet by default'],
    },
    tasks: [
      {
        id: 'rt-3-7-graph-dataflow-precision',
        priority: 'p1',
        title: 'Add a narrow framework dataflow precision pass',
        why: 'The graph/dataflow moat improves only when new precision comes with false-positive guardrails.',
        track: '3.7.x',
        files: ['src/core/frameworkSources.ts', 'src/core/dataflow.ts', 'tests/core/dataflow.test.ts'],
        verification: {
          commands: ['projscan dataflow --format json', 'npm test'],
          expected: 'Dataflow reports the new framework source pattern and avoids unrelated helper calls.',
        },
      },
    ],
  },
  '3.8.x': {
    line: '3.8.x',
    track: {
      theme: 'Plugin Ecosystem',
      outcome: 'Teams can validate local policy plugins with clearer trust and context-readiness guidance.',
      includedInPlan: true,
      scope: ['plugin test result guidance', 'trust reminder', 'gallery and authoring docs'],
      successCriteria: ['plugin test output names trust boundaries', 'graph/dataflow context needs are visible', 'docs show copyable validation commands'],
    },
    tasks: [
      {
        id: 'rt-3-8-plugin-ecosystem',
        priority: 'p1',
        title: 'Improve local plugin authoring feedback',
        why: 'Plugins are useful when teams can test local policy safely before enabling execution.',
        track: '3.8.x',
        files: ['src/core/pluginDx.ts', 'tests/core/pluginDx.test.ts', 'docs/PLUGIN-AUTHORING.md', 'docs/PLUGIN-GALLERY.md'],
        verification: {
          commands: ['projscan plugin test docs/examples/plugins/policy.projscan-plugin.json --format json'],
          expected: 'Plugin test output includes trust guidance, validation commands, and context capability notes.',
        },
      },
    ],
  },
  '3.9.x': {
    line: '3.9.x',
    track: {
      theme: 'Multi-Agent Coordination',
      outcome: 'Agents can tell current worktree risk from remembered session context before parallel edits continue.',
      includedInPlan: true,
      scope: ['coordination hints', 'session resource clarity', 'agent brief handoff commands'],
      successCriteria: ['resources explain current-vs-remembered risk', 'agent briefs include conflict-resolution commands', 'start output keeps the distinction visible'],
    },
    tasks: [
      {
        id: 'rt-3-9-multi-agent-coordination',
        priority: 'p1',
        title: 'Add compact multi-agent coordination hints',
        why: 'Shared session state helps only when agents understand whether a signal is current worktree evidence or older remembered context.',
        track: '3.9.x',
        files: ['src/core/sessionResources.ts', 'src/core/agentBrief.ts', 'src/core/start.ts'],
        verification: {
          commands: ['projscan agent-brief --format json', 'projscan session current --format json'],
          expected: 'Coordination surfaces include current-vs-remembered hints and exact follow-up commands.',
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
  return ROADMAP_3_2_CATALOG[line]?.tasks.map((task) => ({ ...task, files: [...task.files], verification: { ...task.verification, commands: [...task.verification.commands] } })) ?? [];
}
