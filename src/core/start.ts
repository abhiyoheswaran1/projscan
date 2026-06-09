import { computeFirstRunDiagnostics, getWorkflowRecipes, type AgentWorkflowRecipe } from './adoption.js';
import { loadSession } from './session.js';
import { fixFirstFromStartRisk } from './fixFirst.js';
import { buildFirstTenMinutes } from './onboarding.js';
import { computeQualityScorecard } from './qualityScorecard.js';
import { buildWorkplanHandoff, computeWorkplan, isWorkplanMode } from './workplan.js';
import { routeIntent, type RouteMatch } from './intentRouter.js';
import type { GraphQueryDirection } from './graphQuery.js';
import { getChangedFiles } from '../utils/changedFiles.js';
import type {
  AgentBriefIntent,
  StartExecutionCursor,
  PreflightSuggestedAction,
  StartExecutionPhase,
  StartExecutionPhaseId,
  StartExecutionPlan,
  StartExecutionStatus,
  StartExecutionStep,
  StartMissionInputBinding,
  StartMissionProofItem,
  StartMissionProofToolCall,
  StartMissionReviewDecision,
  StartMissionReviewGate,
  StartMissionReviewProof,
  StartMissionReviewWorktree,
  StartMissionResume,
  StartMissionResumeChecklistItem,
  StartMissionResumeReference,
  StartMissionRunbook,
  StartMissionTaskCard,
  StartMissionToolCall,
  QualityScorecardRisk,
  RegressionPlanLevel,
  StartAdoptionGap,
  StartAdoptionLoop,
  StartMissionControl,
  StartMissionControlStatus,
  StartModeSource,
  StartReport,
  StartRisk,
  StartRoutedIntent,
  StartUnresolvedInput,
  StartWorkflowRecommendation,
  SessionCoordinationHint,
  UnderstandView,
  WorkplanMode,
  WorkplanReport,
  WorkplanTopRisk,
} from '../types.js';

export interface ComputeStartOptions {
  mode?: WorkplanMode;
  intent?: string;
  maxTasks?: number;
  maxRisks?: number;
  includeHandoff?: boolean;
}

const DEFAULT_MAX_TASKS = 5;
const DEFAULT_MAX_RISKS = 5;
const READY_PROOF_SUMMARY = 'Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.';

type StartGraphQuery = {
  direction: GraphQueryDirection;
  file?: string;
  symbol?: string;
  limit?: number;
};

export async function computeStartReport(
  rootPath: string,
  options: ComputeStartOptions = {},
): Promise<StartReport> {
  const intent = normalizeIntent(options.intent);
  const modeResolution = resolveStartMode(options.mode, intent);
  const mode = modeResolution.mode;
  const maxTasks = normalizeLimit(options.maxTasks, DEFAULT_MAX_TASKS, 12);
  const maxRisks = normalizeLimit(options.maxRisks, DEFAULT_MAX_RISKS, 12);
  const [setup, workplan, quality, riskSources] = await Promise.all([
    computeFirstRunDiagnostics(rootPath),
    computeWorkplan(rootPath, { mode, maxTasks }),
    computeQualityScorecard(rootPath, { maxRisks }),
    buildStartRiskSources(rootPath),
  ]);
  const workflow = chooseWorkflow(mode, getWorkflowRecipes().recipes);
  const topRisks = combineRisks(workplan, quality.topRisks, maxRisks);
  const fixFirst = workplan.fixFirst ?? fixFirstFromStartRisk(topRisks[0]);
  const adoptionGaps = setup.diagnostics
    .filter((diagnostic) => diagnostic.status !== 'pass')
    .map((diagnostic): StartAdoptionGap => ({
      id: diagnostic.id,
      status: diagnostic.status as StartAdoptionGap['status'],
      title: diagnostic.label,
      summary: diagnostic.summary,
      ...(diagnostic.command ? { command: diagnostic.command } : {}),
    }));
  const adoptionLoop = buildAdoptionLoop();
  const firstTenMinutes = buildFirstTenMinutes(mode);
  const coordinationHints = buildStartCoordinationHints(riskSources, mode);
  const missionControl = buildMissionControl({
    mode,
    intent,
    setupOverall: setup.overall,
    workplan,
    workflow,
    fixFirst,
    adoptionGaps,
    coordinationHints,
    riskSources,
  });
  const nextActions = dedupeActions([
    missionControl.primaryAction,
    ...firstTenMinutes.commands.map((step) => ({ label: `First 10 minutes: ${step.label}`, command: step.command })),
    ...workflow.commands.map((command) => ({ label: `Run ${workflow.name}`, command })),
    ...adoptionLoop.nextCommands.map((command) => ({ label: 'Keep using projscan every PR', command })),
    ...workplan.suggestedNextActions,
    ...quality.suggestedNextActions,
  ]);
  const report: StartReport = {
    schemaVersion: 1,
    readOnly: true,
    rootPath,
    mode,
    modeSource: modeResolution.source,
    modeReason: modeResolution.reason,
    summary: summarize(mode, workplan, quality.topRisks.length, adoptionGaps.length, fixFirst?.title),
    setup: {
      overall: setup.overall,
      diagnostics: setup.diagnostics,
    },
    recommendedWorkflow: workflow,
    firstTenMinutes,
    missionControl,
    coordinationHints,
    evidence: {
      workplanVerdict: workplan.verdict,
      workplanSummary: workplan.summary,
      qualityVerdict: quality.verdict,
      qualitySummary: quality.summary,
      healthScore: quality.health.score,
      mcpReady: setup.diagnostics.find((diagnostic) => diagnostic.id === 'mcp-startup')?.status === 'pass',
      riskSources,
    },
    topRisks,
    ...(fixFirst ? { fixFirst } : {}),
    adoptionGaps,
    adoptionLoop,
    nextActions,
    ...(options.includeHandoff ? { handoff: buildWorkplanHandoff(workplan) } : {}),
    ...(workplan.truncated === true || quality.truncated === true ? { truncated: true } : {}),
  };
  return report;
}


function buildStartCoordinationHints(
  riskSources: StartReport['evidence']['riskSources'],
  mode: WorkplanMode,
): SessionCoordinationHint[] {
  const preflightMode = preflightModeForMission(mode);
  const hints: SessionCoordinationHint[] = [
    {
      id: 'current-worktree-check',
      label: 'Separate current worktree evidence from session memory',
      message: `Current worktree evidence sees ${riskSources.currentWorktree.count} changed file(s); remembered session context may include older agent touches.`,
      command: `projscan preflight --mode ${preflightMode} --format json`,
    },
  ];
  if (riskSources.sessionMemory.totalTouchedFiles > 0) {
    hints.push({
      id: 'remembered-session-context',
      label: 'Review remembered session touches',
      message: `${riskSources.sessionMemory.totalTouchedFiles} touched file(s) come from remembered session context, not necessarily the current Git diff.`,
      command: 'projscan session touched --format json',
    });
  }
  return hints;
}

async function buildStartRiskSources(rootPath: string): Promise<StartReport['evidence']['riskSources']> {
  const [changed, sessionResult] = await Promise.all([
    getChangedFiles(rootPath).catch((err) => ({
      available: false,
      reason: err instanceof Error ? err.message : String(err),
      baseRef: null,
      files: [],
    })),
    loadSession(rootPath).catch(() => null),
  ]);
  const touchedFiles = sessionResult
    ? Object.values(sessionResult.session.touchedFiles)
        .sort((a, b) => {
          const byTime = Date.parse(b.lastTouchedAt) - Date.parse(a.lastTouchedAt);
          return byTime !== 0 ? byTime : a.file.localeCompare(b.file);
        })
        .map((touch) => touch.file)
    : [];
  const visibleTouched = touchedFiles.slice(0, 40);
  return {
    currentWorktree: {
      kind: 'current-worktree',
      available: changed.available,
      count: changed.files.length,
      files: changed.files.slice(0, 40),
      baseRef: changed.baseRef,
      ...(changed.reason ? { reason: changed.reason } : {}),
    },
    sessionMemory: {
      kind: 'remembered-session',
      touchedFiles: visibleTouched,
      totalTouchedFiles: touchedFiles.length,
      note: 'Remembered session context comes from prior projscan tool results, explicit touches, and MCP watch events. It may include files outside the current Git/worktree diff.',
      ...(touchedFiles.length > visibleTouched.length ? { truncated: true } : {}),
    },
  };
}

function buildAdoptionLoop(): StartAdoptionLoop {
  return {
    cadence: 'every_pr',
    why: 'projscan is useful when it becomes PR muscle memory: comment, fix first, route owners, capture feedback, and compare against the last good baseline.',
    metrics: [
      {
        id: 'first_pr_useful',
        label: 'First PR usefulness',
        target: 'Reviewer says the PR comment saved 10-20 minutes or identified one missed risk.',
        command: 'projscan evidence-pack --pr-comment',
      },
      {
        id: 'manual_review_rate',
        label: 'Manual review rate',
        target: 'Most uncertain findings stay caution/manual review; actual blocks stay rare and concrete.',
        command: 'projscan preflight --mode before_merge --format json',
      },
      {
        id: 'repeat_use_commands',
        label: 'Repeat-use commands',
        target: 'Every PR has evidence-pack, preflight, and owner routing before merge.',
        command: 'projscan start --mode before_merge --format json',
      },
      {
        id: 'market_validation_feedback',
        label: 'Market validation feedback',
        target: 'At least three real reviewers confirm usefulness, minutes saved, prevented risk, and false-positive/noisy-rule status.',
        command: 'projscan feedback summary --file .projscan-feedback.json --format json',
      },
    ],
    nextCommands: [
      'projscan evidence-pack --pr-comment',
      'projscan preflight --mode before_merge --format json',
      'projscan feedback init --output .projscan-feedback.json',
      'projscan feedback add --file .projscan-feedback.json --repo <repo> --pr <url> --reviewer <handle> --useful true --minutes-saved 10',
      'projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json',
      'projscan dogfood --repo <path-to-repo> --format json',
    ],
  };
}

interface StartModeResolution {
  mode: WorkplanMode;
  source: StartModeSource;
  reason: string;
}

function resolveStartMode(value: WorkplanMode | undefined, intent: string | undefined): StartModeResolution {
  if (typeof value === 'string' && isWorkplanMode(value)) {
    return {
      mode: value,
      source: 'explicit',
      reason: `Mode ${value} was provided explicitly.`,
    };
  }
  const inferred = inferModeFromIntent(intent);
  if (inferred) {
    return {
      mode: inferred,
      source: 'intent',
      reason: `Intent "${intent}" maps to the ${inferred} workflow.`,
    };
  }
  const routed = routesForIntent(intent).length > 0;
  return {
    mode: 'before_edit',
    source: 'default',
    reason: intent
      ? routed
        ? `Mission Control routed the intent, but no workflow-mode hint matched "${intent}", so start defaults to before_edit.`
        : `No mode-specific intent matched "${intent}", so start defaults to before_edit.`
      : 'No mode-specific intent or explicit mode was supplied, so start defaults to before_edit.',
  };
}

function inferModeFromIntent(intent: string | undefined): WorkplanMode | undefined {
  const routes = routesForIntent(intent);
  const primaryRoute = routes[0];
  if (primaryRoute?.tool === 'projscan_release_train') return 'release';
  if (primaryRoute?.tool === 'projscan_bug_hunt' && primaryRoute.confidence === 'high') return 'bug_hunt';
  if (primaryRoute?.tool === 'projscan_dataflow' && primaryRoute.confidence === 'high') return 'hardening';
  if (primaryRoute?.tool === 'projscan_evidence_pack') return 'before_commit';
  if (primaryRoute?.tool === 'projscan_review') return reviewModeFromIntent(intent ?? '');
  if (primaryRoute?.tool === 'projscan_regression_plan') return regressionModeFromIntent(intent ?? '');
  if (primaryRoute?.tool === 'projscan_pr_diff') return 'before_commit';
  if (primaryRoute?.tool === 'projscan_merge_risk') return 'before_merge';
  if (primaryRoute?.tool === 'projscan_preflight') return preflightModeFromIntent(intent ?? '');
  if (routes.some((route) => route.tool === 'projscan_preflight') && hasPreflightModeHint(intent ?? '')) {
    return preflightModeFromIntent(intent ?? '');
  }
  return undefined;
}

function hasPreflightModeHint(intent: string): boolean {
  return /\b(?:safe|safety|gate|preflight|commit|committing|committed|merge|merged|merging|rebase|rebasing|conflict|conflicts|resolve|resolving|edit|proceed|block|blocked|blocker|blockers|blocking|allowed)\b/i.test(intent);
}

function normalizeIntent(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) return undefined;
  return trimmed.slice(0, 240);
}

function normalizeLimit(value: number | undefined, fallback: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(value)));
}

function buildMissionControl(input: {
  mode: WorkplanMode;
  intent?: string;
  setupOverall: StartReport['setup']['overall'];
  workplan: WorkplanReport;
  workflow: StartWorkflowRecommendation;
  fixFirst?: StartReport['fixFirst'];
  adoptionGaps: StartAdoptionGap[];
  coordinationHints: SessionCoordinationHint[];
  riskSources: StartReport['evidence']['riskSources'];
}): StartMissionControl {
  const routeCandidates = routesForIntent(input.intent);
  const routed = routeCandidates[0];
  const alternatives = routeCandidates.slice(1, 4);
  const status = missionStatus(input.setupOverall, input.workplan.verdict, input.adoptionGaps);
  const actionPlan = missionActionPlan(input.intent, routed, input.fixFirst, input.workplan, input.workflow);
  const primaryAction = actionPlan[0] ?? actionFromWorkflow(input.workflow);
  const readyActions = missionReadyActions(actionPlan);
  const guardrails = missionGuardrails(input.mode, input.coordinationHints, primaryAction);
  const proofCommands = missionProofCommands(input.mode, input.workplan, guardrails, actionPlan);
  const successCriteria = missionSuccessCriteria(input.mode, routed, actionPlan, input.workplan);
  const unresolvedInputs = missionUnresolvedInputs(actionPlan);
  const executionPlan = buildMissionExecutionPlan({
    primaryAction,
    actionPlan,
    readyActions,
    unresolvedInputs,
    successCriteria,
    proofCommands,
  });
  const resume = missionResume(executionPlan);
  const reviewProof = buildMissionReviewProof(resume, proofCommands);
  const whyNow =
    routed
      ? routedWhyNow(routed, actionPlan)
      : input.fixFirst
        ? `Top evidence points to "${input.fixFirst.title}" as the first useful move.`
        : `The ${input.mode} workflow is the shortest path from orientation to verified action.`;
  const reviewGate = buildMissionReviewGate({
    status,
    doneWhen: successCriteria,
    proof: reviewProof,
    currentWorktree: input.riskSources.currentWorktree,
  });
  const handoffPrompt = missionHandoffPrompt(resume, successCriteria, whyNow, unresolvedInputs, proofCommands, reviewGate);
  const runbook = buildMissionRunbook({
    intent: input.intent,
    status,
    primaryAction,
    readyActions,
    unresolvedInputs,
    successCriteria,
    proofCommands,
    executionPlan,
    resume,
    handoffPrompt,
    reviewGate,
  });
  const taskCard = buildMissionTaskCard({
    intent: input.intent,
    status,
    currentStep: executionPlan.cursor,
    resume,
    successCriteria,
    handoffPrompt,
    reviewGate,
  });
  return {
    ...(input.intent ? { intent: input.intent } : {}),
    status,
    headline: headlineForStatus(status, primaryAction.label),
    whyNow,
    primaryAction,
    actionPlan,
    readyActions,
    ...(routed ? { routedIntent: routed } : {}),
    ...(alternatives.length > 0 ? { alternatives } : {}),
    unresolvedInputs,
    guardrails,
    successCriteria,
    proofSummary: READY_PROOF_SUMMARY,
    proofCommands,
    resume,
    handoff: missionHandoff(executionPlan.cursor, resume, primaryAction, readyActions, unresolvedInputs, successCriteria, proofCommands, reviewGate),
    executionPlan,
    runbook,
    reviewGate,
    taskCard,
    handoffPrompt,
  };
}

function buildMissionReviewGate(input: {
  status: StartMissionControlStatus;
  doneWhen: string[];
  proof: StartMissionReviewProof;
  currentWorktree: StartReport['evidence']['riskSources']['currentWorktree'];
}): StartMissionReviewGate {
  const checklist = [
    'Complete this task card and remaining proof.',
    'Capture `git status --short`.',
    'Capture `git diff --stat`.',
    'Stop and ask for approval before starting another slice, release, publish, or deploy.',
  ];
  const commands = ['git status --short', 'git diff --stat'];
  const doneWhen = input.doneWhen.slice();
  const decisions = buildMissionReviewDecisions();
  const worktree = buildMissionReviewWorktree(input.currentWorktree);
  const stopCondition = 'Stop after the current Mission Control checklist and proof are complete.';
  const reviewPrompt = `Review the completed mission, proof output, and working-tree summary before approving another slice, release, publish, or deploy. ${input.proof.summary}`;
  return {
    title: 'Mission Review Gate',
    required: true,
    status: input.status,
    stopCondition,
    reviewPrompt,
    checklist,
    doneWhen,
    decisions,
    commands,
    worktree,
    proof: input.proof,
    markdown: renderMissionReviewGateMarkdown({
      status: input.status,
      stopCondition,
      reviewPrompt,
      checklist,
      doneWhen,
      decisions,
      commands,
      worktree,
      proof: input.proof,
    }),
  };
}

function buildMissionReviewDecisions(): StartMissionReviewDecision[] {
  return [
    {
      id: 'approve_next_slice',
      label: 'Approve next slice',
      description: 'The agent may start another bounded implementation slice.',
      consequence: 'No release, publish, deploy, or version bump is allowed unless the reviewer asks for it.',
      reply: 'Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version.',
    },
    {
      id: 'request_changes',
      label: 'Request changes',
      description: 'The agent must address review feedback before starting more scope.',
      consequence: 'The current mission stays open until feedback and proof are updated.',
      reply: 'Changes requested: address the review feedback first, update proof, then stop for another review.',
    },
    {
      id: 'review_version_candidate',
      label: 'Review version candidate',
      description: 'The agent may prepare release notes, version rationale, and remaining gates for review.',
      consequence: 'Publishing still requires a separate explicit approval.',
      reply: 'Prepare a version-candidate review only. Do not publish, deploy, push, merge, or bump the version.',
    },
  ];
}

function buildMissionReviewProof(
  resume: StartMissionResume,
  proofCommands: string[],
): StartMissionReviewProof {
  const commands = resume.remainingProofCommands ?? proofCommands;
  const toolCalls = resume.remainingProofToolCalls ?? [];
  const items = resume.remainingProofItems ?? [];
  return {
    summary: READY_PROOF_SUMMARY,
    commands,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    ...(items.length > 0 ? { items } : {}),
  };
}

function buildMissionReviewWorktree(
  currentWorktree: StartReport['evidence']['riskSources']['currentWorktree'],
): StartMissionReviewWorktree {
  if (!currentWorktree.available) {
    const reason = currentWorktree.reason ?? 'unknown';
    return {
      available: false,
      clean: false,
      changedFileCount: 0,
      files: [],
      baseRef: currentWorktree.baseRef,
      summary: `Current worktree evidence is unavailable: ${reason}.`,
      reason,
    };
  }

  const changedFileCount = currentWorktree.count;
  const baseRef = currentWorktree.baseRef;
  return {
    available: true,
    clean: changedFileCount === 0,
    changedFileCount,
    files: currentWorktree.files,
    baseRef,
    summary:
      changedFileCount === 0
        ? 'Current worktree evidence sees no changed files.'
        : `Current worktree evidence sees ${changedFileCount} changed file(s)${baseRef ? ` against ${baseRef}` : ''}.`,
  };
}

