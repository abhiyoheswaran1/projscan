import { describe, expect, it } from 'vitest';
import { routeIntent } from '../../src/core/intentRouter.js';

describe('routeIntent coordination and work routing', () => {
  it('routes coordination intents to the swarm tools', () => {
    const result = routeIntent('coordinate parallel agents working the same repo');
    const tools = result.matches.map((m) => m.tool);
    expect(tools).toContain('projscan_collision');
  });

  it('routes coordination status questions to the one-call swarm report first', () => {
    const result = routeIntent('show coordination status for parallel agents');
    const collision = result.matches.find((match) => match.tool === 'projscan_collision');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Swarm coordination',
        tool: 'projscan_coordinate',
        cli: 'projscan coordinate',
        confidence: 'high',
        matchedKeywords: ['coordination', 'status', 'parallel', 'agents'],
      }),
    );
    expect(collision).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['coordination', 'parallel', 'agents']),
      }),
    );
    expect(result.matches[0].score).toBeGreaterThan(collision?.score ?? 0);
  });

  it('routes who-else-is-working questions to the one-call coordination report', () => {
    const result = routeIntent('who else is working on this');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Swarm coordination',
        tool: 'projscan_coordinate',
        cli: 'projscan coordinate',
        confidence: 'high',
        score: 6,
        matchedKeywords: ['who', 'else', 'working'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_claim')).toBeUndefined();
  });

  it('routes collision and active-worktree wording to the right swarm surfaces', () => {
    const collide = routeIntent('am I going to collide with another agent');

    expect(collide.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Swarm coordination',
        tool: 'projscan_coordinate',
        cli: 'projscan coordinate',
        confidence: 'high',
        matchedKeywords: ['agent', 'collide'],
      }),
    );
    expect(collide.matches.find((match) => match.tool === 'projscan_agent_brief')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['agent'],
      }),
    );

    const active = routeIntent('what worktrees are active');
    expect(active.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_coordinate',
        confidence: 'high',
        matchedKeywords: ['worktrees', 'active'],
      }),
    );

    const editing = routeIntent('who is editing auth right now');
    expect(editing.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_coordinate',
        confidence: 'high',
        matchedKeywords: ['who', 'editing'],
      }),
    );
  });

  it('routes merge-order shorthand away from bug-hunt first-fix wording', () => {
    const mergeFirst = routeIntent('what should merge first');

    expect(mergeFirst.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Swarm coordination',
        tool: 'projscan_merge_risk',
        cli: 'projscan merge-risk',
        confidence: 'high',
        matchedKeywords: ['merge', 'first'],
      }),
    );
    expect(mergeFirst.matches.find((match) => match.tool === 'projscan_bug_hunt')).toBeUndefined();

    const branchFirst = routeIntent('which branch should merge first');
    expect(branchFirst.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_merge_risk',
        confidence: 'high',
        matchedKeywords: ['merge', 'first', 'branch'],
      }),
    );
  });

  it('routes overlapping change questions to collision detection before generic PR diff', () => {
    const result = routeIntent('show me overlapping changes');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Swarm coordination',
        tool: 'projscan_collision',
        cli: 'projscan collisions',
        confidence: 'high',
        matchedKeywords: ['overlapping', 'changes'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_pr_diff')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['changes'],
      }),
    );
  });

  it('routes "is it safe to commit" to preflight', () => {
    const result = routeIntent('is it safe to commit this change');
    expect(result.matches[0].tool).toBe('projscan_preflight');
    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        confidence: 'high',
        score: 2,
        matchedKeywords: ['safe', 'commit'],
      }),
    );
  });

  it('routes quick-win and low-risk improvement wording to bug hunt', () => {
    const quickWin = routeIntent('find a quick win');

    expect(quickWin.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_bug_hunt',
        cli: 'projscan bug-hunt',
        confidence: 'high',
        matchedKeywords: ['quick', 'find', 'win'],
      }),
    );

    const lowRisk = routeIntent('what is a low risk improvement');
    expect(lowRisk.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        confidence: 'high',
        matchedKeywords: ['low', 'improvement'],
      }),
    );
    expect(lowRisk.matches.find((match) => match.tool === 'projscan_quality_scorecard')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['risk'],
      }),
    );

    const smallTask = routeIntent('pick a small safe task');
    expect(smallTask.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        confidence: 'high',
        matchedKeywords: ['small', 'task'],
      }),
    );

    const tenMinutes = routeIntent('what can I improve in 10 minutes');
    expect(tenMinutes.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        confidence: 'high',
        matchedKeywords: ['improve', 'minutes'],
      }),
    );

    const lowestFix = routeIntent('what is the lowest risk fix');
    expect(lowestFix.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        confidence: 'high',
        matchedKeywords: ['lowest', 'fix'],
      }),
    );
  });

  it('routes broad improve next wording to bug hunt without stealing technical improve next intents', () => {
    const improveNext = routeIntent('what should we improve next');

    expect(improveNext.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_bug_hunt',
        cli: 'projscan bug-hunt',
        confidence: 'high',
        matchedKeywords: ['improve'],
      }),
    );

    const testImprovement = routeIntent('what should we improve next in tests');
    expect(testImprovement.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: ['tests'],
      }),
    );

    const performanceImprovement = routeIntent('what should we improve next in performance');
    expect(performanceImprovement.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_hotspots',
        confidence: 'high',
        matchedKeywords: ['performance'],
      }),
    );

    const releaseImprovement = routeIntent('what should we improve next before release');
    expect(releaseImprovement.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_release_train',
        matchedKeywords: ['release'],
      }),
    );

    const dependencyImprovement = routeIntent('what should we improve next for dependencies');
    expect(dependencyImprovement.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dependencies',
        confidence: 'high',
        matchedKeywords: ['dependencies'],
      }),
    );

    const safetyImprovement = routeIntent('what should we improve next for safety');
    expect(safetyImprovement.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_preflight',
        matchedKeywords: ['safety'],
      }),
    );
  });

  it('does not treat prohibited release actions as the requested route', () => {
    const result = routeIntent(
      'continue autonomous no-release roadmap validation implementation; do not release publish tag push merge deploy or bump version',
    );

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_workplan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['do', 'roadmap']),
      }),
    );
    expect(result.matches.slice(0, 3).map((match) => match.tool)).not.toContain(
      'projscan_release_train',
    );
    expect(result.matches.slice(0, 3).map((match) => match.tool)).not.toContain(
      'projscan_upgrade',
    );
  });

  it('routes product-planning wording to high-confidence workplan', () => {
    const buildNext = routeIntent('what should we build next');

    expect(buildNext.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_workplan',
        cli: 'projscan workplan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['build', 'next']),
      }),
    );
    expect(buildNext.matches[0]?.matchedKeywords).not.toEqual(['next']);

    const roadmap = routeIntent('plan the product roadmap');
    expect(roadmap.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_workplan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['plan', 'product', 'roadmap']),
      }),
    );
  });

  it('keeps bug-hunt route metadata on action-queue wording', () => {
    const result = routeIntent('what should I fix first?');
    const bugHunt = result.matches[0];

    expect(bugHunt).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        what: expect.stringContaining('Ranked action queue'),
      }),
    );
    expect(bugHunt?.what).not.toContain('fix queue');
  });

  it('routes blocker-discovery questions to preflight before weak PR matches', () => {
    const result = routeIntent('what is blocking this PR');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Safety gate',
        tool: 'projscan_preflight',
        cli: 'projscan preflight',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['blocking'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_review')).toEqual(
      expect.objectContaining({
        confidence: 'low',
        score: 0.25,
        matchedKeywords: ['pr'],
      }),
    );

    const generic = routeIntent('what blockers are there');
    expect(generic.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_preflight',
        matchedKeywords: ['blockers'],
      }),
    );
  });

  it('routes merge-readiness questions to preflight without hijacking PR readiness', () => {
    const result = routeIntent('is my branch ready to merge');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Safety gate',
        tool: 'projscan_preflight',
        cli: 'projscan preflight',
        confidence: 'high',
        score: 3,
        matchedKeywords: ['merge', 'ready'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_merge_risk')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        score: 1,
        matchedKeywords: ['merge'],
      }),
    );

    const prReadiness = routeIntent('am I ready to open a PR');
    expect(prReadiness.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_evidence_pack',
        matchedKeywords: ['ready', 'open', 'pr'],
      }),
    );
    expect(
      prReadiness.matches.find((match) => match.tool === 'projscan_preflight'),
    ).toBeUndefined();
  });

  it('routes quality and risk picture questions to the scorecard', () => {
    const result = routeIntent('what is risky in this repo');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Health',
        tool: 'projscan_quality_scorecard',
        cli: 'projscan quality-scorecard',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['risky'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_preflight')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        matchedKeywords: ['risky'],
      }),
    );
  });

  it('routes dead-code cleanup questions to doctor', () => {
    const result = routeIntent('find dead code and unused exports I can delete');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Health',
        tool: 'projscan_doctor',
        cli: 'projscan doctor',
        confidence: 'high',
        score: 5,
        matchedKeywords: ['dead', 'unused'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_impact')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        score: 2,
        matchedKeywords: ['delete'],
      }),
    );

    const deadCode = routeIntent('find dead code');
    expect(deadCode.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_doctor',
        confidence: 'high',
        matchedKeywords: ['dead'],
      }),
    );
    expect(deadCode.matches.find((match) => match.tool === 'projscan_search')).toBeUndefined();

    const unusedExports = routeIntent('find unused exports');
    expect(unusedExports.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_doctor',
        confidence: 'high',
        score: 3,
        matchedKeywords: ['unused'],
      }),
    );
  });

  it('includes route confidence metadata for bug-fix intents', () => {
    const result = routeIntent('find bugs to fix before the PR');
    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        confidence: 'high',
        score: 2.75,
        matchedKeywords: ['bugs', 'find', 'fix', 'pr'],
      }),
    );
  });

  it('routes first-fix prioritization intents to bug hunt instead of issue-specific fix suggest', () => {
    const result = routeIntent('what should I fix first');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        confidence: 'high',
        score: 2.25,
        matchedKeywords: ['first', 'fix'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_fix_suggest')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        score: 1,
        matchedKeywords: ['fix'],
      }),
    );
  });

  it('routes fastest safe fix questions to bug-hunt before generic preflight', () => {
    const result = routeIntent('what is the fastest safe fix');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_bug_hunt',
        cli: 'projscan bug-hunt',
        confidence: 'high',
        score: 2.25,
        matchedKeywords: ['fastest', 'fix'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_preflight')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        matchedKeywords: ['safe'],
      }),
    );
  });

  it('routes next-agent handoff requests to the agent brief', () => {
    const result = routeIntent('give the next agent a handoff');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_agent_brief',
        cli: 'projscan agent-brief',
        confidence: 'high',
        score: 5,
        matchedKeywords: ['handoff', 'next', 'agent'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_workplan')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        matchedKeywords: ['next'],
      }),
    );
  });

  it('routes open-ended next-step questions to a high-confidence workplan', () => {
    const result = routeIntent('what should I do next');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_workplan',
        cli: 'projscan workplan',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['do', 'next'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_agent_brief')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        matchedKeywords: ['next'],
      }),
    );
  });

  it('routes session resume questions to the touched-file session view', () => {
    const result = routeIntent('what did the last agent touch');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_session',
        cli: 'projscan session',
        confidence: 'high',
        score: 3,
        matchedKeywords: ['touch', 'last'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_agent_brief')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['agent'],
      }),
    );
  });

  it('routes leave-off resume questions to session context instead of generic where tools', () => {
    const result = routeIntent('where did I leave off');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_session',
        cli: 'projscan session',
        confidence: 'high',
        score: 4,
        matchedKeywords: ['leave', 'off'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_hotspots')).toBeUndefined();
  });

  it('routes changed-while-away questions to session context instead of PR diff', () => {
    const result = routeIntent('what changed while I was away');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_session',
        cli: 'projscan session',
        confidence: 'high',
        score: 4,
        matchedKeywords: ['changed', 'away'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_pr_diff')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['changed'],
      }),
    );

    const offline = routeIntent('what changed while I was offline');
    expect(offline.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_session',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['changed', 'offline']),
      }),
    );
    expect(
      offline.matches.find((match) => match.tool === 'projscan_privacy_check'),
    ).toBeUndefined();
  });

  it('routes wake-up and last-agent status questions to session context', () => {
    const asleep = routeIntent('what changed while I was asleep');

    expect(asleep.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_session',
        cli: 'projscan session',
        confidence: 'high',
        matchedKeywords: ['changed', 'asleep'],
      }),
    );
    expect(asleep.matches.find((match) => match.tool === 'projscan_pr_diff')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['changed'],
      }),
    );

    const lastAgent = routeIntent('what did the last agent do');
    expect(lastAgent.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_session',
        confidence: 'high',
        matchedKeywords: ['last', 'agent'],
      }),
    );
    expect(lastAgent.matches.find((match) => match.tool === 'projscan_agent_brief')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['agent'],
      }),
    );
  });
});
