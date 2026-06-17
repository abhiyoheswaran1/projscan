import type { ReleaseTrainTask, ReleaseTrainTrack } from '../types.js';

export function fallbackTrackForLine(line: string): ReleaseTrainTrack {
  if (line.startsWith('3.0')) {
    return {
      line,
      theme: 'Graph Operations Readiness',
      outcome:
        'Agents can trust graph-backed review, impact, dataflow, and release gates during everyday repo work.',
      includedInPlan: true,
      scope: [
        'graph corpus release gate',
        'dataflow precision hardening',
        'ownership-aware impact',
      ],
      successCriteria: [
        'release readiness runs the graph corpus baseline gate',
        'custom dataflow rules stay visible when users configure them',
        'impact boundary summaries identify likely owners when metadata exists',
      ],
    };
  }
  if (line.startsWith('3.1')) {
    return {
      line,
      theme: 'Graph Intelligence Expansion',
      outcome:
        'Agents get narrower package-scoped evidence and richer framework-aware dataflow before editing high-risk paths.',
      includedInPlan: true,
      scope: [
        'package-scoped review evidence',
        'framework route dataflow precision',
        'deeper ownership and package boundary metadata',
      ],
      successCriteria: [
        'review package filters apply to taint, dataflow, graph evidence, and verdicts',
        'route and request-handler dataflow avoids generated-code noise',
        'impact reports keep ownership context without expanding the stable schema',
      ],
    };
  }
  if (line.startsWith('2.3')) {
    return {
      line,
      theme: 'Agent Mission Control',
      outcome:
        'Agents can decide what to do next, hand off safely, and prove readiness without rereading the whole repo.',
      includedInPlan: true,
      scope: ['prioritized workplans', 'handoff-ready next actions', 'readiness planning'],
      successCriteria: [
        'MCP and CLI expose the same planning contracts',
        'plans include evidence, priority, and verification commands',
        'planning output stays read-only',
      ],
    };
  }
  if (line.startsWith('2.4')) {
    return {
      line,
      theme: 'Autonomous Bug Hunt',
      outcome:
        'Agents get a ranked action queue that combines health, preflight, hotspots, and coordination evidence.',
      includedInPlan: true,
      scope: ['bug-hunt action queue', 'verification matrix', 'broad test-suite reliability pass'],
      successCriteria: [
        'bug-hunt output names the first prioritized action and commands to prove it',
        'clean repos still receive reproducible verification guidance',
        'full project verification passes from the committed tree',
      ],
    };
  }
  if (line.startsWith('2.5')) {
    return {
      line,
      theme: 'Release Evidence Pack',
      outcome:
        'Humans and agents get one approval packet that ties product scope, preflight evidence, bug-hunt status, workplan tasks, and website-update copy together.',
      includedInPlan: true,
      scope: [
        'approval-ready evidence packet',
        'product-facing changelog and website prompt',
        'read-only evidence gathering',
      ],
      successCriteria: [
        'evidence pack includes planning, bug hunt, workplan, and preflight artifacts',
        'website update prompt is generated only as text evidence',
        'evidence generation stays read-only',
      ],
    };
  }
  if (line.startsWith('2.6')) {
    return {
      line,
      theme: 'Regression Planning',
      outcome:
        'Agents get a smoke, focused, or full regression matrix that turns product risk into concrete verification commands.',
      includedInPlan: true,
      scope: [
        'risk-based regression targets',
        'smoke/focused/full verification levels',
        'deduplicated command matrix',
      ],
      successCriteria: [
        'regression plan includes commands for the selected level',
        'bug-hunt and preflight signals become explicit regression targets',
        'full level covers tests, build, lint, stability, and package checks',
      ],
    };
  }
  if (line.startsWith('2.7')) {
    return {
      line,
      theme: 'Agent Brief',
      outcome:
        'Agents get a compact context packet with focus items, repo context, guardrails, and suggested next actions.',
      includedInPlan: true,
      scope: ['next-agent focus packet', 'guardrail commands', 'session and repo context summary'],
      successCriteria: [
        'brief includes health, context, focus, guardrails, and next actions',
        'CLI and MCP expose the same schema',
        'brief output stays compact enough for handoff',
      ],
    };
  }
  if (line.startsWith('2.8')) {
    return {
      line,
      theme: 'Quality Scorecard',
      outcome:
        'Agents and reviewers get a dimensioned quality view with top risks and verification commands.',
      includedInPlan: true,
      scope: ['quality dimensions', 'top-risk ranking', 'verification command set'],
      successCriteria: [
        'scorecard reports health, security, tests, maintainability, and coordination',
        'top risks include concrete commands',
        'CLI and MCP expose the same scorecard schema',
      ],
    };
  }
  return {
    line,
    theme: 'Quality Hardening',
    outcome: 'The line gets explicit readiness checks.',
    includedInPlan: true,
    scope: ['quality fixes', 'documentation alignment', 'readiness checks'],
    successCriteria: ['all checks pass', 'public surface is documented', 'planning output stays read-only'],
  };
}