function renderMissionReviewGateMarkdown(input: {
  status: StartMissionControlStatus;
  stopCondition: string;
  reviewPrompt: string;
  checklist: string[];
  doneWhen: string[];
  decisions: StartMissionReviewDecision[];
  commands: string[];
  worktree: StartMissionReviewWorktree;
  proof: StartMissionReviewProof;
}): string {
  const lines = [
    '# Mission Review Gate',
    '',
    `Status: ${input.status}`,
    `Stop condition: ${input.stopCondition}`,
    '',
    '## Checklist',
    ...input.checklist.map((item) => `- [ ] ${item}`),
    '',
    '## Done When',
    ...(input.doneWhen.length > 0
      ? input.doneWhen.map((criterion) => `- [ ] ${criterion}`)
      : ['- [ ] The current mission is complete and verified.']),
    '',
    '## Reviewer Decision',
    ...input.decisions.map(formatMissionReviewDecision),
    '',
    ...renderMissionReviewProofLines(input.proof),
    '## Evidence Commands',
    ...input.commands.map((command) => `- \`${command}\``),
    '',
    '## Worktree Evidence',
    input.worktree.summary,
    ...input.worktree.files.slice(0, 8).map((file) => `- \`${file}\``),
    '',
    '## Review Prompt',
    input.reviewPrompt,
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}

function formatMissionReviewDecision(decision: StartMissionReviewDecision): string {
  return `- [ ] ${decision.label}: ${decision.description} Consequence: ${decision.consequence} Reply: "${decision.reply}"`;
}

function renderMissionReviewProofLines(proof: StartMissionReviewProof): string[] {
  const lines = ['## Proof Queue', proof.summary];
  if (proof.items && proof.items.length > 0) {
    return [...lines, ...proof.items.map(formatMissionReviewProofItem), ''];
  }
  if (proof.commands.length > 0) {
    return [...lines, ...proof.commands.map((command) => `- \`${command}\``), ''];
  }
  return [...lines, 'No proof commands are ready yet.', ''];
}

function formatMissionReviewProofItem(item: StartMissionProofItem): string {
  const annotation = item.toolCall
    ? ` (MCP: ${formatMissionReviewToolCall(item.toolCall)})`
    : ' (CLI only)';
  return `- \`${item.command}\`${annotation}`;
}

function formatMissionReviewToolCall(toolCall: StartMissionToolCall): string {
  return typeof toolCall.args !== 'undefined'
    ? `${toolCall.tool} ${JSON.stringify(toolCall.args)}`
    : toolCall.tool;
}

function buildMissionRunbook(input: {
  intent?: string;
  status: StartMissionControlStatus;
  primaryAction: PreflightSuggestedAction;
  readyActions: PreflightSuggestedAction[];
  unresolvedInputs: StartUnresolvedInput[];
  successCriteria: string[];
  proofCommands: string[];
  executionPlan: StartExecutionPlan;
  resume: StartMissionResume;
  handoffPrompt: string;
  reviewGate: StartMissionReviewGate;
}): StartMissionRunbook {
  const readyCommands = uniqueStrings(
    input.readyActions
      .map((action) => action.command ?? '')
      .filter(isRunnableCommand),
  );
  const readyCommandBlock = readyCommands.join('\n');
  const blockedInputSummary = input.unresolvedInputs.length > 0
    ? `Needs input: ${input.unresolvedInputs.map((item) => `${item.name}=${item.placeholder}`).join(', ')}.`
    : undefined;
  return {
    title: `Runbook: ${input.primaryAction.label}`,
    status: input.status,
    currentPhase: input.executionPlan.currentPhase,
    currentStep: input.executionPlan.cursor,
    resume: input.resume,
    readyCommandBlock,
    ...(blockedInputSummary ? { blockedInputSummary } : {}),
    markdown: renderMissionRunbookMarkdown({
      intent: input.intent,
      status: input.status,
      currentPhase: input.executionPlan.currentPhase,
      currentStep: input.executionPlan.cursor,
      resume: input.resume,
      primaryAction: input.primaryAction,
      readyCommands,
      unresolvedInputs: input.unresolvedInputs,
      proofCommands: input.proofCommands,
      successCriteria: input.successCriteria,
      handoffPrompt: input.handoffPrompt,
      reviewGate: input.reviewGate,
    }),
  };
}

function renderMissionRunbookMarkdown(input: {
  intent?: string;
  status: StartMissionControlStatus;
  currentPhase: StartExecutionPhaseId;
  currentStep: StartExecutionCursor;
  resume: StartMissionResume;
  primaryAction: PreflightSuggestedAction;
  readyCommands: string[];
  unresolvedInputs: StartUnresolvedInput[];
  proofCommands: string[];
  successCriteria: string[];
  handoffPrompt: string;
  reviewGate: StartMissionReviewGate;
}): string {
  const lines = [
    '# Mission Runbook',
    '',
    ...(input.intent ? [`Intent: ${input.intent}`] : []),
    `Status: ${input.status}`,
    `Current phase: ${input.currentPhase}`,
    `Next action: ${input.primaryAction.command ? `\`${input.primaryAction.command}\`` : input.primaryAction.label}`,
    '',
    ...renderRunbookCursorLines(input.currentStep),
    '',
    ...renderRunbookResumeLines(input.resume),
    '',
    '## Handoff Prompt',
    input.handoffPrompt,
    '',
    '## Review Gate',
    ...input.reviewGate.checklist.map((item) => `- [ ] ${item}`),
    '',
    '## Reviewer Decision',
    ...input.reviewGate.decisions.map(formatMissionReviewDecision),
    '',
    input.reviewGate.reviewPrompt,
    '',
    '## Ready Commands',
    ...(input.readyCommands.length > 0 ? input.readyCommands.map((command) => `- \`${command}\``) : ['- None yet. Resolve blocked inputs first.']),
    '',
    ...(input.unresolvedInputs.length > 0
      ? [
          '## Blocked Inputs',
          ...input.unresolvedInputs.map((item) => `- ${item.name}: ${item.instruction}`),
          '',
        ]
      : []),
    '## Proof Commands',
    ...(input.proofCommands.length > 0 ? input.proofCommands.map((command) => `- \`${command}\``) : ['- No proof commands available yet.']),
    '',
    '## Done When',
    ...(input.successCriteria.length > 0 ? input.successCriteria.map((criterion) => `- ${criterion}`) : ['- The next action is complete and verified.']),
  ];
  return `${lines.join('\n')}\n`;
}

function buildMissionTaskCard(input: {
  intent?: string;
  status: StartMissionControlStatus;
  currentStep: StartExecutionCursor;
  resume: StartMissionResume;
  successCriteria: string[];
  handoffPrompt: string;
  reviewGate: StartMissionReviewGate;
}): StartMissionTaskCard {
  return {
    title: 'Mission Task Card',
    status: input.status,
    currentPhase: input.currentStep.phaseId,
    currentStep: input.currentStep,
    markdown: renderMissionTaskCardMarkdown(input),
  };
}

function renderMissionTaskCardMarkdown(input: {
  intent?: string;
  status: StartMissionControlStatus;
  currentStep: StartExecutionCursor;
  resume: StartMissionResume;
  successCriteria: string[];
  handoffPrompt: string;
  reviewGate: StartMissionReviewGate;
}): string {
  const lines = [
    '# Mission Task Card',
    '',
    ...(input.intent ? [`Intent: ${input.intent}`] : []),
    `Status: ${input.status}`,
    `Current step: ${input.currentStep.stepId} in ${input.currentStep.phaseId}`,
    '',
    '## Do Next',
    ...missionTaskCardActionLines(input.resume),
    '',
    '## Proof',
    ...missionTaskCardProofLines(input.resume),
    '',
    '## Done When',
    ...(input.successCriteria.length > 0
      ? input.successCriteria.map((criterion) => `- [ ] ${criterion}`)
      : ['- [ ] The next action is complete and verified.']),
    '',
    '## Review Gate',
    ...input.reviewGate.checklist.map((item) => `- [ ] ${item}`),
    '',
    '## Reviewer Decision',
    ...input.reviewGate.decisions.map(formatMissionReviewDecision),
    '',
    '## Handoff Prompt',
    input.handoffPrompt,
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}

function missionTaskCardActionLines(resume: StartMissionResume): string[] {
  const checklist = resume.checklist ?? [];
  const actionLines = checklist
    .filter((item) => item.kind !== 'run_proof' && item.kind !== 'confirm_done')
    .map(formatTaskCardChecklistItem);
  return actionLines.length > 0 ? actionLines : ['- [ ] Continue from the current Mission Control cursor.'];
}

function missionTaskCardProofLines(resume: StartMissionResume): string[] {
  const proofItems = resume.remainingProofItems ?? [];
  const proofLines = proofItems.map(formatTaskCardProofItem);
  if (proofLines.length > 0) return proofLines;
  const commands = resume.remainingProofCommands ?? [];
  return commands.length > 0
    ? commands.map((command) => `- [ ] \`${command}\``)
    : ['- [ ] No proof commands are ready yet.'];
}

function formatTaskCardChecklistItem(item: StartMissionResumeChecklistItem): string {
  if (item.kind === 'resolve_input') {
    const label = item.label ? ` (\`${item.label}\`)` : '';
    const instruction = item.instruction ?? item.label;
    return `- [ ] Resolve \`${item.stepId}\`${label}: ${instruction}`;
  }
  if (item.kind === 'run_follow_up' && item.command) {
    const prefix = item.status === 'blocked' ? 'After inputs, run' : 'Then run';
    return `- [ ] ${prefix} \`${item.command}\`${formatTaskCardChecklistAnnotation(item)}`;
  }
  if (item.command) {
    return `- [ ] Run \`${item.command}\`${formatTaskCardChecklistAnnotation(item)}`;
  }
  return `- [ ] ${item.instruction ?? item.label}`;
}

function formatTaskCardChecklistAnnotation(item: StartMissionResumeChecklistItem): string {
  if (!item.tool) return '';
  return ` (MCP: ${formatTaskCardToolCall({ tool: item.tool, ...(typeof item.args !== 'undefined' ? { args: item.args } : {}) })})`;
}

function formatTaskCardProofItem(item: StartMissionProofItem): string {
  const annotation = item.toolCall
    ? ` (MCP: ${formatTaskCardToolCall(item.toolCall)})`
    : ' (CLI only)';
  return `- [ ] \`${item.command}\`${annotation}`;
}

function formatTaskCardToolCall(toolCall: StartMissionToolCall): string {
  return typeof toolCall.args !== 'undefined'
    ? `${toolCall.tool} ${JSON.stringify(toolCall.args)}`
    : toolCall.tool;
}

function missionResume(plan: StartExecutionPlan): StartMissionResume {
  const cursor = plan.cursor;
  const commandBlock = cursor.command && isRunnableCommand(cursor.command) ? cursor.command : undefined;
  const toolCall = resumeToolCall(plan, cursor);
  const followUps = resumeFollowUps(plan, cursor);
  const inputBindings = resumeInputBindings(plan, cursor);
  const checklist = resumeChecklist(plan, cursor, inputBindings, followUps);
  const remainingProofItems = resumeRemainingProofItems(checklist);
  const remainingProofCommands = resumeRemainingProofCommands(checklist);
  const remainingProofToolCalls = resumeRemainingProofToolCalls(checklist);
  const unlocks = resolveResumeReferences(plan, cursor.unlocks);
  const blockedBy = resolveResumeReferences(plan, cursor.blockedBy);
  const instruction = commandBlock
    ? `Run ${commandBlock}.`
    : cursor.instruction
      ? `Resolve ${cursor.label}: ${cursor.instruction}`
      : `Continue with ${cursor.label}.`;
  const prompt = commandBlock
    ? `Resume at ${cursor.stepId} in ${cursor.phaseId}: run \`${commandBlock}\`.${resumeUnlocksSentence(unlocks, cursor.unlocks)}`
    : `Resume at ${cursor.stepId} in ${cursor.phaseId}: ${instruction}${resumeBlockersSentence(blockedBy, cursor.blockedBy)}`;
  return {
    currentStep: cursor,
    status: cursor.status,
    instruction,
    prompt,
    ...(commandBlock ? { commandBlock } : {}),
    ...(toolCall ? { toolCall } : {}),
    ...(followUps.length > 0 ? { followUps } : {}),
    ...(inputBindings.length > 0 ? { inputBindings } : {}),
    ...(checklist.length > 0 ? { checklist } : {}),
    ...(remainingProofItems.length > 0 ? { remainingProofItems } : {}),
    ...(remainingProofCommands.length > 0 ? { remainingProofCommands } : {}),
    ...(remainingProofToolCalls.length > 0 ? { remainingProofToolCalls } : {}),
    ...(unlocks.length > 0 ? { unlocks } : {}),
    ...(blockedBy.length > 0 ? { blockedBy } : {}),
  };
}

function resumeRemainingProofCommands(checklist: StartMissionResumeChecklistItem[]): string[] {
  return checklist
    .filter((item) => item.kind === 'run_proof' && typeof item.command === 'string')
    .map((item) => item.command as string);
}

function resumeRemainingProofItems(checklist: StartMissionResumeChecklistItem[]): StartMissionProofItem[] {
  return checklist.flatMap((item) => {
    if (item.kind !== 'run_proof' || typeof item.command !== 'string') return [];
    const toolCall = proofChecklistToolCall(item);
    return [{
      stepId: item.stepId,
      status: item.status,
      label: item.label,
      command: item.command,
      ...(toolCall ? { toolCall } : {}),
    }];
  });
}

function resumeRemainingProofToolCalls(checklist: StartMissionResumeChecklistItem[]): StartMissionProofToolCall[] {
  return checklist.flatMap((item) => {
    if (item.kind !== 'run_proof' || typeof item.command !== 'string') return [];
    const toolCall = proofChecklistToolCall(item);
    return toolCall ? [{ stepId: item.stepId, command: item.command, ...toolCall }] : [];
  });
}

function proofChecklistToolCall(item: StartMissionResumeChecklistItem): StartMissionResume['toolCall'] | undefined {
  if (item.tool) {
    return {
      tool: item.tool,
      ...(typeof item.args !== 'undefined' ? { args: item.args } : {}),
    };
  }
  return typeof item.command === 'string' ? proofCommandToolCall(item.command) : undefined;
}

function proofCommandToolCall(command: string): StartMissionResume['toolCall'] | undefined {
  const preflightMatch = /^projscan preflight(?: --mode ([a-z_]+))? --format json$/.exec(command);
  if (preflightMatch) {
    return {
      tool: 'projscan_preflight',
      args: preflightMatch[1] ? { mode: preflightMatch[1] } : {},
    };
  }

  const understandMatch = /^projscan understand --view ([a-z_]+)(?: --intent "((?:\\.|[^"\\])*)")? --format json$/.exec(command);
  if (understandMatch) {
    return {
      tool: 'projscan_understand',
      args: {
        view: understandMatch[1],
        ...(understandMatch[2] ? { intent: unescapeDoubleQuoted(understandMatch[2]) } : {}),
      },
    };
  }

  if (command === 'projscan session touched --format json') {
    return {
      tool: 'projscan_session',
      args: { action: 'touched' },
    };
  }

  return undefined;
}

