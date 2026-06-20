import type {
  StartMissionControlStatus,
  StartMissionProofItem,
  StartMissionReviewDecision,
  StartMissionReviewGate,
  StartMissionReviewPolicy,
  StartMissionReviewProof,
  StartMissionReviewWorktree,
  StartMissionResume,
  StartMissionToolCall,
  StartReport,
} from '../types/start.js';

export const READY_PROOF_SUMMARY =
  'Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.';

export function buildMissionReviewGate(input: {
  status: StartMissionControlStatus;
  doneWhen: string[];
  proof: StartMissionReviewProof;
  currentWorktree: StartReport['evidence']['riskSources']['currentWorktree'];
  autonomousContinuation?: boolean;
}): StartMissionReviewGate {
  const autonomousContinuation = input.autonomousContinuation === true;
  const checklist = [
    'Complete this task card and remaining proof.',
    'Capture `git status --short`.',
    'Capture `git diff --stat`.',
    autonomousContinuation
      ? 'Continue only with another bounded implementation slice after proof; stop before release, publish, deploy, push, merge, or version bump.'
      : 'Stop and ask for approval before starting another slice, release, publish, or deploy.',
  ];
  const commands = ['git status --short', 'git diff --stat'];
  const doneWhen = input.doneWhen.slice();
  const policy = buildMissionReviewPolicy(autonomousContinuation);
  const decisions = buildMissionReviewDecisions(autonomousContinuation);
  const worktree = buildMissionReviewWorktree(input.currentWorktree);
  const stopCondition = autonomousContinuation
    ? 'Continue with bounded implementation slices after the current Mission Control checklist and proof; stop for approval before release, publish, deploy, push, merge, or version bump.'
    : 'Stop after the current Mission Control checklist and proof are complete.';
  const reviewPrompt = autonomousContinuation
    ? `Review the completed mission, proof output, and working-tree summary before any release, publish, deploy, push, merge, or version bump. ${input.proof.summary}`
    : `Review the completed mission, proof output, and working-tree summary before approving another slice, release, publish, or deploy. ${input.proof.summary}`;
  return {
    title: 'Mission Review Gate',
    required: true,
    status: input.status,
    stopCondition,
    reviewPrompt,
    checklist,
    doneWhen,
    policy,
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
      policy,
      decisions,
      commands,
      worktree,
      proof: input.proof,
    }),
  };
}

export function buildMissionReviewProof(
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

export function formatMissionReviewDecision(decision: StartMissionReviewDecision): string {
  return `- [ ] ${decision.label}: ${decision.description} Consequence: ${decision.consequence} Reply: "${decision.reply}"`;
}

function buildMissionReviewPolicy(autonomousContinuation = false): StartMissionReviewPolicy {
  return {
    approvalRequired: true,
    blockedActions: autonomousContinuation
      ? ['release', 'publish', 'deploy', 'push', 'merge', 'version_bump']
      : ['next_slice', 'release', 'publish', 'deploy', 'push', 'merge', 'version_bump'],
    summary: autonomousContinuation
      ? 'Autonomous bounded implementation slices may continue after proof; explicit reviewer approval is still required before release, publish, deploy, push, merge, or version bump.'
      : 'Explicit reviewer approval is required before another slice, release, publish, deploy, push, merge, or version bump.',
  };
}

function buildMissionReviewDecisions(autonomousContinuation = false): StartMissionReviewDecision[] {
  return [
    {
      id: 'approve_next_slice',
      label: autonomousContinuation ? 'Continue next slice' : 'Approve next slice',
      description: autonomousContinuation
        ? 'The agent may continue with another bounded implementation slice after proof.'
        : 'The agent may start another bounded implementation slice.',
      consequence:
        'No release, publish, deploy, or version bump is allowed unless the reviewer asks for it.',
      reply: autonomousContinuation
        ? 'Continue: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version.'
        : 'Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version.',
    },
    {
      id: 'request_changes',
      label: 'Request changes',
      description: 'The agent must address review feedback before starting more scope.',
      consequence: 'The current mission stays open until feedback and proof are updated.',
      reply:
        'Changes requested: address the review feedback first, update proof, then stop for another review.',
    },
    {
      id: 'review_version_candidate',
      label: 'Review version candidate',
      description:
        'The agent may prepare release notes, version rationale, and remaining gates for review.',
      consequence: 'Publishing still requires a separate explicit approval.',
      reply:
        'Prepare a version-candidate review only. Do not publish, deploy, push, merge, or bump the version.',
    },
  ];
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
      branchChangedFileCount: 0,
      uncommittedChangedFileCount: 0,
      files: [],
      baseRef: currentWorktree.baseRef,
      summary: `Current worktree evidence is unavailable: ${reason}.`,
      reason,
    };
  }

  const changedFileCount = currentWorktree.count;
  const baseRef = currentWorktree.baseRef;
  const uncommittedChangedFileCount =
    currentWorktree.uncommittedChangedFileCount ?? changedFileCount;
  const branchChangedFileCount =
    currentWorktree.branchChangedFileCount ??
    Math.max(0, changedFileCount - uncommittedChangedFileCount);
  return {
    available: true,
    clean: uncommittedChangedFileCount === 0,
    changedFileCount,
    branchChangedFileCount,
    uncommittedChangedFileCount,
    files: currentWorktree.files,
    baseRef,
    summary: missionReviewWorktreeSummary({
      baseRef,
      branchChangedFileCount,
      uncommittedChangedFileCount,
    }),
  };
}

function missionReviewWorktreeSummary(input: {
  baseRef: string | null;
  branchChangedFileCount: number;
  uncommittedChangedFileCount: number;
}): string {
  const baseSuffix = input.baseRef ? ` from ${input.baseRef}` : '';
  if (input.uncommittedChangedFileCount === 0 && input.branchChangedFileCount === 0) {
    return 'Working tree has no uncommitted changes and no branch diff files.';
  }
  if (input.uncommittedChangedFileCount === 0) {
    return `Working tree has no uncommitted changes; branch differs${baseSuffix} by ${input.branchChangedFileCount} file(s).`;
  }
  if (input.branchChangedFileCount === 0) {
    return `Working tree has ${input.uncommittedChangedFileCount} uncommitted changed file(s).`;
  }
  return `Working tree has ${input.uncommittedChangedFileCount} uncommitted changed file(s); branch differs${baseSuffix} by ${input.branchChangedFileCount} committed file(s).`;
}

function renderMissionReviewGateMarkdown(input: {
  status: StartMissionControlStatus;
  stopCondition: string;
  reviewPrompt: string;
  checklist: string[];
  doneWhen: string[];
  policy: StartMissionReviewPolicy;
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
    '## Review Policy',
    `Approval required: ${input.policy.approvalRequired ? 'yes' : 'no'}`,
    input.policy.summary,
    'Blocked until approval:',
    ...input.policy.blockedActions.map(formatMissionReviewBlockedAction),
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

function formatMissionReviewBlockedAction(
  action: StartMissionReviewPolicy['blockedActions'][number],
): string {
  const labels: Record<StartMissionReviewPolicy['blockedActions'][number], string> = {
    next_slice: 'Start another implementation slice',
    release: 'Release',
    publish: 'Publish',
    deploy: 'Deploy',
    push: 'Push',
    merge: 'Merge',
    version_bump: 'Version bump',
  };
  return `- ${labels[action]} (\`${action}\`)`;
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