export function fallbackTasksForTrack(track: ReleaseTrainTrack): ReleaseTrainTask[] {
  if (track.line.startsWith('3.0')) {
    return [
      {
        id: 'rt-3-0-graph-readiness',
        priority: 'p0',
        title: 'Harden graph operations readiness',
        why: 'Agents trust projscan when graph/dataflow signals are gated, precise, and routed to the right owners.',
        track: track.line,
        files: ['scripts/release-check.mjs', 'src/core/dataflowFilters.ts', 'src/core/impact.ts'],
        verification: {
          commands: [
            'npm run release:check',
            'npm run check:graph-corpus',
            'projscan impact --symbol foo --cross-repo --format json',
          ],
          expected:
            'Release readiness includes graph corpus checks, custom dataflow rules remain visible, and impact reports ownership boundaries.',
        },
      },
    ];
  }
  if (track.line.startsWith('3.1')) {
    return [
      {
        id: 'rt-3-1-graph-expansion',
        priority: 'p1',
        title: 'Expand graph intelligence precision',
        why: 'The next product step should make high-risk review evidence narrower and framework-aware without forcing agents to inspect full graphs.',
        track: track.line,
        files: ['src/core/review.ts', 'src/core/dataflow.ts', 'src/core/impact.ts'],
        verification: {
          commands: [
            'projscan review --base main --head HEAD --format json',
            'projscan dataflow --format json',
          ],
          expected:
            'Review and dataflow evidence are scoped to the relevant package, route, and ownership boundaries.',
        },
      },
    ];
  }
  if (track.line.startsWith('2.3')) {
    return [
      {
        id: 'rt-2-3-agent-readiness',
        priority: 'p0',
        title: 'Finish agent mission-control readiness',
        why: 'Planning tools only matter if they produce short, ordered, evidence-backed actions that another agent can execute.',
        track: track.line,
        files: [
          'src/core/workplan.ts',
          'src/cli/commands/workplan.ts',
          'src/mcp/tools/workplan.ts',
        ],
        verification: {
          commands: ['projscan workplan --mode release --format json', 'projscan handoff'],
          expected:
            'Workplan and handoff both include prioritized tasks and verification commands.',
        },
      },
    ];
  }
  if (track.line.startsWith('2.4')) {
    return [
      {
        id: 'rt-2-4-bug-hunt-gate',
        priority: 'p0',
        title: 'Ship the autonomous bug-hunt gate',
        why: 'Before a larger release, the product should tell agents where to polish first and how to prove each fix.',
        track: track.line,
        files: ['src/core/bugHunt.ts', 'src/cli/commands/bugHunt.ts', 'src/mcp/tools/bugHunt.ts'],
        verification: {
          commands: ['projscan bug-hunt --format json', 'npm test'],
          expected: 'Bug hunt returns a prioritized action queue and the test suite passes.',
        },
      },
    ];
  }
  if (track.line.startsWith('2.5')) {
    return [
      {
        id: 'rt-2-5-evidence-pack',
        priority: 'p0',
        title: 'Assemble the release evidence pack',
        why: 'A larger product update needs one human-readable evidence packet instead of scattered command output.',
        track: track.line,
        files: [
          'src/core/releaseEvidence.ts',
          'src/cli/commands/evidencePack.ts',
          'src/mcp/tools/evidencePack.ts',
        ],
        verification: {
          commands: [
            'projscan evidence-pack --line 2.3.x --line 2.4.x --line 2.5.x --line 2.6.x --line 2.7.x --line 2.8.x --format json',
          ],
          expected:
            'Evidence pack returns all planned lines, approval evidence, and changelog entries.',
        },
      },
    ];
  }
  if (track.line.startsWith('2.6')) {
    return [
      {
        id: 'rt-2-6-regression-plan',
        priority: 'p0',
        title: 'Ship the regression planning matrix',
        why: 'A bigger product update should tell agents exactly which smoke, focused, and full checks prove readiness.',
        track: track.line,
        files: [
          'src/core/regressionPlan.ts',
          'src/cli/commands/regressionPlan.ts',
          'src/mcp/tools/regressionPlan.ts',
        ],
        verification: {
          commands: ['projscan regression-plan --level full --format json', 'npm test'],
          expected:
            'Regression plan returns a deduplicated command matrix and the project suite passes.',
        },
      },
    ];
  }
  if (track.line.startsWith('2.7')) {
    return [
      {
        id: 'rt-2-7-agent-brief',
        priority: 'p0',
        title: 'Ship the agent brief',
        why: 'Agents need a compact context packet that can be read quickly before choosing the next action.',
        track: track.line,
        files: [
          'src/core/agentBrief.ts',
          'src/cli/commands/agentBrief.ts',
          'src/mcp/tools/agentBrief.ts',
        ],
        verification: {
          commands: ['projscan agent-brief --intent release --format json'],
          expected: 'Agent brief returns focus, context, guardrails, and suggested next actions.',
        },
      },
    ];
  }
  if (track.line.startsWith('2.8')) {
    return [
      {
        id: 'rt-2-8-quality-scorecard',
        priority: 'p0',
        title: 'Ship the quality scorecard',
        why: 'Agents and reviewers need a dimensioned quality view before deciding what to polish next.',
        track: track.line,
        files: [
          'src/core/qualityScorecard.ts',
          'src/cli/commands/qualityScorecard.ts',
          'src/mcp/tools/qualityScorecard.ts',
        ],
        verification: {
          commands: ['projscan quality-scorecard --format json'],
          expected: 'Quality scorecard returns dimensions, top risks, and verification commands.',
        },
      },
    ];
  }
  return [
    {
      id: `rt-${slug(track.line)}-quality`,
      priority: 'p1',
      title: `Plan ${track.line} quality work`,
      why: 'Every product line needs an explicit verification task.',
      track: track.line,
      files: [],
      verification: {
        commands: ['npm test', 'npm run lint'],
        expected: 'Quality checks pass for this product line.',
      },
    },
  ];
}

function slug(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'line'
  );
}