function unescapeDoubleQuoted(value: string): string {
  return value.replace(/\\(["\\])/g, '$1');
}

function resumeChecklist(
  plan: StartExecutionPlan,
  cursor: StartExecutionCursor,
  inputBindings: StartMissionInputBinding[],
  followUps: NonNullable<StartMissionResume['followUps']>,
): StartMissionResumeChecklistItem[] {
  const current = findStepInPlan(plan, cursor.stepId);
  const currentItem = current
    ? resumeChecklistItemFromStep(current.phase, current.step, currentChecklistKind(current.step), cursor.stepId)
    : undefined;
  const includedStepIds = new Set(currentItem ? [currentItem.stepId] : []);
  const inputItems = inputBindings.flatMap((binding) => {
    if (includedStepIds.has(binding.inputId)) return [];
    const found = findStepInPlan(plan, binding.inputId);
    if (!found) return [];
    includedStepIds.add(found.step.id);
    return [{
      id: `resume-${found.step.id}`,
      kind: 'resolve_input',
      phaseId: found.phase.id,
      stepId: found.step.id,
      status: found.step.status,
      label: binding.label,
      placeholder: binding.placeholder,
      instruction: binding.instruction,
      followUpIds: binding.followUpIds,
      ...(found.step.dependsOn && found.step.dependsOn.length > 0 ? { dependsOn: found.step.dependsOn } : {}),
      ...(found.step.unlocks && found.step.unlocks.length > 0 ? { unlocks: found.step.unlocks } : {}),
    } satisfies StartMissionResumeChecklistItem];
  });
  const followUpItems = followUps.flatMap((followUp) => {
    if (includedStepIds.has(followUp.id)) return [];
    includedStepIds.add(followUp.id);
    return [{
      id: `resume-${followUp.id}`,
      kind: 'run_follow_up',
      phaseId: followUp.phaseId,
      stepId: followUp.id,
      status: followUp.status,
      label: followUp.label,
      ...(followUp.command ? { command: followUp.command } : {}),
      ...(followUp.tool ? { tool: followUp.tool } : {}),
      ...(followUp.args ? { args: followUp.args } : {}),
      ...(followUp.blockedBy && followUp.blockedBy.length > 0 ? { blockedBy: followUp.blockedBy } : {}),
      ...(followUp.dependsOn && followUp.dependsOn.length > 0 ? { dependsOn: followUp.dependsOn } : {}),
    } satisfies StartMissionResumeChecklistItem];
  });
  const currentCommand = current?.step.command;
  const proofItems = stepsForPhase(plan, 'proof')
    .filter(({ step }) => step.command && step.command !== currentCommand)
    .map(({ phase, step }) => resumeChecklistItemFromStep(phase, step, 'run_proof', step.id));
  const doneItems = stepsForPhase(plan, 'done_when')
    .map(({ phase, step }) => resumeChecklistItemFromStep(phase, step, 'confirm_done', step.id));
  return [
    ...(currentItem ? [currentItem] : []),
    ...inputItems,
    ...followUpItems,
    ...proofItems,
    ...doneItems,
  ];
}

function resumeChecklistItemFromStep(
  phase: StartExecutionPhase,
  step: StartExecutionStep,
  kind: StartMissionResumeChecklistItem['kind'],
  stepId: string,
): StartMissionResumeChecklistItem {
  return {
    id: `resume-${stepId}`,
    kind,
    phaseId: phase.id,
    stepId,
    status: step.status,
    label: step.label,
    ...(step.command ? { command: step.command } : {}),
    ...(step.tool ? { tool: step.tool } : {}),
    ...(step.args ? { args: step.args } : {}),
    ...(step.placeholder ? { placeholder: step.placeholder } : {}),
    ...(step.instruction ? { instruction: step.instruction } : {}),
    ...(step.blockedBy && step.blockedBy.length > 0 ? { blockedBy: step.blockedBy } : {}),
    ...(step.dependsOn && step.dependsOn.length > 0 ? { dependsOn: step.dependsOn } : {}),
    ...(step.unlocks && step.unlocks.length > 0 ? { unlocks: step.unlocks } : {}),
  };
}

function currentChecklistKind(step: StartExecutionStep): StartMissionResumeChecklistItem['kind'] {
  if (step.kind === 'input') return 'resolve_input';
  if (step.kind === 'proof') return 'run_proof';
  if (step.kind === 'criterion') return 'confirm_done';
  return 'run_current';
}

function resumeInputBindings(plan: StartExecutionPlan, cursor: StartExecutionCursor): StartMissionInputBinding[] {
  const ids = uniqueStrings([
    ...(cursor.kind === 'input' ? [cursor.stepId] : []),
    ...(cursor.unlocks ?? []),
  ]);
  return ids.flatMap((id) => {
    const found = findStepInPlan(plan, id);
    if (!found || found.step.kind !== 'input' || !found.step.placeholder || !found.step.instruction) return [];
    const followUpIds = (found.step.unlocks ?? []).filter((unlockedId) => findStepInPlan(plan, unlockedId)?.phase.id === 'follow_up');
    return [{
      inputId: found.step.id,
      label: found.step.label,
      placeholder: found.step.placeholder,
      instruction: found.step.instruction,
      followUpIds,
    }];
  });
}

function resumeFollowUps(plan: StartExecutionPlan, cursor: StartExecutionCursor): NonNullable<StartMissionResume['followUps']> {
  const followUpIds = new Set<string>();
  for (const id of cursor.unlocks ?? []) {
    const found = findStepInPlan(plan, id);
    if (!found) continue;
    if (found.phase.id === 'follow_up') followUpIds.add(found.step.id);
    for (const unlockedId of found.step.unlocks ?? []) {
      const unlocked = findStepInPlan(plan, unlockedId);
      if (unlocked?.phase.id === 'follow_up') followUpIds.add(unlocked.step.id);
    }
  }
  return Array.from(followUpIds).flatMap((id) => {
    const found = findStepInPlan(plan, id);
    if (!found) return [];
    return [{
      id: found.step.id,
      phaseId: found.phase.id,
      kind: found.step.kind,
      status: found.step.status,
      label: found.step.label,
      ...(found.step.command ? { command: found.step.command } : {}),
      ...(found.step.tool ? { tool: found.step.tool } : {}),
      ...(found.step.args ? { args: found.step.args } : {}),
      ...(found.step.blockedBy && found.step.blockedBy.length > 0 ? { blockedBy: found.step.blockedBy } : {}),
      ...(found.step.dependsOn && found.step.dependsOn.length > 0 ? { dependsOn: found.step.dependsOn } : {}),
    }];
  });
}

function resumeToolCall(plan: StartExecutionPlan, cursor: StartExecutionCursor): StartMissionResume['toolCall'] | undefined {
  const found = findStepInPlan(plan, cursor.stepId);
  if (!found?.step.tool || !argsAreReady(found.step.args)) return undefined;
  return {
    tool: found.step.tool,
    ...(typeof found.step.args !== 'undefined' ? { args: found.step.args } : {}),
  };
}

function resolveResumeReferences(
  plan: StartExecutionPlan,
  ids: string[] | undefined,
): StartMissionResumeReference[] {
  if (!ids || ids.length === 0) return [];
  const references: StartMissionResumeReference[] = [];
  for (const id of ids) {
    const found = findStepInPlan(plan, id);
    if (!found) continue;
    references.push({
      id: found.step.id,
      phaseId: found.phase.id,
      kind: found.step.kind,
      status: found.step.status,
      label: found.step.label,
      ...(found.step.instruction ? { instruction: found.step.instruction } : {}),
      ...(found.step.command ? { command: found.step.command } : {}),
      ...(found.step.placeholder ? { placeholder: found.step.placeholder } : {}),
    });
  }
  return references;
}

function findStepInPlan(
  plan: StartExecutionPlan,
  id: string,
): { phase: StartExecutionPhase; step: StartExecutionStep } | undefined {
  for (const phase of plan.phases) {
    for (const step of phase.steps) {
      if (step.id === id) return { phase, step };
    }
  }
  return undefined;
}

function stepsForPhase(
  plan: StartExecutionPlan,
  phaseId: StartExecutionPhaseId,
): Array<{ phase: StartExecutionPhase; step: StartExecutionStep }> {
  const phase = plan.phases.find((item) => item.id === phaseId);
  return phase ? phase.steps.map((step) => ({ phase, step })) : [];
}

function resumeUnlocksSentence(unlocks: StartMissionResumeReference[], rawIds: string[] | undefined): string {
  if (unlocks.length > 0) return ` This can unlock ${unlocks.map(formatResumeReferenceLabel).join(', ')}.`;
  return rawIds && rawIds.length > 0 ? ` This can unlock ${rawIds.join(', ')}.` : '';
}

function resumeBlockersSentence(blockedBy: StartMissionResumeReference[], rawIds: string[] | undefined): string {
  if (blockedBy.length > 0) return ` Blocked by ${blockedBy.map(formatResumeReferenceLabel).join(', ')}.`;
  return rawIds && rawIds.length > 0 ? ` Blocked by ${rawIds.join(', ')}.` : '';
}

function formatResumeReferenceLabel(reference: StartMissionResumeReference): string {
  return `${reference.id} (${reference.label})`;
}

function renderRunbookResumeLines(resume: StartMissionResume): string[] {
  const lines = ['## Resume'];
  if (resume.commandBlock) {
    lines.push('Run now:', '```sh', resume.commandBlock, '```');
  } else {
    lines.push(`Do now: ${resume.instruction}`);
  }
  if (resume.toolCall) {
    lines.push(`MCP call: ${formatRunbookToolCall(resume.toolCall)}`);
  }
  if (resume.unlocks && resume.unlocks.length > 0) {
    lines.push('After running, resolve:', ...resume.unlocks.map((reference) => `- ${formatRunbookResumeReference(reference)}`));
  }
  if (resume.inputBindings && resume.inputBindings.length > 0) {
    lines.push('Template inputs:', ...resume.inputBindings.map((binding) => `- ${formatRunbookInputBinding(binding)}`));
  }
  if (resume.checklist && resume.checklist.length > 0) {
    lines.push('Resume checklist:', ...resume.checklist.map((item) => `- ${formatRunbookChecklistItem(item)}`));
  }
  if (resume.remainingProofItems && resume.remainingProofItems.length > 0) {
    lines.push('Proof queue:', ...resume.remainingProofItems.map((item) => `- ${formatRunbookProofItem(item)}`));
  }
  if (resume.remainingProofCommands && resume.remainingProofCommands.length > 0) {
    lines.push('Remaining proof:', ...resume.remainingProofCommands.map((command) => `- \`${command}\``));
  }
  if (resume.remainingProofToolCalls && resume.remainingProofToolCalls.length > 0) {
    lines.push('MCP proof calls:', ...resume.remainingProofToolCalls.map((toolCall) => `- ${formatRunbookProofToolCall(toolCall)}`));
  }
  if (resume.followUps && resume.followUps.length > 0) {
    lines.push('Then use:', ...resume.followUps.map((followUp) => `- ${formatRunbookFollowUp(followUp)}`));
  }
  if (resume.blockedBy && resume.blockedBy.length > 0) {
    lines.push('Blocked by:', ...resume.blockedBy.map((reference) => `- ${formatRunbookResumeReference(reference)}`));
  }
  lines.push(`Prompt: ${resume.prompt}`);
  return lines;
}

function formatRunbookResumeReference(reference: StartMissionResumeReference): string {
  const detail = reference.instruction ?? reference.command ?? reference.label;
  return `${reference.id} (${reference.label}): ${detail}`;
}

function formatRunbookInputBinding(binding: StartMissionInputBinding): string {
  return `${binding.placeholder} -> ${binding.inputId} (${binding.label}): ${binding.instruction}`;
}

function formatRunbookChecklistItem(item: StartMissionResumeChecklistItem): string {
  const action = item.command
    ?? (item.placeholder && item.instruction ? `${item.placeholder} -> ${item.instruction}` : undefined)
    ?? item.instruction
    ?? item.label;
  return `[${item.status}] ${item.kind} ${item.stepId}: ${action}${formatRunbookChecklistAnnotation(item)}`;
}

function formatRunbookChecklistAnnotation(item: StartMissionResumeChecklistItem): string {
  if (item.tool) {
    return ` (MCP: ${formatRunbookToolCall({ tool: item.tool, ...(typeof item.args !== 'undefined' ? { args: item.args } : {}) })})`;
  }
  if (item.kind === 'run_proof' && item.command) return ' (CLI only)';
  return '';
}

function formatRunbookToolCall(toolCall: NonNullable<StartMissionResume['toolCall']>): string {
  return typeof toolCall.args !== 'undefined'
    ? `${toolCall.tool} ${JSON.stringify(toolCall.args)}`
    : toolCall.tool;
}

function formatRunbookProofToolCall(toolCall: StartMissionProofToolCall): string {
  return `${toolCall.stepId}: ${formatRunbookToolCall(toolCall)}`;
}

function formatRunbookProofItem(item: StartMissionProofItem): string {
  const proofAction = item.toolCall ? `MCP: ${formatRunbookToolCall(item.toolCall)}` : 'CLI only';
  return `${item.stepId}: \`${item.command}\` (${proofAction})`;
}

function formatRunbookFollowUp(followUp: NonNullable<StartMissionResume['followUps']>[number]): string {
  const action = followUp.command
    ?? (followUp.tool ? formatRunbookToolCall({ tool: followUp.tool, ...(typeof followUp.args !== 'undefined' ? { args: followUp.args } : {}) }) : followUp.label);
  return `${followUp.id} (${followUp.label}): ${action}`;
}

function renderRunbookCursorLines(cursor: StartExecutionCursor): string[] {
  const lines = [
    '## Current Cursor',
    `- Step: ${cursor.stepId} in ${cursor.phaseId}`,
  ];
  if (cursor.command) {
    lines.push(`- Command: \`${cursor.command}\``);
  } else if (cursor.instruction) {
    lines.push(`- Input: ${cursor.instruction}`);
  } else {
    lines.push(`- Label: ${cursor.label}`);
  }
  if (cursor.tool) {
    lines.push(`- MCP call: ${formatRunbookToolCall({ tool: cursor.tool, ...(typeof cursor.args !== 'undefined' ? { args: cursor.args } : {}) })}`);
  }
  if (cursor.blockedBy && cursor.blockedBy.length > 0) {
    lines.push(`- Blocked by: ${cursor.blockedBy.join(', ')}`);
  }
  if (cursor.unlocks && cursor.unlocks.length > 0) {
    lines.push(`- Unlocks: ${cursor.unlocks.join(', ')}`);
  }
  lines.push(`- Why: ${cursor.reason}`);
  return lines;
}

function buildMissionExecutionPlan(input: {
  primaryAction: PreflightSuggestedAction;
  actionPlan: PreflightSuggestedAction[];
  readyActions: PreflightSuggestedAction[];
  unresolvedInputs: StartUnresolvedInput[];
  successCriteria: string[];
  proofCommands: string[];
}): StartExecutionPlan {
  const phases: StartExecutionPhase[] = [];
  const readyStepIds = input.readyActions.map((_, index) => `ready-${index + 1}`);
  const inputStepIdsByPlaceholder = new Map(
    input.unresolvedInputs.map((item, index) => [item.placeholder, `input-${index + 1}`]),
  );
  const nextActionStep = actionToExecutionStep('next-action-1', input.primaryAction);
  phases.push({
    id: 'next_action',
    title: 'Next Action',
    status: nextActionStep.status,
    steps: [nextActionStep],
  });

  if (input.readyActions.length > 0) {
    phases.push({
      id: 'ready_now',
      title: 'Ready Commands',
      status: 'ready',
      steps: input.readyActions.map((action, index) => {
        const step = actionToExecutionStep(`ready-${index + 1}`, action);
        const unlockedInputs = Array.from(inputStepIdsByPlaceholder.values());
        if (index === 0 && unlockedInputs.length > 0) step.unlocks = unlockedInputs;
        return step;
      }),
    });
  }

  if (input.unresolvedInputs.length > 0) {
    phases.push({
      id: 'resolve_inputs',
      title: 'Resolve Inputs',
      status: 'blocked',
      steps: input.unresolvedInputs.map((item, index): StartExecutionStep => {
        const id = `input-${index + 1}`;
        const followUps = followUpIdsForPlaceholder(input.actionPlan, item.placeholder);
        return {
          id,
          kind: 'input',
          status: 'blocked',
          label: item.name,
          ...(readyStepIds[0] ? { dependsOn: [readyStepIds[0]] } : {}),
          ...(followUps.length > 0 ? { unlocks: followUps } : {}),
          placeholder: item.placeholder,
          instruction: item.instruction,
        };
      }),
    });
  }

  const pendingActions = input.actionPlan.filter((action) => !isReadyAction(action));
  if (pendingActions.length > 0) {
    phases.push({
      id: 'follow_up',
      title: 'Follow Up',
      status: 'pending',
      steps: pendingActions.map((action, index) => {
        const step = actionToExecutionStep(`follow-up-${index + 1}`, action);
        const blockedBy = placeholdersInAction(action)
          .map((placeholder) => inputStepIdsByPlaceholder.get(placeholder))
          .filter((id): id is string => typeof id === 'string');
        if (blockedBy.length > 0) {
          step.blockedBy = blockedBy;
          step.dependsOn = uniqueStrings([readyStepIds[0] ?? '', ...blockedBy].filter(Boolean));
        }
        return step;
      }),
    });
  }

  if (input.proofCommands.length > 0) {
    phases.push({
      id: 'proof',
      title: 'Proof',
      status: 'ready',
      steps: input.proofCommands.map((command, index): StartExecutionStep => {
        const toolCall = proofCommandToolCall(command);
        return {
          id: `proof-${index + 1}`,
          kind: 'proof',
          status: 'ready',
          label: command,
          command,
          ...(toolCall ? {
            tool: toolCall.tool,
            ...(typeof toolCall.args !== 'undefined' ? { args: toolCall.args } : {}),
          } : {}),
        };
      }),
    });
  }

  phases.push({
    id: 'done_when',
    title: 'Done When',
    status: 'pending',
    steps: input.successCriteria.map((criterion, index): StartExecutionStep => ({
      id: `criterion-${index + 1}`,
      kind: 'criterion',
      status: 'pending',
      label: criterion,
    })),
  });

  const cursor = executionCursor(phases);
  return {
    summary: executionPlanSummary(input.readyActions.length, input.unresolvedInputs.length, input.proofCommands.length),
    currentPhase: cursor.phaseId,
    cursor,
    phases,
  };
}

function actionToExecutionStep(id: string, action: PreflightSuggestedAction): StartExecutionStep {
  const step: StartExecutionStep = {
    id,
    kind: 'tool',
    status: executionStatusForAction(action),
    label: action.label,
  };
  if (typeof action.command === 'string') step.command = action.command;
  if (typeof action.tool === 'string') step.tool = action.tool;
  if (action.args) step.args = action.args;
  return step;
}

function followUpIdsForPlaceholder(actionPlan: PreflightSuggestedAction[], placeholder: string): string[] {
  return actionPlan
    .filter((action) => !isReadyAction(action))
    .map((action, index) => ({ action, id: `follow-up-${index + 1}` }))
    .filter(({ action }) => placeholdersInAction(action).includes(placeholder))
    .map(({ id }) => id);
}

function placeholdersInAction(action: PreflightSuggestedAction): string[] {
  const placeholders = new Set<string>();
  if (typeof action.command === 'string') {
    for (const match of action.command.matchAll(/<[^<>]+>/g)) placeholders.add(match[0]);
  }
  collectPlaceholdersFromValue(action.args, placeholders);
  return Array.from(placeholders);
}

function collectPlaceholdersFromValue(value: unknown, placeholders: Set<string>): void {
  if (typeof value === 'string') {
    if (isPlaceholder(value)) placeholders.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPlaceholdersFromValue(item, placeholders);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectPlaceholdersFromValue(item, placeholders);
  }
}

function executionStatusForAction(action: PreflightSuggestedAction): StartExecutionStatus {
  if (isReadyAction(action)) return 'ready';
  if ((typeof action.command === 'string' && !isRunnableCommand(action.command)) || !argsAreReady(action.args)) {
    return 'blocked';
  }
  return 'pending';
}

function executionCursor(phases: StartExecutionPhase[]): StartExecutionCursor {
  const selected =
    findExecutionStep(phases, (phase, step) => phase.id === 'ready_now' && step.status === 'ready' && typeof step.command === 'string')
    ?? findExecutionStep(phases, (phase, step) => phase.id === 'resolve_inputs' && step.status === 'blocked')
    ?? findExecutionStep(phases, (phase, step) => phase.id === 'proof' && step.status === 'ready')
    ?? findExecutionStep(phases, (phase) => phase.id === 'done_when')
    ?? findExecutionStep(phases, (phase) => phase.id === 'next_action');
  if (!selected) {
    return {
      phaseId: 'done_when',
      stepId: 'criterion-1',
      status: 'pending',
      kind: 'criterion',
      label: 'The next action is complete and verified.',
      reason: 'Use this criterion to decide when the task is complete.',
    };
  }
  return {
    phaseId: selected.phase.id,
    stepId: selected.step.id,
    status: selected.step.status,
    kind: selected.step.kind,
    label: selected.step.label,
    ...(selected.step.command ? { command: selected.step.command } : {}),
    ...(selected.step.tool ? { tool: selected.step.tool } : {}),
    ...(typeof selected.step.args !== 'undefined' ? { args: selected.step.args } : {}),
    ...(selected.step.instruction ? { instruction: selected.step.instruction } : {}),
    ...(selected.step.placeholder ? { placeholder: selected.step.placeholder } : {}),
    ...(selected.step.blockedBy && selected.step.blockedBy.length > 0 ? { blockedBy: selected.step.blockedBy } : {}),
    ...(selected.step.unlocks && selected.step.unlocks.length > 0 ? { unlocks: selected.step.unlocks } : {}),
    reason: executionCursorReason(selected.step),
  };
}

function findExecutionStep(
  phases: StartExecutionPhase[],
  predicate: (phase: StartExecutionPhase, step: StartExecutionStep) => boolean,
): { phase: StartExecutionPhase; step: StartExecutionStep } | undefined {
  for (const phase of phases) {
    for (const step of phase.steps) {
      if (predicate(phase, step)) return { phase, step };
    }
  }
  return undefined;
}

function executionCursorReason(step: StartExecutionStep): string {
  if (step.status === 'ready' && step.kind === 'tool') {
    return step.unlocks && step.unlocks.length > 0
      ? 'Run this ready command next; it can unlock later inputs or follow-up steps.'
      : 'Run this ready command next.';
  }
  if (step.status === 'blocked' && step.kind === 'input') {
    return 'Resolve this blocked input before running dependent follow-up steps.';
  }
  if (step.status === 'ready' && step.kind === 'proof') {
    return 'Run this proof command when action steps are complete.';
  }
  if (step.kind === 'criterion') {
    return 'Use this criterion to decide when the task is complete.';
  }
  return 'Use this step as the current execution pointer.';
}

function executionPlanSummary(readyCount: number, inputCount: number, proofCount: number): string {
  const pieces = [`Run ${readyCount} ready ${pluralize(readyCount, 'step')}`];
  if (inputCount > 0) pieces.push(`resolve ${inputCount} input(s)`);
  if (proofCount > 0) pieces.push(`then gather ${proofCount} proof command(s)`);
  return `${pieces.join(', ')}.`;
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function missionHandoff(
  currentStep: StartExecutionCursor,
  resume: StartMissionResume,
  nextAction: PreflightSuggestedAction,
  readyActions: PreflightSuggestedAction[],
  needsInput: StartUnresolvedInput[],
  doneWhen: string[],
  proofCommands: string[],
  reviewGate: StartMissionReviewGate,
): StartMissionControl['handoff'] {
  const readyProofCommands = resume.remainingProofCommands ?? proofCommands;
  const readyProofToolCalls = resume.remainingProofToolCalls;
  const readyProofItems = resume.remainingProofItems;
  return {
    currentStep,
    resume,
    reviewGate,
    nextAction,
    readyActions,
    needsInput,
    doneWhen,
    readyProof: {
      summary: READY_PROOF_SUMMARY,
      commands: readyProofCommands,
      ...(readyProofToolCalls && readyProofToolCalls.length > 0 ? { toolCalls: readyProofToolCalls } : {}),
      ...(readyProofItems && readyProofItems.length > 0 ? { items: readyProofItems } : {}),
    },
  };
}

function missionHandoffPrompt(
  resume: StartMissionResume,
  successCriteria: string[],
  whyNow: string,
  unresolvedInputs: StartUnresolvedInput[],
  proofCommands: string[],
  reviewGate: StartMissionReviewGate,
): string {
  const needsInput = unresolvedInputs.length > 0
    ? ` Needs input: ${unresolvedInputs.map((input) => `${input.name}=${input.placeholder}`).join(', ')}.`
    : '';
  const proofCommandText = (resume.remainingProofCommands ?? proofCommands).slice(0, 3).join(' && ');
  const readyProof = proofCommandText.length > 0
    ? ` Ready proof: ${READY_PROOF_SUMMARY} ${proofCommandText}.`
    : ` Ready proof: ${READY_PROOF_SUMMARY}.`;
  return `Resume: ${trimTrailingPunctuation(resume.prompt)}. Done when: ${trimTrailingPunctuation(successCriteria[0] ?? 'The proof commands pass')}.${needsInput} Why: ${whyNow}${readyProof}${handoffReviewGatePrompt(reviewGate)}`;
}

function handoffReviewGatePrompt(reviewGate: StartMissionReviewGate): string {
  const decisions = reviewGate.decisions
    .map((decision) => `${decision.label} => ${decision.reply}`)
    .join('; ');
  return ` Review gate: ${trimTrailingPunctuation(reviewGate.stopCondition)}. Reviewer replies: ${decisions}`;
}

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[.!?]+$/g, '');
}

function routesForIntent(intent: string | undefined): StartRoutedIntent[] {
  if (!intent) return [];
  return routeIntent(intent).matches.map(routeEntryToStartIntent);
}

function routeEntryToStartIntent(entry: RouteMatch): StartRoutedIntent {
  return {
    intent: entry.intent,
    category: entry.category,
    tool: entry.tool,
    cli: entry.cli,
    why: entry.why,
    example: entry.example,
    confidence: entry.confidence,
    rank: entry.rank,
    score: entry.score,
    matchedKeywords: entry.matchedKeywords,
  };
}

function routedWhyNow(route: StartRoutedIntent, actionPlan: PreflightSuggestedAction[]): string {
  if (route.tool === 'projscan_impact' && actionPlan[0]?.tool === 'projscan_search') {
    return `Intent matched "${route.intent}", but the target is a phrase, so search first and then run ${route.tool} on the exact symbol or file.`;
  }
  if (route.tool === 'projscan_fix_suggest' && actionPlan[0]?.tool === 'projscan_doctor') {
    return `Intent matched "${route.intent}", but no issue id was named, so run projscan_doctor first and then run ${route.tool} on the selected issue.`;
  }
  if (route.tool === 'projscan_explain_issue' && actionPlan[0]?.tool === 'projscan_doctor') {
    return `Intent matched "${route.intent}", but no issue id was named, so run projscan_doctor first and then run ${route.tool} on the selected issue.`;
  }
  if (route.tool === 'projscan_upgrade' && actionPlan[0]?.tool === 'projscan_outdated') {
    return `Intent matched "${route.intent}", but no package was named, so run projscan_outdated first and then run ${route.tool} on the selected package.`;
  }
  return `Intent matched "${route.intent}", so start with ${route.tool} before broader workflow commands.`;
}

function missionStatus(
  setupOverall: StartReport['setup']['overall'],
  verdict: WorkplanReport['verdict'],
  adoptionGaps: StartAdoptionGap[],
): StartMissionControlStatus {
  if (setupOverall === 'fail' || verdict === 'block') return 'blocked';
  if (adoptionGaps.some((gap) => gap.status === 'fail')) return 'needs_setup';
  if (setupOverall === 'warn' || verdict === 'caution' || adoptionGaps.some((gap) => gap.status === 'warn')) return 'needs_attention';
  return 'ready';
}

function actionFromRoute(intent: string, route: StartRoutedIntent): PreflightSuggestedAction {
  const args = argsFromRouteIntent(intent, route);
  return {
    label: `Use ${route.tool} for ${intent}`,
    command: commandFromRouteIntent(intent, route, args),
    tool: route.tool,
    args,
  };
}

function missionActionPlan(
  intent: string | undefined,
  route: StartRoutedIntent | undefined,
  fixFirst: StartReport['fixFirst'],
  workplan: WorkplanReport,
  workflow: StartWorkflowRecommendation,
): PreflightSuggestedAction[] {
  if (route && intent) return actionPlanFromRoute(intent, route);
  const fallback = actionFromFixFirst(fixFirst) ?? actionFromWorkplan(workplan) ?? actionFromWorkflow(workflow);
  return [fallback];
}

function actionPlanFromRoute(intent: string, route: StartRoutedIntent): PreflightSuggestedAction[] {
  if (route.tool === 'projscan_impact') return impactActionPlan(intent, route);
  if (route.tool === 'projscan_fix_suggest') return fixSuggestActionPlan(intent, route);
  if (route.tool === 'projscan_explain_issue') return explainIssueActionPlan(intent, route);
  if (route.tool === 'projscan_upgrade') return upgradeActionPlan(intent, route);
  if (route.tool === 'projscan_semantic_graph') return semanticGraphActionPlan(intent, route);
  if (route.tool === 'projscan_coupling') return couplingActionPlan(intent, route);
  if (route.tool === 'projscan_claim') return claimActionPlan(intent, route);
  return [actionFromRoute(intent, route)];
}

function impactActionPlan(intent: string, route: StartRoutedIntent): PreflightSuggestedAction[] {
  const target = extractImpactTarget(intent) ?? extractFileTarget(intent);
  const impactLabel = `Use ${route.tool} for ${intent}`;
  if (target && isFilePathTarget(target)) {
    return [
      {
        label: impactLabel,
        command: `projscan impact ${quoteShellArg(target)} --format json`,
        tool: route.tool,
        args: { file: target },
      },
    ];
  }
  if (target && isExactSymbolTarget(target)) {
    return [
      {
        label: impactLabel,
        command: `projscan impact --symbol ${target} --format json`,
        tool: route.tool,
        args: { symbol: target },
      },
    ];
  }
  const searchQuery = target ?? intent;
  return [
    {
      label: 'Find exact target for impact analysis',
      command: `projscan search "${escapeDoubleQuoted(searchQuery)}" --format json`,
      tool: 'projscan_search',
      args: { query: searchQuery },
    },
    {
      label: 'If search returns an exported symbol',
      command: 'projscan impact --symbol <symbol-from-search> --format json',
      tool: route.tool,
      args: { symbol: '<symbol-from-search>' },
    },
    {
      label: 'If search returns a file path',
      command: 'projscan impact <file-from-search> --format json',
      tool: route.tool,
      args: { file: '<file-from-search>' },
    },
  ];
}

function fixSuggestActionPlan(intent: string, route: StartRoutedIntent): PreflightSuggestedAction[] {
  const issueId = extractIssueIdTarget(intent);
  if (issueId) {
    return [
      {
        label: `Use ${route.tool} for ${issueId}`,
        command: `projscan fix-suggest ${quoteShellArg(issueId)} --format json`,
        tool: route.tool,
        args: { issue_id: issueId },
      },
    ];
  }

  return [
    {
      label: 'Find open issues before choosing a fix suggestion',
      command: 'projscan doctor --format json',
      tool: 'projscan_doctor',
    },
    {
      label: 'Use fix-suggest for the selected issue',
      command: 'projscan fix-suggest <issue-id-from-doctor> --format json',
      tool: route.tool,
      args: { issue_id: '<issue-id-from-doctor>' },
    },
  ];
}

function explainIssueActionPlan(intent: string, route: StartRoutedIntent): PreflightSuggestedAction[] {
  const issueId = extractIssueIdTarget(intent);
  if (issueId) {
    return [
      {
        label: `Explain issue ${issueId}`,
        command: `projscan explain-issue ${quoteShellArg(issueId)} --format json`,
        tool: route.tool,
        args: { issue_id: issueId },
      },
    ];
  }

  return [
    {
      label: 'Find open issues before explaining one',
      command: 'projscan doctor --format json',
      tool: 'projscan_doctor',
    },
    {
      label: 'Explain the selected issue',
      command: 'projscan explain-issue <issue-id-from-doctor> --format json',
      tool: route.tool,
      args: { issue_id: '<issue-id-from-doctor>' },
    },
  ];
}

function upgradeActionPlan(intent: string, route: StartRoutedIntent): PreflightSuggestedAction[] {
  const packageName = extractPackageTarget(intent);
  if (packageName) {
    return [
      {
        label: `Preview upgrade impact for ${packageName}`,
        command: `projscan upgrade ${quoteShellArg(packageName)} --format json`,
        tool: route.tool,
        args: { package: packageName },
      },
    ];
  }

  return [
    {
      label: 'Find package candidates before previewing an upgrade',
      command: 'projscan outdated --format json',
      tool: 'projscan_outdated',
    },
    {
      label: 'Preview upgrade impact for the selected package',
      command: 'projscan upgrade <package-from-outdated> --format json',
      tool: route.tool,
      args: { package: '<package-from-outdated>' },
    },
  ];
}

function semanticGraphActionPlan(intent: string, route: StartRoutedIntent): PreflightSuggestedAction[] {
  const query = graphQueryFromIntent(intent);
  if (query && graphQueryIsReady(query)) {
    return [
      {
        label: `Run targeted graph query for ${intent}`,
        command: semanticGraphCommand(query),
        tool: route.tool,
        args: { query },
      },
    ];
  }

  const fallback: StartGraphQuery = { direction: query?.direction ?? 'importers', file: '<file-from-intent>' };
  return [
    {
      label: 'Find the file or symbol for the graph query',
      command: `projscan search "${escapeDoubleQuoted(extractSearchQuery(intent))}" --format json`,
      tool: 'projscan_search',
      args: { query: extractSearchQuery(intent) },
    },
    {
      label: 'Run the targeted graph query',
      command: semanticGraphCommand(fallback),
      tool: route.tool,
      args: { query: fallback },
    },
  ];
}

function couplingActionPlan(intent: string, route: StartRoutedIntent): PreflightSuggestedAction[] {
  const direction = couplingDirectionFromIntent(intent);
  if (direction === 'cycles_only') {
    return [
      {
        label: 'Inspect circular import cycles',
        command: 'projscan coupling --cycles-only --format json',
        tool: route.tool,
        args: { direction },
      },
    ];
  }
  if (direction === 'high_fan_in') {
    return [
      {
        label: 'Inspect high fan-in files',
        command: 'projscan coupling --high-fan-in --format json',
        tool: route.tool,
        args: { direction },
      },
    ];
  }
  if (direction === 'high_fan_out') {
    return [
      {
        label: 'Inspect high fan-out files',
        command: 'projscan coupling --high-fan-out --format json',
        tool: route.tool,
        args: { direction },
      },
    ];
  }
  return [
    {
      label: 'Inspect file coupling and instability',
      command: 'projscan coupling --format json',
      tool: route.tool,
      args: {},
    },
  ];
}

function claimActionPlan(intent: string, route: StartRoutedIntent): PreflightSuggestedAction[] {
  if (isClaimListIntent(intent)) return [claimListAction(route)];
  const target = extractClaimTarget(intent) ?? '<target-from-intent>';
  const agent = extractClaimAgent(intent) ?? '<agent-name>';
  const addAction = claimAddAction(route, target, agent);
  if (!isPlaceholder(target) && !isPlaceholder(agent)) return [addAction];
  return [
    {
      label: 'Review active claims before adding a file claim',
      command: 'projscan claim list --format json',
      tool: route.tool,
      args: { action: 'list' },
    },
    addAction,
  ];
}

function claimListAction(route: StartRoutedIntent): PreflightSuggestedAction {
  return {
    label: 'Review active claims',
    command: 'projscan claim list --format json',
    tool: route.tool,
    args: { action: 'list' },
  };
}

function claimAddAction(route: StartRoutedIntent, target: string, agent: string): PreflightSuggestedAction {
  return {
    label: `Add claim for ${target}`,
    command: `projscan claim add ${quoteShellArgOrPlaceholder(target)} --agent ${quoteShellArgOrPlaceholder(agent)}`,
    tool: route.tool,
    args: { action: 'add', target, agent },
  };
}

function missionUnresolvedInputs(actionPlan: PreflightSuggestedAction[]): StartUnresolvedInput[] {
  const sourceAction = actionPlan[0]?.label ?? 'the previous action';
  const unresolved: StartUnresolvedInput[] = [];
  for (const action of actionPlan.slice(1)) {
    if (!action.args) continue;
    for (const [name, value] of Object.entries(action.args)) {
      if (typeof value !== 'string' || !isPlaceholder(value)) continue;
      unresolved.push({
        name,
        placeholder: value,
        sourceAction,
        instruction: placeholderInstruction(name, value),
      });
    }
  }
  return dedupeUnresolvedInputs(unresolved);
}

function missionReadyActions(actionPlan: PreflightSuggestedAction[]): PreflightSuggestedAction[] {
  return actionPlan.filter(isReadyAction);
}

function isReadyAction(action: PreflightSuggestedAction): boolean {
  if (typeof action.command === 'string' && !isRunnableCommand(action.command)) return false;
  if (!argsAreReady(action.args)) return false;
  return typeof action.command === 'string' || typeof action.tool === 'string';
}

function argsAreReady(value: unknown): boolean {
  if (typeof value === 'string') return !isPlaceholder(value);
  if (Array.isArray(value)) return value.every(argsAreReady);
  if (value && typeof value === 'object') return Object.values(value).every(argsAreReady);
  return true;
}

function isPlaceholder(value: string): boolean {
  return /^<[^<>]+>$/.test(value);
}

function placeholderInstruction(name: string, placeholder: string): string {
  if (name === 'symbol') return `Replace ${placeholder} with an exported symbol returned by the search step.`;
  if (name === 'file') return `Replace ${placeholder} with a file path returned by the search step.`;
  if (name === 'issue_id') return `Replace ${placeholder} with an issue id from projscan doctor or projscan analyze.`;
  if (name === 'package') return `Replace ${placeholder} with a package name from projscan outdated or projscan dependencies.`;
  if (name === 'target') return `Replace ${placeholder} with the file, directory, or symbol to claim.`;
  if (name === 'agent') return `Replace ${placeholder} with the agent name holding the claim.`;
  return `Replace ${placeholder} with the ${name} value produced by the previous step.`;
}

function dedupeUnresolvedInputs(inputs: StartUnresolvedInput[]): StartUnresolvedInput[] {
  const seen = new Set<string>();
  const result: StartUnresolvedInput[] = [];
  for (const input of inputs) {
    const key = `${input.name}:${input.placeholder}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(input);
  }
  return result;
}

function argsFromRouteIntent(intent: string, route: StartRoutedIntent): Record<string, unknown> {
  if (route.tool === 'projscan_privacy_check') return { offline: true };
  if (route.tool === 'projscan_preflight') return { mode: preflightModeFromIntent(intent) };
  if (route.tool === 'projscan_search') return { query: extractSearchQuery(intent) };
  if (route.tool === 'projscan_fix_suggest') return { issue_id: extractIssueIdTarget(intent) ?? '<issue-id-from-doctor>' };
  if (route.tool === 'projscan_explain_issue') return { issue_id: extractIssueIdTarget(intent) ?? '<issue-id-from-doctor>' };
  if (route.tool === 'projscan_upgrade') return { package: extractPackageTarget(intent) ?? '<package-from-outdated>' };
  if (route.tool === 'projscan_audit') {
    const packageName = extractAuditPackageTarget(intent);
    return packageName ? { package: packageName } : {};
  }
  if (route.tool === 'projscan_semantic_graph') return { query: graphQueryFromIntent(intent) ?? { direction: 'importers', file: '<file-from-intent>' } };
  if (route.tool === 'projscan_coupling') {
    const direction = couplingDirectionFromIntent(intent);
    return direction ? { direction } : {};
  }
  if (route.tool === 'projscan_file') return { file: extractFileTarget(intent) ?? '<file-from-intent>' };
  if (route.tool === 'projscan_understand') {
    const view = understandViewFromIntent(intent);
    return view === 'change' || view === 'verify' ? { view, intent } : { view };
  }
  if (route.tool === 'projscan_workplan') return { mode: 'before_edit' };
  if (route.tool === 'projscan_agent_brief') return { intent: agentBriefIntentFromIntent(intent) };
  if (route.tool === 'projscan_session') return { action: sessionActionFromIntent(intent) };
  if (route.tool === 'projscan_claim' && isClaimListIntent(intent)) return { action: 'list' };
  if (route.tool === 'projscan_claim') return { action: 'add', target: extractClaimTarget(intent) ?? '<target-from-intent>', agent: extractClaimAgent(intent) ?? '<agent-name>' };
  if (route.tool === 'projscan_regression_plan') return { level: regressionLevelFromIntent(intent) };
  if (route.tool === 'projscan_evidence_pack') return { pr_comment: true };
  return {};
}

function commandFromRouteIntent(
  intent: string,
  route: StartRoutedIntent,
  args: Record<string, unknown>,
): string {
  if (route.tool === 'projscan_privacy_check') return 'projscan privacy-check --offline';
  if (route.tool === 'projscan_preflight') return `projscan preflight --mode ${String(args.mode)} --format json`;
  if (route.tool === 'projscan_search') return `projscan search "${escapeDoubleQuoted(String(args.query))}" --format json`;
  if (route.tool === 'projscan_fix_suggest') {
    const issueId = String(args.issue_id);
    return `projscan fix-suggest ${isPlaceholder(issueId) ? issueId : quoteShellArg(issueId)} --format json`;
  }
  if (route.tool === 'projscan_explain_issue') {
    const issueId = String(args.issue_id);
    return `projscan explain-issue ${isPlaceholder(issueId) ? issueId : quoteShellArg(issueId)} --format json`;
  }
  if (route.tool === 'projscan_upgrade') {
    const packageName = String(args.package);
    return `projscan upgrade ${isPlaceholder(packageName) ? packageName : quoteShellArg(packageName)} --format json`;
  }
  if (route.tool === 'projscan_audit') {
    const packageName = typeof args.package === 'string' ? args.package : undefined;
    return packageName ? `projscan audit --package ${quoteShellArg(packageName)} --format json` : 'projscan audit --format json';
  }
  if (route.tool === 'projscan_semantic_graph') return semanticGraphCommand(args.query as StartGraphQuery);
  if (route.tool === 'projscan_coupling') return couplingCommandFromArgs(args);
  if (route.tool === 'projscan_file') return `projscan file ${quoteShellArg(String(args.file))} --format json`;
  if (route.tool === 'projscan_understand') {
    const view = String(args.view);
    const routedIntent = typeof args.intent === 'string' ? ` --intent ${quoteShellArg(args.intent)}` : '';
    return `projscan understand --view ${view}${routedIntent} --format json`;
  }
  if (route.tool === 'projscan_workplan') return 'projscan workplan --mode before_edit --format json';
  if (route.tool === 'projscan_agent_brief') return `projscan agent-brief --intent ${String(args.intent)} --format json`;
  if (route.tool === 'projscan_session') return sessionCommandFromAction(String(args.action));
  if (route.tool === 'projscan_claim') return claimCommandFromArgs(args);
  if (route.tool === 'projscan_regression_plan') return `projscan regression-plan --level ${String(args.level)} --format json`;
  if (route.tool === 'projscan_evidence_pack') return 'projscan evidence-pack --pr-comment';
  return route.example;
}

function claimCommandFromArgs(args: Record<string, unknown>): string {
  const action = String(args.action ?? 'list');
  if (action === 'add') {
    const target = String(args.target ?? '<target-from-intent>');
    const agent = String(args.agent ?? '<agent-name>');
    return `projscan claim add ${quoteShellArgOrPlaceholder(target)} --agent ${quoteShellArgOrPlaceholder(agent)}`;
  }
  return 'projscan claim list --format json';
}

function preflightModeFromIntent(intent: string): 'before_edit' | 'before_commit' | 'before_merge' {
  const text = intent.toLowerCase();
  if (/\b(?:merge|merged|merging|release|rebase|rebasing|conflict|conflicts|resolve|resolving)\b/.test(text)) return 'before_merge';
  if (/\bcommit|committing|committed|pr|pull\s+request\b/.test(text)) return 'before_commit';
  return 'before_edit';
}

function regressionModeFromIntent(intent: string): 'before_commit' | 'before_merge' {
  return /\bmerge|merged|merging|release\b/i.test(intent) ? 'before_merge' : 'before_commit';
}

function reviewModeFromIntent(intent: string): 'before_commit' | 'before_merge' {
  return /\bmerge|merged|merging\b/i.test(intent) ? 'before_merge' : 'before_commit';
}

function regressionLevelFromIntent(intent: string): RegressionPlanLevel {
  const text = intent.toLowerCase();
  if (/\b(?:smoke|quick|minimum|minimal)\b/.test(text)) return 'smoke';
  if (/\b(?:full|complete|comprehensive|exhaustive|release-grade)\b/.test(text)) return 'full';
  return 'focused';
}

function agentBriefIntentFromIntent(intent: string): AgentBriefIntent {
  const text = intent.toLowerCase();
  if (/\b(?:bug|bugs|fix|hunt)\b/.test(text)) return 'bug_hunt';
  if (/\b(?:release|ship|shipping|publish)\b/.test(text)) return 'release';
  if (/\b(?:refactor|cleanup|simplify)\b/.test(text)) return 'refactor';
  if (/\b(?:hardening|security|dataflow|taint|injection)\b/.test(text)) return 'hardening';
  return 'next_agent';
}

function sessionActionFromIntent(intent: string): 'current' | 'touched' | 'events' {
  const text = intent.toLowerCase();
  if (/\b(?:event|events|history|log|logs|timeline)\b/.test(text)) return 'events';
  if (/\b(?:current|summary|status)\b/.test(text)) return 'current';
  return 'touched';
}

function sessionCommandFromAction(action: string): string {
  if (action === 'events') return 'projscan session events --format json';
  if (action === 'current') return 'projscan session --format json';
  return 'projscan session touched --format json';
}

function couplingDirectionFromIntent(intent: string): 'cycles_only' | 'high_fan_in' | 'high_fan_out' | undefined {
  const text = intent.toLowerCase();
  if (/\b(?:circular|cycle|cycles)\b/.test(text)) return 'cycles_only';
  if (/\bfan[-\s]?in\b|\bdepended\s+on\b|\bmost\s+depended\b/.test(text)) return 'high_fan_in';
  if (/\bfan[-\s]?out\b/.test(text)) return 'high_fan_out';
  return undefined;
}

function couplingCommandFromArgs(args: Record<string, unknown>): string {
  const direction = typeof args.direction === 'string' ? args.direction : 'all';
  if (direction === 'cycles_only') return 'projscan coupling --cycles-only --format json';
  if (direction === 'high_fan_in') return 'projscan coupling --high-fan-in --format json';
  if (direction === 'high_fan_out') return 'projscan coupling --high-fan-out --format json';
  return 'projscan coupling --format json';
}

function isClaimListIntent(intent: string): boolean {
  const text = intent.toLowerCase();
  return /\b(?:show|list|view|active)\b/.test(text) && /\b(?:claim|claims|lease|leases)\b/.test(text);
}

function understandViewFromIntent(intent: string): UnderstandView {
  const text = intent.toLowerCase();
  if (isPackageScriptDiscoveryIntent(text)) return 'contracts';
  if (/\bnpm\s+scripts?\b|\bscripts?\s+(?:exist|available|defined|configured)\b/.test(text)) return 'contracts';
  if (isLocalServiceSetupIntent(text)) return 'contracts';
  if (/\b(?:seed|seeds|reset|resets|migrate|migrates|run|runs)\b.*\b(?:database|db|migrations?)\b|\b(?:database|db|migrations?)\b.*\b(?:seed|seeds|reset|resets|migrate|migrates|run|runs|command)\b/.test(text)) return 'contracts';
  if (/\b(?:contract|contracts|public\s+api|public\s+apis|public\s+exports?|api\s+surface|deprecat(?:e|es|ed|ion|ing)|compatibility|compatible|env(?:ironment)?\s+vars?|env(?:ironment)?\s+variables?|config|configuration)\b/.test(text)) return 'contracts';
  if (/\b(?:flow|flows|runtime|request\s+path|execution\s+path)\b/.test(text)) return 'flow';
  if (isVerificationPlanningIntent(text)) return 'verify';
  if (/\b(?:verify|verification|proof|test\s+plan|checks?)\b/.test(text)) return 'verify';
  if (/\b(?:change|readiness|before\s+changing|before\s+rename|feature|endpoint|button|where\s+should\s+i\s+(?:put|add)|files\s+do\s+i\s+need\s+to\s+change|add|implement|build|create|wire|route|component|page|screen|view|webhook|login|checkout|migration|migrations|database|db|schema|table|column)\b/.test(text)) return 'change';
  return 'map';
}

function isVerificationPlanningIntent(text: string): boolean {
  if (/\b(?:smoke|focused|full|regression|fail|failing|failed|failure|failures|error|errors|broken|debug|flake|flaky|slow|slower|reproduce|quarantine)\b/.test(text)) {
    return false;
  }
  const proofSelectionSignal = /\b(?:run|should|need|needs|must|before|push|pushing|prove|proof|verify|verification|checks?)\b/.test(text);
  if (!proofSelectionSignal && /\b(?:which|what|where|find|locate|search)\b.*\b(?:tests?|specs?)\b.*\b(?:cover|covers|covering|for)\b/.test(text)) {
    return false;
  }
  if (/\b(?:coverage|scariest|untested|uncovered|gap|gaps|missing\s+tests?|no\s+tests?)\b/.test(text)) {
    return false;
  }
  const testSubject = /\b(?:tests?|specs?|e2e|unit|integration|lint|typecheck|typechecking|build)\b/.test(text);
  const proofSignal = /\b(?:verify|verification|proof|prove|checks?)\b/.test(text);
  const gateSignal = /\b(?:before|push|pushing|commit|committing|review|merge|pr)\b/.test(text);
  const shouldSignal = /\b(?:should|need|needs|must)\b/.test(text);
  return (testSubject && (shouldSignal || gateSignal || proofSignal)) || (proofSignal && gateSignal);
}

function isPackageScriptDiscoveryIntent(text: string): boolean {
  if (/\b(?:fail|failing|failed|failure|failures|error|errors|broken|debug|flake|flaky|slow|rerun|reproduce|quarantine)\b/.test(text)) {
    return false;
  }
  const scriptTarget = /\b(?:tests?|e2e|unit|integration|storybook|cypress|playwright|eslint|prettier|format|lint|typecheck|typechecking|build)\b/.test(text);
  const scriptSubject = /\b(?:scripts?|commands?)\b/.test(text);
  const runSignal = /\b(?:run|runs|start)\b/.test(text);
  const directScriptTarget = /\b(?:e2e|storybook|cypress|playwright|eslint|prettier|format|lint|typecheck|typechecking|build)\b/.test(text);
  return (
    /\b(?:npm|package)\s+scripts?\b/.test(text) ||
    (scriptTarget && scriptSubject) ||
    (directScriptTarget && runSignal && !/\bshould\b/.test(text))
  );
}

function isLocalServiceSetupIntent(text: string): boolean {
  if (/\b(?:fail|failing|failed|failure|failures|error|errors|broken|connection\s+refused|port|eaddrinuse|permission\s+denied|enoent|eresolve|peer)\b/.test(text)) {
    return false;
  }
  const action = /\b(?:run|runs|start|starts|command|commands|setup|set\s+up)\b/.test(text);
  const localServices = /\b(?:local|locally|dev)\b.*\bservices?\b|\bservices?\b.*\b(?:local|locally|dev)\b/.test(text);
  const dockerCompose = /\bdocker\s+compose\b/.test(text);
  return action && (localServices || dockerCompose);
}

function extractSearchQuery(intent: string): string {
  const trimmed = intent.trim();
  const file = extractFileTarget(trimmed);
  if (file && /\b(?:where|find|locate|search)\b/i.test(trimmed) && /\btests?\b/i.test(trimmed)) {
    return `tests for ${file}`;
  }
  const envVar = extractEnvVarTarget(trimmed);
  if (envVar && /\b(?:where|find|locate|search|lookup|used|referenced|process)\b/i.test(trimmed)) {
    return envVar;
  }
  const envControl = trimmed.match(
    /\b(?:which|what|where|find|locate|search(?:\s+for)?|lookup)\s+(?:env(?:ironment)?\s+)?(?:var|vars|variable|variables)\s+(?:controls?|configures?|sets?|for)\s+(.+?)\s*[?!.]*$/i,
  );
  if (envControl?.[1]) return `${unwrapTarget(envControl[1].trim())} env var`;
  const quotedDebugText = extractQuotedTextTarget(trimmed);
  if (quotedDebugText && /\b(?:error|errors|message|messages|throws?|thrown|logs?|logged|logging)\b/i.test(trimmed)) {
    return quotedDebugText;
  }
  const observability = extractObservabilityQuery(trimmed);
  if (observability) return observability;
  const backgroundWork = extractBackgroundWorkQuery(trimmed);
  if (backgroundWork) return backgroundWork;
  const testData = extractTestDataQuery(trimmed);
  if (testData) return testData;
  const authorization = extractAuthorizationQuery(trimmed);
  if (authorization) return authorization;
  const reliability = extractReliabilityQuery(trimmed);
  if (reliability) return reliability;
  const dataContract = extractDataContractQuery(trimmed);
  if (dataContract) return dataContract;
  const uiInteraction = extractUiInteractionQuery(trimmed);
  if (uiInteraction) return uiInteraction;
  const styleSystem = extractStyleSystemQuery(trimmed);
  if (styleSystem) return styleSystem;
  const navigationLayout = extractNavigationLayoutQuery(trimmed);
  if (navigationLayout) return navigationLayout;
  const frontendPageRoute = extractFrontendPageRouteQuery(trimmed);
  if (frontendPageRoute) return frontendPageRoute;
  const stateManagement = extractStateManagementQuery(trimmed);
  if (stateManagement) return stateManagement;
  const dataAccess = extractDataAccessQuery(trimmed);
  if (dataAccess) return dataAccess;
  const integration = extractIntegrationQuery(trimmed);
  if (integration) return integration;
  const apiContract = extractApiContractQuery(trimmed);
  if (apiContract) return apiContract;
  const infraArtifact = extractInfraArtifactQuery(trimmed);
  if (infraArtifact) return infraArtifact;
  const communicationArtifact = extractCommunicationArtifactQuery(trimmed);
  if (communicationArtifact) return communicationArtifact;
  const domainWorkflow = extractDomainWorkflowQuery(trimmed);
  if (domainWorkflow) return domainWorkflow;
  const testCoverageLookup = trimmed.match(
    /\b(?:which|what|find|locate|search(?:\s+for)?|where\s+(?:are|is))\s+(?:the\s+)?(?:tests?|specs?)\s+(?:that\s+)?(?:cover|covers|covering)\s+(.+?)\s*[?!.]*$/i,
  );
  if (testCoverageLookup?.[1]) return `tests for ${unwrapTarget(testCoverageLookup[1].trim())}`;
  const testLocation = trimmed.match(
    /\b(?:where\s+(?:are|is)\s+|find\s+|locate\s+|search\s+(?:for\s+)?|lookup\s+)?(?:the\s+)?(?:tests?|specs?)\s+(?:for|of)\s+(.+?)\s*[?!.]*$/i,
  );
  if (testLocation?.[1]) return `tests for ${unwrapTarget(testLocation[1].trim())}`;
  const routePath = trimmed.match(/(?:^|\s)((?:(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+)?\/[A-Za-z0-9_./:{}-]+)/i);
  if (routePath?.[1] && /\b(?:handler|handles?|handled|route|routes|endpoint|endpoints|where|find|locate|search)\b/i.test(trimmed)) {
    return routePath[1].trim();
  }
  const codeHandler = trimmed.match(
    /\b(?:what|which)\s+(?:code|file|files)?\s*(?:handles?|contains|loads?|parses?|configures?|creates?)\s+(.+?)\s*[?!.]*$/i,
  );
  if (codeHandler?.[1]) return unwrapTarget(codeHandler[1].trim());
  const featureFlags = trimmed.match(
    /\b(?:which|what|where|find|locate|search(?:\s+for)?|lookup)\s+(?:are\s+|is\s+|do\s+|does\s+)?(?:the\s+)?((?:feature\s+)?flags?)\s+(?:exist|exists|configured|loaded|defined)?\s*[?!.]*$/i,
  );
  if (featureFlags?.[1]) return featureFlags[1].toLowerCase().includes('feature') ? 'feature flags' : 'flags';
  const migrationLookup = trimmed.match(
    /\b(?:where\s+(?:are|is)|which|what|find|locate|search(?:\s+for)?|lookup|show)\s+(?:me\s+)?(?:the\s+)?((?:database\s+|prisma\s+)?migrations?|(?:database\s+)?migration\s+files?)\s*(?:exist|exists|ran|located|live)?\s*[?!.]*$/i,
  );
  if (migrationLookup?.[1]) {
    const target = migrationLookup[1].trim().toLowerCase();
    if (target.includes('prisma')) return 'Prisma migrations';
    if (target.includes('database')) return target.includes('file') ? 'database migration files' : 'database migrations';
    return target.includes('file') ? 'migration files' : 'migrations';
  }
  const generatedLookup = trimmed.match(
    /\b(?:show|find|locate|search(?:\s+for)?|where\s+(?:are|is)|which|what|is)\s+(?:me\s+)?(?:this\s+)?(?:the\s+)?(.+?)\s*[?!.]*$/i,
  );
  if (generatedLookup?.[1] && /\bgenerated\b/i.test(generatedLookup[1])) {
    if (/\bfiles?\b/i.test(generatedLookup[1])) return 'generated files';
    if (/\bcode\b/i.test(generatedLookup[1])) return 'generated code';
  }
  const toolingConfig = extractToolingConfigQuery(trimmed);
  if (toolingConfig) return toolingConfig;
  const configDefinitionLookup = trimmed.match(
    /\bwhich\s+(?:config(?:uration)?\s+files?|files?)\s+(?:defines?|contains|sets?|configures?)\s+(.+?)\s*[?!.]*$/i,
  );
  if (configDefinitionLookup?.[1] && /\bconfig(?:uration)?\b/i.test(trimmed)) return `${unwrapTarget(configDefinitionLookup[1].trim())} config`;
  const configLookup = trimmed.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup|show)\s+(?:the\s+)?(.+?\bconfig(?:uration)?(?:\s+files?)?)\s*[?!.]*$/i,
  );
  if (configLookup?.[1]) return unwrapTarget(configLookup[1].trim());
  const ownership = trimmed.match(/\b(?:who|which\s+team)\s+owns?\s+(.+?)\s*[?!.]*$/i);
  if (ownership?.[1]) return unwrapTarget(ownership[1].trim());
  const ownershipHelp = trimmed.match(
    /\bwho\s+(?:should\s+i\s+ask|can\s+help|knows|is\s+(?:the\s+)?(?:expert|contact))\s*(?:about|with|for)?\s+(.+?)\s*[?!.]*$/i,
  );
  if (ownershipHelp?.[1]) return unwrapTarget(ownershipHelp[1].trim());
  const expertLookup = trimmed.match(
    /\b(?:find|locate|search(?:\s+for)?|lookup)\s+(?:an?\s+)?(?:expert|experts|contact|contacts)\s+(?:for|on|about|with)\s+(.+?)\s*[?!.]*$/i,
  );
  if (expertLookup?.[1]) return unwrapTarget(expertLookup[1].trim());
  const codeOwners = trimmed.match(/\b(?:find|locate|search(?:\s+for)?|lookup)\s+(?:code\s+)?owners?\s+(?:for|of)\s+(.+?)\s*[?!.]*$/i);
  if (codeOwners?.[1]) return unwrapTarget(codeOwners[1].trim());
  const whereImplemented = trimmed.match(
    /\bwhere\s+(?:is|are|do|does|we)?\s*(.+?)\s+(?:implemented|handled|configured|created|defined|loaded|parsed|documented)\b/i,
  );
  if (whereImplemented?.[1]) return unwrapTarget(whereImplemented[1].trim());
  const match = trimmed.match(/\b(?:search|find|locate|lookup)\s+(?:for\s+)?(.+)$/i);
  return unwrapTarget((match?.[1] ?? trimmed).trim());
}

function extractImpactTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  const usageMatch = compactIntent.match(
    /\bwhere\s+(?:is|are)\s+[`'"]?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)[`'"]?\s+(?:used|referenced|called)\b/i,
  );
  if (usageMatch?.[1] && !isGenericReferenceTarget(usageMatch[1])) return usageMatch[1];

  const match = compactIntent.match(/\b(?:rename|change|modify|delete|remove)\s+(?:the\s+|a\s+|an\s+)?(.+)$/i);
  const target = unwrapTarget((match?.[1] ?? '').trim());
  if (target.length === 0) return undefined;
  const normalized = target.replace(/\s+(?:in|from|inside)\s+(?:this\s+)?(?:repo|repository|codebase)$/i, '').trim();
  if (isGenericReferenceTarget(normalized)) return undefined;
  return normalized;
}

function isGenericReferenceTarget(target: string): boolean {
  return /^(?:it|this|that|thing|symbol|function|method|file|change|changes|break|breaks|breaking|safely|safe|carefully)$/i.test(target);
}

function extractFileTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const wrapped = compactIntent.match(/[`'"]([^`'"]+\.[A-Za-z0-9]{1,12})[`'"]/);
  if (wrapped?.[1] && isFilePathTarget(wrapped[1])) return wrapped[1];

  const pathMatch = compactIntent.match(/(?:^|\s)([A-Za-z0-9_./:@-]+\.[A-Za-z0-9]{1,12})(?:\s|$)/);
  if (pathMatch?.[1] && isFilePathTarget(pathMatch[1])) return unwrapTarget(pathMatch[1]);

  const slashPathMatch = compactIntent.match(/(?:^|\s)([A-Za-z0-9_./:@-]+\/[A-Za-z0-9_./:@-]+)(?:\s|$)/);
  if (slashPathMatch?.[1] && isFilePathTarget(slashPathMatch[1])) return unwrapTarget(slashPathMatch[1]);

  return undefined;
}

function extractEnvVarTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const processMatch = compactIntent.match(/\bprocess\.env\.[A-Za-z_][A-Za-z0-9_]*\b/);
  if (processMatch?.[0]) return processMatch[0];
  const envMatch = compactIntent.match(/\b([A-Z][A-Z0-9]*_[A-Z0-9_]+)\b/);
  return envMatch?.[1];
}

function extractClaimTarget(intent: string): string | undefined {
  return extractFileTarget(intent) ?? extractSymbolTarget(intent);
}

function extractClaimAgent(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const match = compactIntent.match(/\b(?:as|for|agent)\s+([A-Za-z0-9_.:@-]{2,64})\b/i);
  const candidate = match?.[1];
  if (!candidate || /^(?:me|myself|us|team|agent|owner)$/i.test(candidate)) return undefined;
  return candidate;
}

function extractIssueIdTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const wrapped = compactIntent.match(/[`'"]([^`'"]*[A-Za-z][^`'"]*-[^`'"]+)[`'"]/);
  if (wrapped?.[1] && isIssueIdTarget(wrapped[1])) return wrapped[1];

  const labeled = compactIntent.match(
    /\b(?:issue(?:\s+id)?|id|rule)\s+(?:is\s+|named\s+)?([A-Za-z0-9_:@.-]*[A-Za-z][A-Za-z0-9_:@.-]*-[A-Za-z0-9_:@.-]+)\b/i,
  );
  if (labeled?.[1] && isIssueIdTarget(labeled[1])) return labeled[1];

  const issueLike = compactIntent.match(/\b([A-Za-z0-9_:@.-]*[A-Za-z][A-Za-z0-9_:@.-]*-[A-Za-z0-9_:@.-]+)\b/);
  if (issueLike?.[1] && isIssueIdTarget(issueLike[1])) return issueLike[1];

  return undefined;
}

function extractPackageTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const wrapped = compactIntent.match(/[`'"](@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)[`'"]/);
  if (wrapped?.[1] && isPackageNameTarget(wrapped[1])) return normalizePackageName(wrapped[1]);

  const actionMatch = compactIntent.match(
    /\b(?:bump|upgrade|update|remove|drop|uninstall)\s+(?:the\s+)?(?:(?:package|dependency)\s+)?(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)(?=\s|$)/i,
  );
  if (actionMatch?.[1] && isPackageNameTarget(actionMatch[1])) return normalizePackageName(actionMatch[1]);

  const removalSubject = compactIntent.match(
    /\b(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\s+(?:safe\s+to\s+)?(?:remove|drop|uninstall)\b/i,
  );
  if (removalSubject?.[1] && isPackageNameTarget(removalSubject[1])) return normalizePackageName(removalSubject[1]);

  const labeled = compactIntent.match(
    /\b(?:package|dependency)\s+(?:named\s+|called\s+)?(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)(?=\s|$)/i,
  );
  if (labeled?.[1] && isPackageNameTarget(labeled[1])) return normalizePackageName(labeled[1]);

  return undefined;
}

function extractAuditPackageTarget(intent: string): string | undefined {
  const packageName = extractPackageTarget(intent);
  if (packageName) return packageName;

  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const subject = compactIntent.match(
    /\b(?:does|is|can)\s+(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\s+(?:have|has|contain|contains|affected|vulnerable|secure|safe)\b/i,
  );
  if (subject?.[1] && isPackageNameTarget(subject[1])) return normalizePackageName(subject[1]);

  const command = compactIntent.match(
    /\b(?:audit|check|scan)\s+(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\s+(?:for\s+)?(?:cve|cves|vulnerabilities|vulnerability|security)\b/i,
  );
  if (command?.[1] && isPackageNameTarget(command[1])) return normalizePackageName(command[1]);

  return undefined;
}

function graphQueryFromIntent(intent: string): StartGraphQuery | undefined {
  const file = extractFileTarget(intent);
  const packageName = extractGraphPackageTarget(intent);
  const symbol = extractSymbolTarget(intent);
  const direction = graphDirectionFromIntent(intent);
  if ((direction === 'imports' || direction === 'exports' || direction === 'importers') && file) {
    return { direction, file };
  }
  if (direction === 'package_importers' && packageName) {
    return { direction, symbol: packageName };
  }
  if ((direction === 'symbol_defs' || direction === 'package_importers') && symbol) {
    return { direction, symbol };
  }
  if (direction) return { direction };
  return undefined;
}

function graphDirectionFromIntent(intent: string): GraphQueryDirection | undefined {
  if (/\b(?:who|what|which)\s+uses?\b/.test(intent.toLowerCase()) && !extractFileTarget(intent)) return 'package_importers';
  if (/\b(?:who|what|which)\s+depends?\s+on\b/.test(intent.toLowerCase()) && !extractFileTarget(intent)) return 'package_importers';
  if (/\bwhy\b.*\b(?:depend\s+on|depends\s+on|installed)\b/.test(intent.toLowerCase()) && !extractFileTarget(intent)) return 'package_importers';
  const text = intent.toLowerCase();
  if (/\b(?:who|what|which)\s+(?:files\s+)?imports?\b/.test(text) && !extractFileTarget(intent)) return 'package_importers';
  if (/\b(?:who|what|which)\s+(?:files\s+)?imports?\b/.test(text) || /\bimporters\b/.test(text)) return 'importers';
  if (/\bexports?\b/.test(text)) return 'exports';
  if (/\bimports?\b/.test(text)) return 'imports';
  if (/\b(?:defined|definition|defines)\b/.test(text)) return 'symbol_defs';
  return undefined;
}

function graphQueryIsReady(query: StartGraphQuery): boolean {
  if (query.direction === 'imports' || query.direction === 'exports' || query.direction === 'importers') {
    return typeof query.file === 'string' && !isPlaceholder(query.file);
  }
  if (query.direction === 'symbol_defs' || query.direction === 'package_importers') {
    return typeof query.symbol === 'string' && !isPlaceholder(query.symbol);
  }
  return false;
}

function semanticGraphCommand(query: StartGraphQuery): string {
  const parts = ['projscan semantic-graph', '--query', query.direction];
  if (query.file) parts.push('--file', isPlaceholder(query.file) ? query.file : quoteShellArg(query.file));
  if (query.symbol) parts.push('--symbol', isPlaceholder(query.symbol) ? query.symbol : quoteShellArg(query.symbol));
  if (typeof query.limit === 'number') parts.push('--limit', String(query.limit));
  parts.push('--format', 'json');
  return parts.join(' ');
}

function extractSymbolTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const wrapped = compactIntent.match(/[`'"]([A-Za-z_$][\w$]*)[`'"]/);
  if (wrapped?.[1]) return wrapped[1];
  const definitionMatch = compactIntent.match(
    /\bwhere\s+(?:is|are)\s+(?:the\s+)?([A-Za-z_$][\w$]*)\s+(?:defined|declared|implemented)\b/i,
  );
  if (definitionMatch?.[1] && isSymbolNameTarget(definitionMatch[1])) return definitionMatch[1];
  const match = compactIntent.match(/\b(?:symbol|function|class|const|type|interface)\s+([A-Za-z_$][\w$]*)\b/i);
  return match?.[1] && isSymbolNameTarget(match[1]) ? match[1] : undefined;
}

function extractGraphPackageTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const importMatch = compactIntent.match(/\b(?:who|what|which)\s+(?:files\s+)?imports?\s+(?:(?:package|dependency)\s+)?(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\b/i);
  if (importMatch?.[1] && isPackageNameTarget(importMatch[1])) return normalizePackageName(importMatch[1]);
  const useMatch = compactIntent.match(/\b(?:who|what|which)\s+uses?\s+(?:(?:package|dependency)\s+)?(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\b/i);
  if (useMatch?.[1] && isPackageNameTarget(useMatch[1])) return normalizePackageName(useMatch[1]);
  const dependsMatch = compactIntent.match(/\b(?:who|what|which|why(?:\s+do\s+we)?)\s+depends?\s+on\s+(?:(?:package|dependency)\s+)?(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\b/i);
  if (dependsMatch?.[1] && isPackageNameTarget(dependsMatch[1])) return normalizePackageName(dependsMatch[1]);
  const installedMatch = compactIntent.match(/\bwhy\s+is\s+(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\s+installed\b/i);
  if (installedMatch?.[1] && isPackageNameTarget(installedMatch[1])) return normalizePackageName(installedMatch[1]);
  return undefined;
}

function isSymbolNameTarget(target: string): boolean {
  return !['symbol', 'function', 'class', 'const', 'type', 'interface', 'defined', 'declared', 'implemented'].includes(target.toLowerCase());
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}

function extractQuotedTextTarget(intent: string): string | undefined {
  const quoted = intent.match(/(["'`])(.{2,200}?)\1/);
  const target = quoted?.[2]?.trim();
  return target && !isGenericReferenceTarget(target) ? target : undefined;
}

function extractObservabilityQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  const logCheck = compactIntent.match(/\b(?:what|which)\s+logs?\s+should\s+i\s+check\s+(?:for|about|on)\s+(.+?)$/i);
  if (logCheck?.[1]) return `${unwrapTarget(logCheck[1].trim())} logs`;

  const dashboard = compactIntent.match(/\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:is|are))\s+(?:the\s+)?dashboards?\s+(?:for|about|on)\s+(.+?)$/i);
  if (dashboard?.[1]) return `${unwrapTarget(dashboard[1].trim())} dashboard`;

  const serviceInit = compactIntent.match(/\b(?:where\s+(?:do|does)\s+(?:we\s+)?(?:initialize|initialise|init)|find|locate|search(?:\s+for)?|lookup)\s+(Sentry|Datadog|Prometheus)\b/i);
  if (serviceInit?.[1]) return serviceInit[1];

  const observabilityTarget = '(?:metrics?|prometheus\\s+metrics?|alerts?|analytics\\s+events?|events?|sentry\\s+errors?|datadog)';
  const lookup = compactIntent.match(new RegExp(`\\b(?:where\\s+(?:are|is)|which|what|find|locate|search(?:\\s+for)?|lookup)\\s+(?:the\\s+)?(.*?\\b${observabilityTarget}\\b)(?:\\s+(?:emitted|sent|configured|handled|initialized|initialised|created|defined))?$`, 'i'));
  if (lookup?.[1] && isObservabilityTarget(lookup[1])) return unwrapTarget(lookup[1].trim()).replace(/^the\s+/i, '');
  return undefined;
}

function isObservabilityTarget(target: string): boolean {
  return /\b(?:metric|metrics|prometheus|alert|alerts|analytics|events?|sentry|datadog|dashboard|dashboards|logs?)\b/i.test(target);
}

function extractBackgroundWorkQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  const subjectPattern = 'background\\s+jobs?|cron\\s+jobs?|scheduled\\s+tasks?|queues?\\s+processors?|workers?\\s+processors?|schedulers?|workers?|queues?|processors?';
  const findMatch = compactIntent.match(new RegExp(`\\b(?:find|locate|search(?:\\s+for)?|lookup)\\s+(?:the\\s+)?(.*?\\b(?:${subjectPattern})\\b)`, 'i'));
  if (findMatch?.[1] && isBackgroundWorkTarget(findMatch[1])) return unwrapTarget(findMatch[1].trim()).replace(/^the\s+/i, '');

  const lookupMatch = compactIntent.match(new RegExp(`\\b(?:where\\s+(?:are|is)|which|what)\\s+(?:the\\s+)?(.*?\\b(?:${subjectPattern})\\b)(?:\\s+(?:exist|exists|defined|located|handled|run|runs))?$`, 'i'));
  if (lookupMatch?.[1] && isBackgroundWorkTarget(lookupMatch[1])) return unwrapTarget(lookupMatch[1].trim()).replace(/^the\s+/i, '');

  const processMatch = compactIntent.match(/\bwhich\s+(queues?|workers?|processors?)\s+(?:processes?|handles?)\s+(.+?)$/i);
  if (processMatch?.[1] && processMatch[2]) return `${unwrapTarget(processMatch[2].trim())} ${processMatch[1].toLowerCase()}`;
  return undefined;
}

function isBackgroundWorkTarget(target: string): boolean {
  return /\b(?:background|cron|scheduled|schedule|scheduler|worker|queue|processor)\b/i.test(target);
}

function extractTestDataQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  if (/\bseeds?\s+data\b|\bdata\s+seeds?\b|\bseed\s+database\b|\bdatabase\s+seed\b/i.test(compactIntent)) {
    return 'seed data';
  }

  const storybook = compactIntent.match(/\b(?:where\s+(?:are|is)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(?:storybook\s+)?stories\s+(?:for|of)\s+(.+?)$/i);
  if (storybook?.[1]) return `${unwrapTarget(storybook[1].trim())} Storybook stories`;

  const storyRender = compactIntent.match(/\bwhich\s+stor(?:y|ies)\s+renders?\s+(.+?)$/i);
  if (storyRender?.[1]) return `${unwrapTarget(storyRender[1].trim())} story`;

  const fixtureLookup = compactIntent.match(/\b(?:where\s+(?:are|is)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(?:test\s+)?fixtures?\s+(?:for|of)\s+(.+?)$/i);
  if (fixtureLookup?.[1]) return `${unwrapTarget(fixtureLookup[1].trim())} fixtures`;

  const mockUsage = compactIntent.match(/\bwhich\s+mocks?\s+(?:are\s+)?(?:used|configured)\s+(?:for|by|in)\s+(.+?)$/i);
  if (mockUsage?.[1]) return `${unwrapTarget(mockUsage[1].trim())} mocks`;

  const factoryLookup = compactIntent.match(/\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:are|is))\s+(?:the\s+)?(?:factories?|factory)\s+(?:for|of)\s+(.+?)$/i);
  if (factoryLookup?.[1]) return `${unwrapTarget(factoryLookup[1].trim())} factory`;
  return undefined;
}

function extractAuthorizationQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  const rbac = compactIntent.match(/\brbac\b/i);
  if (rbac) return rbac[0].toUpperCase();

  const permissionScope = compactIntent.match(
    /\b(?:where\s+(?:are|is)|which|what|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?permissions?\s+(?:checked\s+)?(?:for|on|in)\s+(.+?)$/i,
  );
  if (permissionScope?.[1]) return `${unwrapTarget(permissionScope[1].trim())} permissions`;

  const roleAccess = compactIntent.match(/\b(?:which|what)\s+roles?\s+(?:can\s+)?access\s+(.+?)$/i);
  if (roleAccess?.[1]) return `${unwrapTarget(roleAccess[1].trim())} role access`;

  const guard = compactIntent.match(/\b(?:what|which|where\s+(?:are|is))\s+guards?\s+(?:the\s+)?(.+?)$/i);
  if (guard?.[1]) return `${unwrapTarget(guard[1].trim())} guard`;

  const policy = compactIntent.match(
    /\b(?:find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(?:authorization\s+)?polic(?:y|ies)\s+(?:for|on|in)\s+(.+?)$/i,
  );
  if (policy?.[1]) return `${unwrapTarget(policy[1].trim())} authorization policy`;

  if (/\b(?:what|which)\s+routes?\s+(?:require|requires|required)\s+login\b/i.test(compactIntent)) return 'login routes';
  if (/\bwhere\s+(?:is|are)\s+login\s+required\b/i.test(compactIntent)) return 'login required';

  return undefined;
}

function extractReliabilityQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');

  const scopedRateLimit = compactIntent.match(/\b(?:what|which)\s+rate\s+limits?\s+(?:protects?|guards?|apply\s+to|for)\s+(.+?)$/i);
  if (scopedRateLimit?.[1]) return `${unwrapTarget(scopedRateLimit[1].trim())} rate limits`;

  if (/\brate\s+limiting\b/i.test(compactIntent)) return 'rate limiting';
  if (/\brate\s+limits?\b/i.test(compactIntent)) return 'rate limits';
  if (/\bthrottl(?:e|ing)\b/i.test(compactIntent)) return 'throttling';

  const cacheFor = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?cache\s+(?:invalidated|cleared|expired|refreshed)\s+(?:for|on|in)\s+(.+?)$/i);
  if (cacheFor?.[1]) return `${unwrapTarget(cacheFor[1].trim())} cache invalidation`;

  const invalidatesCache = compactIntent.match(/\bwhat\s+invalidates\s+(?:the\s+)?(.+?)\s+cache$/i);
  if (invalidatesCache?.[1]) return `${unwrapTarget(invalidatesCache[1].trim())} cache invalidation`;

  const cacheConfigured = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(.+?\b(?:cache|redis)\b)\s+(?:configured|defined|created|used|handled)$/i);
  if (cacheConfigured?.[1]) return unwrapTarget(cacheConfigured[1].trim());

  const retryFor = compactIntent.match(/\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:is|are))\s+(?:the\s+)?(?:retry|retries|backoff)\s+(?:logic\s+)?(?:for|on|in)\s+(.+?)$/i);
  if (retryFor?.[1]) return `${unwrapTarget(retryFor[1].trim())} retry logic`;

  const retriesTarget = compactIntent.match(/\b(?:which|what)\s+(?:code\s+)?retries\s+(.+?)$/i);
  if (retriesTarget?.[1]) return `${unwrapTarget(retriesTarget[1].trim())} retries`;

  if (/\bbackoff\b/i.test(compactIntent)) return 'backoff';
  if (/\bretr(?:y|ies|ied)\b/i.test(compactIntent)) return 'retry logic';

  const timeoutFor = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?timeouts?\s+(?:configured|defined|set)?\s*(?:for|on|in)\s+(.+?)$/i);
  if (timeoutFor?.[1]) return `${unwrapTarget(timeoutFor[1].trim())} timeout`;

  const timeoutTarget = compactIntent.match(/\b(?:what|which)\s+sets?\s+(.+?\btimeouts?)$/i);
  if (timeoutTarget?.[1]) return unwrapTarget(timeoutTarget[1].trim());

  if (/\bcircuit\s+breaker\b/i.test(compactIntent)) return 'circuit breaker';

  const idempotency = compactIntent.match(/\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:is|are))\s+(?:the\s+)?(.+?\bidempotenc(?:y|e)\b.*|idempotent\s+.+?)$/i);
  if (idempotency?.[1]) return unwrapTarget(idempotency[1].trim());

  if (/\bwebhook\b/i.test(compactIntent) && /\bsignatures?\b/i.test(compactIntent) && /\b(?:verified|verify|verification)\b/i.test(compactIntent)) {
    return 'webhook signature verification';
  }

  if (/\bdebounce(?:d)?\b/i.test(compactIntent)) return 'debounce';

  return undefined;
}

function extractDataContractQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');

  const inputValidation = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?input\s+validation\s+(?:for|on|in)\s+(.+?)$/i);
  if (inputValidation?.[1]) return `${unwrapTarget(inputValidation[1].trim())} input validation`;

  const schemaValidation = compactIntent.match(/\b(?:which|what|where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(?:zod\s+)?schemas?\s+(?:validates?|for|of)\s+(.+?)$/i);
  if (schemaValidation?.[1]) return `${unwrapTarget(schemaValidation[1].trim())} validation schema`;

  const validationTarget = compactIntent.match(/\b(?:what|which)\s+validates?\s+(.+?)$/i);
  if (validationTarget?.[1]) {
    const target = unwrapTarget(validationTarget[1].trim());
    if (/\buniqueness\b/i.test(target)) return `${target} validation`;
    return `${target} validation`;
  }

  if (/\brequest\s+params?\s+(?:are\s+)?parsed\b/i.test(compactIntent)) return 'request params parsing';
  if (/\bquery\s+params?\b/i.test(compactIntent)) return 'query params parsing';

  const serializesResponse = compactIntent.match(/\b(?:what|which)\s+serializes?\s+(.+?\bresponse)\b/i);
  if (serializesResponse?.[1]) return `${unwrapTarget(serializesResponse[1].trim())} serialization`;

  const serialization = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(.+?\b(?:serialization|formatting|format)\b)(?:\s+(?:handled|defined|configured))?$/i);
  if (serialization?.[1]) return unwrapTarget(serialization[1].trim());

  if (/\bdatabase\s+transactions?\b/i.test(compactIntent)) return 'database transaction';

  const transactionTarget = compactIntent.match(/\b(?:what|which)\s+wraps?\s+(.+?)\s+in\s+(?:a\s+)?transactions?\b/i);
  if (transactionTarget?.[1]) return `${unwrapTarget(transactionTarget[1].trim())} transaction`;

  const rowLock = compactIntent.match(/\b(?:where\s+(?:do|does|is|are)(?:\s+we)?|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(?:code\s+that\s+)?locks?\s+(?:the\s+)?(.+?\brow)\b/i);
  if (rowLock?.[1]) return `${unwrapTarget(rowLock[1].trim())} lock`;

  if (/\boptimistic\s+locking\b/i.test(compactIntent)) return 'optimistic locking';

  const uniquenessFor = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?uniqueness\s+(?:enforced|validated|checked)\s+(?:for|on|in)\s+(.+?)$/i);
  if (uniquenessFor?.[1]) return `${unwrapTarget(uniquenessFor[1].trim())} uniqueness`;

  if (/\bpagination\b/i.test(compactIntent) && /\bcursors?\b/i.test(compactIntent)) return 'pagination cursors';
  if (/\bpagination\b/i.test(compactIntent)) return 'pagination';

  return undefined;
}

function extractUiInteractionQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');

  const formSubmitted = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(.+?)\s+forms?\s+(?:submitted|submit|handled)\b/i,
  );
  if (formSubmitted?.[1]) return `${unwrapTarget(formSubmitted[1].trim())} form submit`;

  const formSubmitFor = compactIntent.match(/\b(?:what|which)\s+handles?\s+forms?\s+submit\s+(?:for|on|in)\s+(.+?)$/i);
  if (formSubmitFor?.[1]) return `${unwrapTarget(formSubmitFor[1].trim())} form submit`;

  const loadingState = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?loading\s+state\s+(?:for|on|in)\s+(.+?)$/i);
  if (loadingState?.[1]) return `${unwrapTarget(loadingState[1].trim())} loading state`;

  const emptyState = compactIntent.match(/\b(?:what|which)\s+renders?\s+empty\s+state\s+(?:for|of)\s+(.+?)$/i);
  if (emptyState?.[1]) return `${unwrapTarget(emptyState[1].trim())} empty state`;

  const errorBoundary = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?error\s+boundary\s+(?:for|on|in)\s+(.+?)$/i);
  if (errorBoundary?.[1]) return `${unwrapTarget(errorBoundary[1].trim())} error boundary`;

  const toast = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?toast(?:\s+(?:shown|displayed|triggered))?\s+(?:after|for|on|in)\s+(.+?)$/i);
  if (toast?.[1]) return `${unwrapTarget(toast[1].trim())} toast`;

  const shortcut = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?keyboard\s+shortcuts?\s+(?:for|on)\s+(.+?)$/i);
  if (shortcut?.[1]) return `${unwrapTarget(shortcut[1].trim())} keyboard shortcut`;

  if (/\bcommand\s+palette\s+actions?\b/i.test(compactIntent)) return 'command palette actions';

  const pageComponent = compactIntent.match(/\b(?:what|which)\s+component\s+renders?\s+(?:the\s+)?(.+?)\s+page$/i);
  if (pageComponent?.[1]) return `${unwrapTarget(pageComponent[1].trim())} page component`;

  const translations = compactIntent.match(/\b(?:where\s+(?:are|is)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(?:i18n\s+)?translations?\s+(?:for|of)\s+(.+?)$/i);
  if (translations?.[1]) return `${unwrapTarget(translations[1].trim())} translations`;

  const aria = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?aria\s+labels?\s+(?:for|on)\s+(.+?)$/i);
  if (aria?.[1]) return `${unwrapTarget(aria[1].trim())} aria label`;

  if (/\bfocus\s+trap\b/i.test(compactIntent)) return 'focus trap';

  const modal = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?modal\s+(?:opened|shown|displayed)\s+(?:for|on)\s+(.+?)$/i);
  if (modal?.[1]) return `${unwrapTarget(modal[1].trim())} modal`;

  return undefined;
}

function extractStyleSystemQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  if (/\b(?:why|failing|failed|failure|failures|broken|error|errors|runtime|production|prod|outage|incident)\b/i.test(compactIntent)) {
    return undefined;
  }

  if (/\bdesign\s+tokens?\b/i.test(compactIntent)) return 'design tokens';
  if (/\btailwind\s+themes?\b/i.test(compactIntent)) return 'Tailwind theme';
  if (/\bglobal\s+css\b/i.test(compactIntent)) return 'global CSS';

  const cssModule = compactIntent.match(/\b(?:which|what)\s+css\s+modules?\s+styles?\s+(.+?)$/i);
  if (cssModule?.[1]) return `${unwrapTarget(cssModule[1].trim())} CSS module`;

  if (/\bdark\s+mode\b/i.test(compactIntent)) return 'dark mode';
  if (/\bbreakpoints?\b/i.test(compactIntent)) return 'breakpoints';

  return undefined;
}

function extractNavigationLayoutQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');

  const sidebarNav = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(?:sidebar\s+)?(?:nav|navigation|menu)\s+items?\s+(?:for|of|on|in)\s+(.+?)$/i,
  );
  if (sidebarNav?.[1]) return `${unwrapTarget(sidebarNav[1].trim())} sidebar nav item`;

  const breadcrumb = compactIntent.match(/\b(?:which|what)\s+breadcrumbs?\s+(?:renders?|shows?|for|of)\s+(.+?)$/i);
  if (breadcrumb?.[1]) return `${unwrapTarget(breadcrumb[1].trim())} breadcrumb`;

  const pageTitle = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?page\s+(?:title|metadata|meta)\s+(?:set|sets|defined|configured)\s+(?:for|of|on|in)\s+(.+?)$/i,
  );
  if (pageTitle?.[1]) return `${unwrapTarget(pageTitle[1].trim())} page title`;

  const nextLayout = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?next(?:\.js|js)?\s+layouts?\s+(?:for|of|on|in)\s+(.+?)$/i,
  );
  if (nextLayout?.[1]) return `${unwrapTarget(nextLayout[1].trim())} Next.js layout`;

  return undefined;
}

function extractFrontendPageRouteQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  if (/\b(?:why|returning|returns|failing|failed|failure|failures|production|prod|down|outage|incident|runtime|crash|crashes|crashing)\b/i.test(compactIntent)) {
    return undefined;
  }

  const pathPage = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(\/[A-Za-z0-9_./:{}-]+)\s+pages?\s+(?:rendered|handled|defined|located|live|lives)\b/i,
  );
  if (pathPage?.[1]) return `${pathPage[1].trim()} page`;

  const pageRendersPath = compactIntent.match(/\b(?:which|what)\s+pages?\s+(?:renders?|shows?)\s+(\/[A-Za-z0-9_./:{}-]+)\b/i);
  if (pageRendersPath?.[1]) return `${pageRendersPath[1].trim()} page`;

  const routeSegment = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?routes?\s+segments?\s+(?:for|of|on|in)\s+(.+?)$/i,
  );
  if (routeSegment?.[1]) return `${unwrapTarget(routeSegment[1].trim())} route segment`;

  if (/\bnot[-\s]?found\s+pages?\s+(?:handled|defined|located|live|lives)\b/i.test(compactIntent)) return 'not-found page';
  if (/\b404\s+pages?\s+(?:handled|defined|located|live|lives)\b/i.test(compactIntent)) return '404 page';

  return undefined;
}

function extractStateManagementQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  if (/\b(?:pii|gdpr|secret|secrets|token|tokens|password|customer|personal|leak|leaks|leaking|security|retention)\b/i.test(compactIntent)) return undefined;

  const stateStored = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(.+?)\s+state\s+(?:stored|store|stores)\b/i);
  if (stateStored?.[1]) return `${unwrapTarget(stateStored[1].trim())} state store`;

  const reduxSlice = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?redux\s+slices?\s+(?:for|of|on|in)\s+(.+?)$/i);
  if (reduxSlice?.[1]) return `${unwrapTarget(reduxSlice[1].trim())} Redux slice`;

  const frameworkStore = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(redux|zustand|jotai|recoil)\s+stores?\s+(?:for|of|on|in)\s+(.+?)$/i);
  if (frameworkStore?.[1] && frameworkStore[2]) {
    return `${unwrapTarget(frameworkStore[2].trim())} ${normalizeStateFramework(frameworkStore[1])} store`;
  }

  const contextProvider = compactIntent.match(/\b(?:which|what|where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:context\s+)?providers?\s+(?:supplies|supplied|provides|provided|for|of)\s+(.+?)$/i);
  if (contextProvider?.[1]) return `${unwrapTarget(contextProvider[1].trim())} context provider`;

  const hookFetches = compactIntent.match(/\b(?:which|what)\s+hooks?\s+(?:fetch|fetches|loads?|queries?)\s+(.+?)$/i);
  if (hookFetches?.[1]) return `${unwrapTarget(hookFetches[1].trim())} hook`;

  const reactQueryMutation = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?react\s+query\s+mutations?\s+(?:for|of|on|in)\s+(.+?)$/i);
  if (reactQueryMutation?.[1]) return `${unwrapTarget(reactQueryMutation[1].trim())} React Query mutation`;

  const reactQueryQuery = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?react\s+query\s+quer(?:y|ies)\s+(?:for|of|on|in)\s+(.+?)$/i);
  if (reactQueryQuery?.[1]) return `${unwrapTarget(reactQueryQuery[1].trim())} React Query query`;

  return undefined;
}

function extractDataAccessQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  if (/\b(?:sink|sinks|source|taint|injection|xss|vulnerability|security|sanitize|sanitized|reach|reaches|drop|delete|remove)\b/i.test(compactIntent)) return undefined;

  const ormModel = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(prisma|drizzle|typeorm|sequelize)\s+(models?|schemas?|entities?)\s+(?:for|of|on|in)\s+(.+?)$/i);
  if (ormModel?.[1] && ormModel[2] && ormModel[3]) {
    return `${unwrapTarget(ormModel[3].trim())} ${normalizeDataAccessFramework(ormModel[1])} ${normalizeDataAccessArtifact(ormModel[2])}`;
  }

  const sqlQuery = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?sql\s+quer(?:y|ies)\s+(?:for|of|on|in)\s+(.+?)$/i);
  if (sqlQuery?.[1]) return `${unwrapTarget(sqlQuery[1].trim())} SQL query`;

  const repositorySaves = compactIntent.match(/\b(?:which|what)\s+(?:repository|repositories|dao|daos)\s+(?:saves?|persists?)\s+(.+?)$/i);
  if (repositorySaves?.[1]) return `${unwrapTarget(repositorySaves[1].trim())} repository`;

  const dataAccessTarget = compactIntent.match(/\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:is|are))\s+(?:the\s+)?(repository|repositories|dao|daos)\s+(?:for|of|on|in)\s+(.+?)$/i);
  if (dataAccessTarget?.[1] && dataAccessTarget[2]) {
    const artifact = /^dao/i.test(dataAccessTarget[1]) ? 'DAO' : 'repository';
    return `${unwrapTarget(dataAccessTarget[2].trim())} ${artifact}`;
  }

  return undefined;
}

function extractIntegrationQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');

  const serviceCall = compactIntent.match(/\bwhere\s+(?:do|does)\s+(?:we\s+)?calls?\s+(.+?)$/i);
  if (serviceCall?.[1]) {
    const service = canonicalIntegrationTarget(serviceCall[1]);
    if (service) return `${service} API`;
  }

  const emailProvider = compactIntent.match(/\b(?:which|what)\s+(?:code\s+)?sends?\s+email\s+(?:through|via|with|using)\s+(.+?)$/i);
  if (emailProvider?.[1]) {
    const service = canonicalIntegrationTarget(emailProvider[1]);
    if (service) return `${service} email`;
  }

  const storageUpload = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(.+?\bs3\b.*?)\s+(?:upload|uploads|uploaded|implemented|handled|configured)\b/i);
  if (storageUpload?.[1] && /\bs3\b/i.test(storageUpload[1])) return 'S3 upload';

  const serviceClient = compactIntent.match(/\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:is|are))\s+(?:the\s+)?(.+?\b(?:api\s+client|client|sdk)\b)$/i);
  if (serviceClient?.[1] && isIntegrationTarget(serviceClient[1])) return normalizeIntegrationPhrase(serviceClient[1]);

  const graphQuery = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?graphql\s+quer(?:y|ies)\s+(?:for|of)\s+(.+?)$/i);
  if (graphQuery?.[1]) return `${unwrapTarget(graphQuery[1].trim())} GraphQL query`;

  if (/\bwebsockets?\s+connections?\b/i.test(compactIntent) || /\bwebsockets?\s+connection\s+opened\b/i.test(compactIntent)) return 'websocket connection';

  return undefined;
}

function extractApiContractQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');

  if (/\bopenapi\b/i.test(compactIntent) && /\bspecs?\b/i.test(compactIntent)) return 'OpenAPI spec';
  if (/\bswagger\b/i.test(compactIntent) && /\bdocs?\b/i.test(compactIntent)) return 'Swagger docs';

  const trpcRouter = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?trpc\s+routers?\s+(?:for|of|on|in)\s+(.+?)$/i);
  if (trpcRouter?.[1]) return `${unwrapTarget(trpcRouter[1].trim())} tRPC router`;

  const graphqlResolver = compactIntent.match(/\b(?:which|what)\s+graphql\s+resolvers?\s+(?:handles?|for|of)\s+(.+?)$/i);
  if (graphqlResolver?.[1]) return `${unwrapTarget(graphqlResolver[1].trim())} GraphQL resolver`;

  const graphqlSchema = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?graphql\s+schemas?\s*(?:for|of)?\s*(.*?)$/i);
  if (graphqlSchema) {
    const target = unwrapTarget((graphqlSchema[1] ?? '').trim());
    return target ? `${target} GraphQL schema` : 'GraphQL schema';
  }

  const protobuf = compactIntent.match(/\b(?:which|what)\s+(?:protobuf|proto)\s+defines?\s+(.+?)$/i);
  if (protobuf?.[1]) return `${unwrapTarget(protobuf[1].trim())} protobuf`;

  const grpcClient = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?grpc\s+clients?\s+(?:for|of|on|in)\s+(.+?)$/i);
  if (grpcClient?.[1]) return `${unwrapTarget(grpcClient[1].trim())} gRPC client`;

  return undefined;
}

function extractInfraArtifactQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');

  if (/\bdockerfile\b/i.test(compactIntent)) return 'Dockerfile';

  const dockerCompose = compactIntent.match(/\bdocker\s+compose(?:\s+(?:for|of)\s+(.+?))?$/i);
  if (dockerCompose) {
    const target = unwrapTarget((dockerCompose[1] ?? '').trim());
    return target ? `${target} docker compose` : 'docker compose';
  }

  if (/\b(?:kubernetes|k8s)\b/i.test(compactIntent) && /\bmanifests?\b/i.test(compactIntent)) return 'Kubernetes manifests';

  const helm = compactIntent.match(/\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:is|are))\s+(?:the\s+)?helm\s+charts?\s+(?:for|of|on|in)\s+(.+?)$/i);
  if (helm?.[1]) return `${unwrapTarget(helm[1].trim())} Helm chart`;

  const terraformModule = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?terraform\s+modules?\s+(?:for|of|on|in)\s+(.+?)$/i);
  if (terraformModule?.[1]) return `${normalizeInfraTarget(terraformModule[1])} Terraform module`;

  const githubWorkflow = compactIntent.match(/\b(?:which|what|where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+github\s+workflows?\s+(?:deploys?|for|of|on|in)\s+(.+?)$/i);
  if (githubWorkflow?.[1]) return `${unwrapTarget(githubWorkflow[1].trim())} GitHub workflow`;

  const hostedConfig = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(vercel|netlify|railway|fly)\s+config(?:uration)?$/i);
  if (hostedConfig?.[1]) return `${normalizeInfraTarget(hostedConfig[1])} config`;

  return undefined;
}

function extractToolingConfigQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  if (/\b(?:why|failing|failed|failure|failures|broken|error|errors|runtime|production|prod|outage|incident)\b/i.test(compactIntent)) {
    return undefined;
  }

  if (/\btsconfig\b/i.test(compactIntent) && /\b(?:path|paths|alias|aliases)\b/i.test(compactIntent)) return 'tsconfig path aliases';
  if (/\bvitest\b/i.test(compactIntent) && /\bconfig(?:uration)?\b/i.test(compactIntent)) return 'Vitest config';
  if (/\bjest\b/i.test(compactIntent) && /\bconfig(?:uration)?\b/i.test(compactIntent)) return 'Jest config';
  if (/\bbabel\b/i.test(compactIntent) && /\bconfig(?:uration)?\b/i.test(compactIntent)) return 'Babel config';
  if (/\bwebpack\b/i.test(compactIntent) && /\bconfig(?:uration)?\b/i.test(compactIntent)) return 'webpack config';
  if (/\bpackage\s+manager\b/i.test(compactIntent)) return 'package manager';
  if (/\bpnpm\s+workspaces?\b/i.test(compactIntent)) return 'pnpm workspace';
  if (/\byarn\s+workspaces?\b/i.test(compactIntent)) return 'yarn workspace';
  if (/\b(?:npm|pnpm|yarn)\s+lockfiles?\b/i.test(compactIntent)) {
    const manager = compactIntent.match(/\b(npm|pnpm|yarn)\b/i)?.[1]?.toLowerCase();
    return manager ? `${manager} lockfile` : 'lockfile';
  }

  return undefined;
}

function extractDomainWorkflowQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');

  if (/\bpassword\s+reset\b/i.test(compactIntent)) return 'password reset';

  const invite = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(.+?\binvite\s+flow)\b/i);
  if (invite?.[1]) return unwrapTarget(invite[1].trim());

  if (/\bonboarding\s+flow\b/i.test(compactIntent)) return 'onboarding flow';

  const csvExport = compactIntent.match(/\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:is|are))\s+(?:the\s+)?csv\s+exports?\s+(?:for|of)\s+(.+?)$/i);
  if (csvExport?.[1]) return `${unwrapTarget(csvExport[1].trim())} CSV export`;

  if (/\baudit\s+logs?\s+entries\b/i.test(compactIntent) || /\baudit\s+log\s+entries\b/i.test(compactIntent)) return 'audit log entries';

  const refund = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?refund\s+handling\s+(?:for|of|on|in)\s+(.+?)$/i);
  if (refund?.[1]) return `${unwrapTarget(refund[1].trim())} refund handling`;

  if (/\bsubscription\s+renewal\b/i.test(compactIntent)) return 'subscription renewal';

  return undefined;
}

function extractCommunicationArtifactQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');

  const welcomeEmail = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(.+?\bemail\s+templates?)\b/i);
  if (welcomeEmail?.[1]) return unwrapTarget(welcomeEmail[1].trim());

  const emailCopy = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(.+?\bemail\s+copy)\b/i);
  if (emailCopy?.[1]) return unwrapTarget(emailCopy[1].trim());

  const pushCopy = compactIntent.match(/\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?push\s+notifications?\s+copy\s+(?:for|of)\s+(.+?)$/i);
  if (pushCopy?.[1]) return `${unwrapTarget(pushCopy[1].trim())} push notification copy`;

  if (/\bsms\s+verification\s+templates?\b/i.test(compactIntent)) return 'SMS verification template';

  if (/\breceipt\s+email\b/i.test(compactIntent) && /\btemplates?\b/i.test(compactIntent)) return 'receipt email template';

  if (/\binvoice\s+pdf\b/i.test(compactIntent)) return 'invoice PDF';

  return undefined;
}

function normalizeInfraTarget(value: string): string {
  return unwrapTarget(value.trim())
    .replace(/\bs3\b/gi, 'S3')
    .replace(/\bvercel\b/gi, 'Vercel')
    .replace(/\bnetlify\b/gi, 'Netlify')
    .replace(/\brailway\b/gi, 'Railway')
    .replace(/\bfly\b/gi, 'Fly');
}

function canonicalIntegrationTarget(value: string): string | undefined {
  const target = unwrapTarget(value.trim()).replace(/^the\s+/i, '');
  if (!isIntegrationTarget(target)) return undefined;
  const lower = target.toLowerCase();
  if (lower === 'stripe') return 'Stripe';
  if (lower === 'sendgrid') return 'SendGrid';
  if (lower === 's3' || lower === 'aws s3') return 'S3';
  if (lower === 'github') return 'GitHub';
  if (lower === 'graphql') return 'GraphQL';
  return target;
}

function normalizeIntegrationPhrase(value: string): string {
  return value
    .trim()
    .replace(/\bgithub\b/gi, 'GitHub')
    .replace(/\bgraphql\b/gi, 'GraphQL')
    .replace(/\bstripe\b/gi, 'Stripe')
    .replace(/\bsendgrid\b/gi, 'SendGrid')
    .replace(/\bs3\b/gi, 'S3');
}

function normalizeStateFramework(value: string): string {
  return value
    .trim()
    .replace(/\bredux\b/gi, 'Redux')
    .replace(/\bzustand\b/gi, 'Zustand')
    .replace(/\bjotai\b/gi, 'Jotai')
    .replace(/\brecoil\b/gi, 'Recoil');
}

function normalizeDataAccessFramework(value: string): string {
  return value
    .trim()
    .replace(/\bprisma\b/gi, 'Prisma')
    .replace(/\bdrizzle\b/gi, 'Drizzle')
    .replace(/\btypeorm\b/gi, 'TypeORM')
    .replace(/\bsequelize\b/gi, 'Sequelize');
}

function normalizeDataAccessArtifact(value: string): string {
  const lower = value.trim().toLowerCase();
  if (lower.startsWith('entit')) return 'entity';
  if (lower.startsWith('schem')) return 'schema';
  return 'model';
}

function isIntegrationTarget(value: string): boolean {
  return /\b(?:stripe|sendgrid|s3|aws\s+s3|github|graphql|websocket|websockets?|axios|fetch|rest|http|api\s+client|client|sdk)\b/i.test(value);
}

function isFilePathTarget(target: string): boolean {
  return (
    target.includes('/') ||
    target.startsWith('.') ||
    /\.[A-Za-z0-9]{1,12}$/.test(target)
  ) && !/\s/.test(target);
}

function isExactSymbolTarget(target: string): boolean {
  return /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?$/.test(target);
}

function isIssueIdTarget(target: string): boolean {
  return (
    /^[A-Za-z0-9_:@.-]*[A-Za-z][A-Za-z0-9_:@.-]*-[A-Za-z0-9_:@.-]+$/.test(target) &&
    !target.includes('/') &&
    target.toLowerCase() !== 'fix-suggest'
  );
}

function isPackageNameTarget(target: string): boolean {
  const lower = target.toLowerCase();
  if ([
    'package',
    'dependency',
    'dependencies',
    'version',
    'latest',
    'upgrade',
    'bump',
    'update',
    'for',
    'doc',
    'docs',
    'document',
    'documentation',
    'documented',
    'readme',
    'changelog',
    'example',
    'examples',
    'guide',
    'should',
    'could',
    'would',
    'can',
    'what',
    'which',
    'the',
    'this',
    'that',
    'it',
    'my',
  ].includes(lower)) return false;
  if (target.length === 0 || target.length > 214 || target !== target.trim()) return false;
  if (target.includes('..') || target.includes('\\')) return false;
  return /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i.test(target);
}

function normalizePackageName(target: string): string {
  return target.toLowerCase();
}

