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
        handoff:
          'If preflight returns caution or block, follow suggestedNextActions before editing.',
      },
      {
        id: 'team_bootstrap',
        name: 'Team Bootstrap',
        useWhen: 'Adopt projscan for a team or new repository.',
        outcome:
          'A team policy, PR workflow, ownership starter, baseline memory, MCP setup check, and first start report that make adoption repeatable.',
        commands: [
          'projscan init team --team platform',
          'projscan start --mode before_edit --format json',
          'projscan mcp doctor --client codex --format json',
        ],
        mcpTools: ['projscan_adoption', 'projscan_start'],
        handoff:
          'Run init team once, commit the generated policy/workflow/ownership/baseline files, then tune thresholds after the first PR.',
      },
      {
        id: 'pr_automation',
        name: 'PR Automation',
        useWhen: 'Put projscan evidence directly in pull request review.',
        outcome:
          'Pull requests receive an approval comment and fail CI only when preflight returns block.',
        commands: [
          'projscan init github-action',
          'projscan preflight --mode before_merge --format json',
          'projscan evidence-pack --pr-comment',
        ],
        mcpTools: ['projscan_preflight', 'projscan_evidence_pack'],
        handoff:
          'Treat block as a hard CI failure; use PR comment next actions for caution-level follow-up.',
      },
      {
        id: 'bug_hunt',
        name: 'Bug Hunt',
        useWhen: 'Run a focused polish or stabilization pass.',
        outcome: 'A ranked action queue with evidence and verification commands.',
        commands: [
          'projscan bug-hunt --format json',
          'projscan quality-scorecard --format json',
          'projscan regression-plan --level focused --format json',
        ],
        mcpTools: ['projscan_bug_hunt', 'projscan_quality_scorecard', 'projscan_regression_plan'],
        handoff: 'Fix top-ranked targets first, then rerun the regression plan.',
      },
      {
        id: 'before_handoff',
        name: 'Before handoff or commit',
        useWhen: 'Check a branch before committing or handing it to a reviewer.',
        outcome: 'Concrete fix targets, manual review gates, and proof commands are separated.',
        commands: [
          'projscan bug-hunt --format json',
          'projscan preflight --mode before_commit --format json',
          'projscan evidence-pack --pr-comment',
        ],
        mcpTools: ['projscan_bug_hunt', 'projscan_preflight', 'projscan_evidence_pack'],
        handoff:
          'Fix concrete blockers first, document manual review gates, then share the evidence pack.',
      },
      {
        id: 'release_approval',
        name: 'Release Approval',
        useWhen: 'Prepare a maintainer or CI environment approval packet.',
        outcome:
          'Version readiness, risks, regression commands, and website update copy in one loop.',
        commands: [
          'projscan release-train --format json',
          'projscan evidence-pack --website-prompt --format json',
          'projscan regression-plan --level full --format json',
        ],
        mcpTools: ['projscan_release_train', 'projscan_evidence_pack', 'projscan_regression_plan'],
        handoff:
          'Use the evidence pack as the approval artifact; do not skip the full release gate.',
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