function escapeDoubleQuoted(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function quoteShellArg(value: string): string {
  return /^[A-Za-z0-9_./:@-]+$/.test(value) ? value : `"${escapeDoubleQuoted(value)}"`;
}

function quoteShellArgOrPlaceholder(value: string): string {
  if (isPlaceholder(value)) return value;
  return quoteShellArg(value);
}

function actionFromFixFirst(fixFirst: StartReport['fixFirst']): PreflightSuggestedAction | undefined {
  if (!fixFirst) return undefined;
  return {
    label: fixFirst.title,
    command: fixFirst.commands[0],
  };
}

function actionFromWorkplan(workplan: WorkplanReport): PreflightSuggestedAction | undefined {
  const task = workplan.tasks[0];
  if (!task) return undefined;
  return {
    label: task.title,
    command: task.verification.commands[0],
    tool: task.suggestedTools.find((tool) => tool.startsWith('projscan_')),
  };
}

function actionFromWorkflow(workflow: StartWorkflowRecommendation): PreflightSuggestedAction {
  return {
    label: `Run ${workflow.name}`,
    command: workflow.commands[0] ?? 'projscan start --format json',
    tool: workflow.mcpTools[0],
  };
}

function headlineForStatus(status: StartMissionControlStatus, label: string): string {
  if (status === 'blocked') return `Blocked: ${label}`;
  if (status === 'needs_setup') return `Set up first: ${label}`;
  if (status === 'needs_attention') return `Proceed carefully: ${label}`;
  return `Next move: ${label}`;
}

function missionGuardrails(
  mode: WorkplanMode,
  coordinationHints: SessionCoordinationHint[],
  primaryAction: PreflightSuggestedAction,
): PreflightSuggestedAction[] {
  const preflightMode = preflightModeForMission(mode);
  const guardrails: PreflightSuggestedAction[] = [
    {
      label: 'Verify the repo map before handoff',
      command: 'projscan understand --view verify --format json',
      tool: 'projscan_understand',
    },
  ];
  if (!isPreflightAction(primaryAction)) {
    guardrails.unshift({
      label: 'Check the safety gate before editing',
      command: `projscan preflight --mode ${preflightMode} --format json`,
      tool: 'projscan_preflight',
    });
  }
  for (const hint of coordinationHints.slice(0, 2)) {
    guardrails.push({
      label: hint.label,
      command: hint.command,
    });
  }
  return dedupeActions(guardrails).slice(0, 4);
}

function missionProofCommands(
  mode: WorkplanMode,
  workplan: WorkplanReport,
  guardrails: PreflightSuggestedAction[],
  actionPlan: PreflightSuggestedAction[],
): string[] {
  const primaryAction = actionPlan[0] ?? actionFromWorkplan(workplan);
  const commands = uniqueStrings([
    ...actionPlan.map((action) => action.command ?? ''),
    ...(isPreflightAction(primaryAction) ? [] : [`projscan preflight --mode ${preflightModeForMission(mode)} --format json`]),
    ...guardrails.map((action) => action.command).filter((command): command is string => typeof command === 'string'),
    ...workplan.tasks.flatMap((task) => task.verification.commands),
  ]).filter(isRunnableCommand);
  if (!isPreflightAction(primaryAction)) return commands.slice(0, 8);
  return commands.filter((command, index) => index === 0 || !command.startsWith('projscan preflight ')).slice(0, 8);
}

function isRunnableCommand(command: string): boolean {
  return !/<[^<>]+>/.test(command);
}

function missionSuccessCriteria(
  mode: WorkplanMode,
  route: StartRoutedIntent | undefined,
  actionPlan: PreflightSuggestedAction[],
  workplan: WorkplanReport,
): string[] {
  const primaryAction = actionPlan[0] ?? actionFromWorkplan(workplan);
  const criteria: string[] = [];
  if (route?.tool === 'projscan_preflight' || (primaryAction && isPreflightAction(primaryAction))) {
    const preflightMode = route?.tool === 'projscan_preflight' && primaryAction?.args && 'mode' in primaryAction.args
      ? String(primaryAction.args.mode)
      : preflightModeForMission(mode);
    criteria.push(`projscan preflight --mode ${preflightMode} returns proceed or only documented manual-review items.`);
    criteria.push('Every blocker has an owner, linked file, or follow-up command before the developer continues.');
  } else if (route?.tool === 'projscan_impact') {
    if (primaryAction?.tool === 'projscan_search') {
      criteria.push('An exact symbol or file path is selected from search results before impact analysis continues.');
    }
    criteria.push('The impact report is reviewed for direct and transitive dependents before editing starts.');
    criteria.push('Affected call sites, tests, or owners are added to the workplan before code changes begin.');
  } else if (route?.tool === 'projscan_release_train') {
    criteria.push('Release train readiness has no blockers before packaging or publishing continues.');
    criteria.push('Changelog, package, SBOM, and provenance evidence are reviewed before a release handoff.');
  } else if (route?.tool === 'projscan_bug_hunt') {
    criteria.push('Bug-hunt findings are triaged by severity with a first fix candidate selected.');
    criteria.push('The selected fix has a runnable verification command before editing starts.');
  } else if (route?.tool === 'projscan_understand') {
    criteria.push(...understandSuccessCriteria(primaryAction, route));
  } else if (route?.tool === 'projscan_agent_brief') {
    criteria.push('The agent brief summarizes focus items, repo context, guardrails, and suggested next actions for the next developer.');
    criteria.push('The handoff includes enough proof commands for the next agent to resume without rerunning broad discovery.');
  } else if (route?.tool === 'projscan_session') {
    criteria.push('Remembered touched files and recent session events are reviewed before resuming work.');
    criteria.push('The current worktree preflight is rerun after session context is reviewed, so stale memory does not override live risk.');
  } else if (route?.tool === 'projscan_claim') {
    const hasAddAction = actionPlan.some((action) => action.args && 'action' in action.args && action.args.action === 'add');
    if (hasAddAction) {
      criteria.push('Active claims are reviewed before a new file, directory, or symbol claim is added.');
      criteria.push('The target is claimed with a real agent name, and any returned contention is assigned or resolved before parallel editing continues.');
    } else {
      criteria.push('Active claims, owners, leases, and contention warnings are reviewed before parallel work continues.');
      criteria.push('Any stale or contended claim has a release, owner, or coordination follow-up before editing resumes.');
    }
  } else if (route?.tool === 'projscan_coordinate') {
    criteria.push('Coordination readiness, collisions, claims, and merge order are reviewed before parallel work continues.');
    criteria.push('Any conflicted files, contended claims, or merge-order blockers have an owner or follow-up command before editing resumes.');
  } else if (route?.tool === 'projscan_privacy_check') {
    criteria.push('Telemetry state, offline mode, scan root, ignored-file handling, .env content policy, plugin execution, local writes, and network-capable endpoints are reviewed.');
    criteria.push('Any required trust-boundary change is made explicitly before broader analysis or report sharing continues.');
  } else if (route?.tool === 'projscan_quality_scorecard') {
    criteria.push('Quality dimensions, top risks, and verification commands are reviewed before choosing the next task.');
    criteria.push('The developer knows whether health, security, tests, maintainability, or coordination needs attention first.');
  } else if (route?.tool === 'projscan_review') {
    criteria.push('The structural PR review reports a verdict and identifies any risk that needs owner follow-up.');
    criteria.push('Review, preflight, or evidence-pack follow-up is chosen before the branch is handed to reviewers.');
  } else if (route?.tool === 'projscan_evidence_pack') {
    criteria.push('The evidence pack produces a paste-ready PR comment with verdict, top risks, owner routing, and next commands.');
    criteria.push('The reviewer-facing comment is validated before it is shared or used for approval.');
  } else if (route?.tool === 'projscan_doctor') {
    criteria.push('Dead code, unused exports, lint, dependency, security, and config issues are reviewed before cleanup starts.');
    criteria.push('Any issue chosen for cleanup has a fix-suggest, impact, or verification follow-up before files are deleted.');
  } else if (route?.tool === 'projscan_fix_suggest') {
    criteria.push('A concrete fix suggestion is produced for the selected issue id.');
    criteria.push('The suggestion names the file, fix instruction, and verification step before editing starts.');
  } else if (route?.tool === 'projscan_explain_issue') {
    criteria.push('A deep issue explanation is produced for the selected issue id.');
    criteria.push('The explanation identifies surrounding code, related issues, similar fixes, and the next fix prompt before editing starts.');
  } else if (route?.tool === 'projscan_regression_plan') {
    const level = regressionLevelFromPrimaryAction(primaryAction);
    criteria.push(regressionPlanCriterion(level, route));
    criteria.push('projscan ci --changed-only or the matching test command is rerun after the selected fix.');
  } else if (route?.tool === 'projscan_pr_diff') {
    criteria.push('The structural diff is reviewed for changed exports, imports, call sites, and complexity before a full review verdict.');
    criteria.push('The developer knows which changed files or symbols need deeper review.');
  } else if (route?.tool === 'projscan_file') {
    criteria.push(...fileSuccessCriteria(route));
  } else if (route?.tool === 'projscan_coverage') {
    criteria.push('Coverage gaps are ranked by risk so the next test target is explicit.');
    criteria.push('The selected file has either a new test plan, an owner, or a documented reason to defer.');
  } else if (route?.tool === 'projscan_upgrade') {
    criteria.push('The upgrade preview identifies declared version, installed version, breaking markers, and importers.');
    criteria.push('Importer files are reviewed before changing the package version.');
  } else if (route?.tool === 'projscan_audit') {
    criteria.push('npm audit findings are reviewed for critical, high, moderate, low, and info vulnerabilities.');
    criteria.push('Any vulnerable dependency has a fix, upgrade preview, or documented deferral before the branch is trusted.');
  } else if (route?.tool === 'projscan_workspaces') {
    criteria.push('Monorepo workspace packages are listed with names and relative paths before package-scoped work begins.');
    criteria.push('The selected workspace name is available for package-scoped follow-up commands such as hotspots, coupling, review, or audit.');
  } else if (route?.tool === 'projscan_dependencies') {
    if (route.matchedKeywords.some((keyword) => ['license', 'licenses', 'gpl', 'copyleft', 'notice', 'notices', 'third', 'party', 'open', 'source', 'compliance'].includes(keyword))) {
      criteria.push('Dependency license counts, unknown licenses, and copyleft risks are reviewed before third-party notices or compliance sign-off.');
    }
    if (route.matchedKeywords.some((keyword) => ['bundle', 'bundles', 'size', 'sizes', 'large', 'heavy', 'bloat', 'bloated', 'weight', 'footprint', 'reduce', 'slim'].includes(keyword))) {
      criteria.push('Installed package-size totals and largest packages are reviewed before bundle-size or dependency-bloat work starts.');
    }
    criteria.push('Declared production and development dependencies are inventoried before package changes are planned.');
    criteria.push('Any dependency risks, workspace-specific counts, or missing lockfile signal has an owner or follow-up command.');
  } else if (route?.tool === 'projscan_dataflow') {
    criteria.push('Dataflow findings are reviewed for direct, propagated, and bridge source-to-sink paths.');
    criteria.push('Any confirmed source-to-sink path has an owner, mitigation, and rerunnable verification command before editing continues.');
  } else if (route?.tool === 'projscan_semantic_graph') {
    criteria.push('The targeted graph query answers the importer/import/export question without dumping the full graph.');
    criteria.push('Any returned files are reviewed before editing the queried file or symbol.');
  } else if (route?.tool === 'projscan_coupling') {
    const direction = primaryAction?.args && 'direction' in primaryAction.args ? String(primaryAction.args.direction) : 'all';
    if (direction === 'cycles_only') {
      criteria.push('Circular-import cycles are reviewed with the exact files participating in each strongly connected component.');
    } else {
      criteria.push('Fan-in, fan-out, instability, cross-package edges, and circular-import cycles are reviewed before refactoring boundaries.');
    }
    criteria.push('Every high-coupling or circular-import target has an owner, refactor decision, or verification follow-up before architecture work starts.');
  } else if (route?.tool === 'projscan_search') {
    criteria.push('Search results identify the target files or symbols with enough confidence to choose the next tool.');
  }
  const firstTaskCommand = workplan.tasks[0]?.verification.commands[0];
  if (firstTaskCommand) criteria.push(`The next task has a verification command: ${firstTaskCommand}`);
  if (criteria.length === 0) {
    criteria.push('The primary action returns useful JSON and identifies the next concrete developer step.');
    criteria.push('At least one proof command is available before handing work to the next agent or human.');
  }
  return uniqueStrings(criteria).slice(0, 4);
}

function fileSuccessCriteria(route: StartRoutedIntent): string[] {
  const matched = new Set(route.matchedKeywords);
  const criteria: string[] = [];
  if (['risk', 'risks', 'risky', 'dangerous'].some((keyword) => matched.has(keyword))) {
    criteria.push('Hotspot reasons, related issues, imports, exports, and ownership explain why the file is risky.');
  }
  if (['last', 'touched', 'touch', 'changed', 'recently', 'history', 'author', 'authors', 'blame'].some((keyword) => matched.has(keyword))) {
    criteria.push('Primary author, recent history, and ownership signals are reviewed before routing reviewers or changing the file.');
  }
  if (['coverage', 'covered', 'uncovered', 'test', 'tests'].some((keyword) => matched.has(keyword))) {
    criteria.push('Coverage, hotspot risk, and related test evidence for the file are reviewed before editing starts.');
  }
  if (['add', 'write'].some((keyword) => matched.has(keyword)) || (matched.has('test') && !matched.has('coverage') && !matched.has('covered') && !matched.has('uncovered'))) {
    criteria.push('File purpose, risky functions, coverage, and existing test evidence are reviewed before designing a new test.');
  }
  if (matched.has('read')) {
    criteria.push('Purpose, imports, exports, ownership, tests, and risk are reviewed before changing the named file.');
  }
  if (['review', 'reviewer', 'reviewers'].some((keyword) => matched.has(keyword))) {
    criteria.push('Ownership, primary author, hotspot risk, and related issues are reviewed before choosing a reviewer.');
  }
  criteria.push('The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.');
  criteria.push('Any follow-up impact, owner, or test command from the file report is added to the workplan.');
  return criteria;
}

function understandSuccessCriteria(primaryAction: PreflightSuggestedAction | undefined, route?: StartRoutedIntent): string[] {
  const view = primaryAction?.args && 'view' in primaryAction.args ? String(primaryAction.args.view) : 'map';
  if (view === 'contracts') {
    const matched = new Set(route?.matchedKeywords ?? []);
    if (contractLocalServiceSetupCriteriaMatches(matched)) {
      return [
        'Local service startup scripts, container commands, and required config are reviewed before running dev services.',
        'The developer knows the safest command to start local services plus any env, port, or dependency preconditions.',
      ];
    }
    if (contractScriptDiscoveryCriteriaMatches(matched)) {
      return [
        'Package scripts, test commands, and config contracts are reviewed before running local commands.',
        'The developer knows the package-manager command for the requested script plus any required env or setup preconditions.',
      ];
    }
    if (contractDatabaseSetupCriteriaMatches(matched)) {
      return [
        'Package scripts and config contracts identify the seed, reset, or migration command before shell commands are guessed.',
        'The developer knows database setup preconditions, required env vars, and the safest local command to run.',
      ];
    }
    if (contractEnvCriteriaMatches(matched)) {
      return [
        'Required environment variables and config contracts are identified before setup or runtime troubleshooting continues.',
        'The developer knows which env names, defaults, or config files need local values before running the app.',
      ];
    }
    return [
      'Public exports, config contracts, and likely breaking-change risks are reviewed before touching API surfaces.',
      'The developer knows which exported files or symbols need compatibility checks.',
    ];
  }
  if (view === 'flow') {
    return [
      'Runtime entrypoints, flow paths, and side-effect evidence are reviewed before changing request or execution paths.',
      'The developer knows which files sit on the relevant runtime path.',
    ];
  }
  if (view === 'verify') {
    return [
      'Verification tiers, direct-test gaps, and likely proof commands are reviewed before pushing or asking for review.',
      'The developer has the smallest rerunnable command plus the fallback full gate for the intended change.',
    ];
  }
  if (view === 'change') {
    return [
      'Change-readiness risks, blast radius, and verification tiers are reviewed before editing starts.',
      'The developer knows which follow-up impact, test, or preflight command gates the change.',
    ];
  }
  return [
    'Read-first files, entrypoints, boundaries, risks, and unknowns are reviewed before editing starts.',
    'The developer has a cited repo map and knows which files to inspect next.',
  ];
}

function contractScriptDiscoveryCriteriaMatches(matched: Set<string>): boolean {
  return ['npm', 'script', 'scripts', 'e2e', 'unit', 'integration', 'storybook', 'cypress', 'playwright', 'eslint', 'prettier', 'format', 'lint', 'typecheck', 'typechecking'].some((keyword) => matched.has(keyword));
}

function contractLocalServiceSetupCriteriaMatches(matched: Set<string>): boolean {
  const action = ['run', 'runs', 'start', 'command', 'commands', 'setup'].some((keyword) => matched.has(keyword));
  const localServices = ['local', 'locally', 'dev'].some((keyword) => matched.has(keyword)) && ['service', 'services', 'server', 'app'].some((keyword) => matched.has(keyword));
  const dockerCompose = matched.has('docker') && matched.has('compose');
  return action && (localServices || dockerCompose);
}

function contractDatabaseSetupCriteriaMatches(matched: Set<string>): boolean {
  return (
    ['database', 'db', 'migration', 'migrations'].some((keyword) => matched.has(keyword)) &&
    ['seed', 'seeds', 'reset', 'resets', 'migrate', 'migrates', 'run', 'runs', 'command'].some((keyword) => matched.has(keyword))
  );
}

function contractEnvCriteriaMatches(matched: Set<string>): boolean {
  return ['env', 'environment', 'environments', 'vars', 'variable', 'variables', 'missing', 'required'].some((keyword) => matched.has(keyword));
}

function regressionLevelFromPrimaryAction(primaryAction: PreflightSuggestedAction | undefined): RegressionPlanLevel {
  const level = primaryAction?.args && 'level' in primaryAction.args ? String(primaryAction.args.level) : 'focused';
  if (level === 'smoke' || level === 'focused' || level === 'full') return level;
  return 'focused';
}

function regressionPlanCriterion(level: RegressionPlanLevel, route?: StartRoutedIntent): string {
  if (level === 'smoke') return 'The smoke regression plan identifies the smallest health and preflight commands to rerun.';
  if (level === 'full') return 'The full regression plan identifies release-grade build, lint, stability, and test commands to rerun.';
  if (route && route.matchedKeywords.some((keyword) => ['production', 'prod', 'down', 'outage', 'incident', 'triage', 'runtime', 'crash', 'crashes', 'crashing', '500', '502', '503', '504', '404', '403', '401'].includes(keyword))) {
    return 'The focused regression plan identifies the smallest high-signal commands to reproduce and verify the failure.';
  }
  if (route && route.matchedKeywords.some((keyword) => ['connection', 'refused', 'port', 'ports', 'eaddrinuse', 'listen', 'address', 'permission', 'denied', 'enoent', 'eresolve', 'peer'].includes(keyword))) {
    return 'The focused regression plan identifies the local setup command, environment symptom, and smallest rerun proof for the blocker.';
  }
  return 'The focused regression plan identifies the failing CI or test signal and the smallest verification command to rerun.';
}

function isPreflightAction(action: PreflightSuggestedAction): boolean {
  return action.tool === 'projscan_preflight' || action.command?.startsWith('projscan preflight ') === true;
}

function preflightModeForMission(mode: WorkplanMode): 'before_edit' | 'before_commit' | 'before_merge' {
  if (mode === 'before_commit') return 'before_commit';
  if (mode === 'hardening') return 'before_commit';
  if (mode === 'before_merge' || mode === 'release') return 'before_merge';
  return 'before_edit';
}

function chooseWorkflow(mode: WorkplanMode, recipes: AgentWorkflowRecipe[]): StartWorkflowRecommendation {
  const id = recipeIdForMode(mode);
  const recipe = recipes.find((entry) => entry.id === id) ?? recipes[0];
  return {
    id: recipe.id,
    name: recipe.name,
    why: `${recipe.useWhen} ${recipe.outcome}`,
    commands: recipe.commands,
    mcpTools: recipe.mcpTools,
  };
}

function recipeIdForMode(mode: WorkplanMode): string {
  if (mode === 'bug_hunt') return 'bug_hunt';
  if (mode === 'release') return 'release_approval';
  if (mode === 'before_commit' || mode === 'before_merge') return 'pre_merge';
  if (mode === 'hardening') return 'bug_hunt';
  if (mode === 'refactor') return 'before_edit';
  return 'before_edit';
}

function combineRisks(
  workplan: WorkplanReport,
  qualityRisks: QualityScorecardRisk[],
  maxRisks: number,
): StartRisk[] {
  const fromWorkplan = workplan.topRisks.map(workplanRiskToStartRisk);
  const fromQuality = qualityRisks.map(qualityRiskToStartRisk);
  const risks = dedupeRisks([...fromWorkplan, ...fromQuality]).slice(0, maxRisks);
  if (risks.length > 0) return risks;
  return [
    {
      id: 'start-baseline',
      priority: 'p2',
      title: 'Preserve the clean baseline',
      source: 'baseline',
      files: [],
      command: 'projscan start --format json',
    },
  ];
}

function workplanRiskToStartRisk(risk: WorkplanTopRisk, index: number): StartRisk {
  return {
    id: `start-workplan-${index + 1}`,
    priority: risk.priority,
    title: risk.message,
    source: risk.source,
    files: risk.file ? [risk.file] : [],
    command: risk.tool === 'projscan_review' ? 'projscan review --format json' : 'projscan preflight --format json',
  };
}

function qualityRiskToStartRisk(risk: QualityScorecardRisk): StartRisk {
  return {
    id: `start-quality-${risk.id}`,
    priority: risk.priority,
    title: risk.title,
    source: risk.source,
    files: risk.files,
    command: risk.command,
  };
}

function dedupeRisks(risks: StartRisk[]): StartRisk[] {
  const seen = new Set<string>();
  const result: StartRisk[] = [];
  for (const risk of risks) {
    const key = `${risk.title}:${risk.files.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(risk);
  }
  return result;
}

function dedupeActions(actions: PreflightSuggestedAction[]): PreflightSuggestedAction[] {
  const seen = new Set<string>();
  const result: PreflightSuggestedAction[] = [];
  for (const action of actions) {
    const key = action.command ? `command:${action.command}` : `action:${action.label}:${action.tool ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }
  return result.slice(0, 12);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function summarize(
  mode: WorkplanMode,
  workplan: WorkplanReport,
  qualityRisks: number,
  adoptionGaps: number,
  fixFirstTitle?: string,
): string {
  return `start: ${mode} recommends ${fixFirstTitle ?? workplan.tasks[0]?.title ?? 'preserving the baseline'} with ${qualityRisks} quality risk(s) and ${adoptionGaps} adoption gap(s)`;
}
