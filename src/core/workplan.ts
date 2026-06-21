import { fixFirstFromWorkplanRisk, fixFirstFromWorkplanTask } from './fixFirst.js';
import { computePreflight, type ComputePreflightOptions } from './preflight.js';
import { computeQualityScorecard } from './qualityScorecard.js';
import { buildRiskNow } from './sessionResources.js';
import { loadOwnership, type OwnershipLookup } from './ownership.js';
import { escapeDoubleQuoted } from './startShellArgs.js';
import type { QualityScorecardRisk } from '../types/qualityScorecard.js';
import type {
  PreflightMode,
  PreflightReason,
  PreflightSuggestedAction,
  PreflightVerdict,
  SessionConflict,
  WorkplanCoordination,
  WorkplanEvidence,
  WorkplanHandoffPayload,
  WorkplanMode,
  WorkplanPriority,
  WorkplanReport,
  WorkplanTask,
  WorkplanTopRisk,
} from '../types.js';

export interface ComputeWorkplanOptions {
  mode?: WorkplanMode;
  baseRef?: string;
  headRef?: string;
  maxChangedFiles?: number;
  maxTasks?: number;
  enablePlugins?: boolean;
}

const DEFAULT_MAX_TASKS = 8;
const MAX_TOP_RISKS = 8;
const MAX_COORDINATION_FILES = 20;
const HANDOFF_LIMIT = 320;

const WORKPLAN_MODES: readonly WorkplanMode[] = [
  'before_edit',
  'before_commit',
  'before_merge',
  'refactor',
  'release',
  'bug_hunt',
  'hardening',
];

export function isWorkplanMode(value: string): value is WorkplanMode {
  return (WORKPLAN_MODES as readonly string[]).includes(value);
}

export async function computeWorkplan(
  rootPath: string,
  options: ComputeWorkplanOptions = {},
): Promise<WorkplanReport> {
  const mode = options.mode ?? 'before_edit';
  const preflightMode = modeToPreflightMode(mode);
  const preflight = await computePreflight(rootPath, {
    mode: preflightMode,
    baseRef: options.baseRef,
    headRef: options.headRef,
    maxChangedFiles: options.maxChangedFiles,
    enablePlugins: options.enablePlugins,
  } satisfies ComputePreflightOptions);
  const [riskNow, ownership, qualitySignals] = await Promise.all([
    safeRiskNow(rootPath),
    loadOwnership(rootPath).catch(() => undefined),
    safeQualitySignals(rootPath, mode),
  ]);
  const coordination = buildCoordination(
    preflight.verdict,
    riskNow.touchedFiles,
    riskNow.conflicts,
  );
  const modeFiles = unique([...coordination.touchedFiles, ...qualitySignals.files]);
  const tasks = rankWorkplanTasks([
    ...tasksFromPreflight(preflight.reasons),
    ...tasksFromCoordination(coordination),
    ...modeTasks(mode, preflight.verdict, modeFiles, qualitySignals.evidence),
  ]);
  const maxTasks = normalizeMaxTasks(options.maxTasks);
  const limitedTasks = annotateTasksWithOwners(tasks.slice(0, maxTasks), ownership);
  const topRisks = annotateTopRisksWithOwners(
    buildTopRisks(preflight.reasons, coordination.conflicts, qualitySignals.topRisks),
    ownership,
  );
  const fixFirst =
    fixFirstFromWorkplanTask(limitedTasks[0]) ?? fixFirstFromWorkplanRisk(topRisks[0]);
  const truncated =
    tasks.length > limitedTasks.length ||
    preflight.truncated === true ||
    riskNow.truncated === true ||
    coordination.touchedFiles.length > MAX_COORDINATION_FILES;

  return {
    schemaVersion: 1,
    mode,
    verdict: preflight.verdict,
    summary: summarizeWorkplan(mode, preflight.verdict, limitedTasks, topRisks),
    topRisks,
    tasks: limitedTasks,
    ...(fixFirst ? { fixFirst } : {}),
    coordination,
    suggestedNextActions: dedupeActions([
      ...preflight.suggestedNextActions,
      ...limitedTasks.flatMap((task) => taskToSuggestedActions(task)),
    ]),
    ...(truncated ? { truncated: true } : {}),
  };
}

export function buildWorkplanHandoff(report: WorkplanReport): WorkplanHandoffPayload {
  const next = report.tasks.slice(0, 5).map((task) => task.handoffText);
  const verificationCommands = unique(
    report.tasks.flatMap((task) => task.verification.commands),
  ).slice(0, 12);
  return {
    summary: report.summary,
    verdict: report.verdict,
    mode: report.mode,
    next,
    verificationCommands,
    coordination: report.coordination,
    markdown: renderWorkplanHandoffMarkdown(report, next, verificationCommands),
  };
}

function renderWorkplanHandoffMarkdown(
  report: WorkplanReport,
  next: string[],
  verificationCommands: string[],
): string {
  const lines = [
    '# Agent Handoff',
    '',
    `**Mode:** ${report.mode}`,
    `**Verdict:** ${report.verdict}`,
    '',
    report.summary,
    '',
    '## Next',
    ...(next.length > 0 ? next.map((item) => `- ${item}`) : ['- Preserve the current baseline.']),
    '',
    '## Verification',
    ...(verificationCommands.length > 0
      ? verificationCommands.map((command) => `- \`${command}\``)
      : ['- `projscan preflight --format json`']),
    '',
    '## Coordination',
    `- ${report.coordination.recommendedNextAgent}`,
    ...report.coordination.touchedFiles.slice(0, 10).map((file) => `- touched: ${file}`),
  ];
  return `${lines.join('\n')}\n`;
}

function modeToPreflightMode(mode: WorkplanMode): PreflightMode {
  if (mode === 'before_commit' || mode === 'before_merge' || mode === 'before_edit') return mode;
  if (mode === 'release') return 'before_merge';
  return 'before_edit';
}

async function safeRiskNow(rootPath: string): Promise<{
  conflicts: SessionConflict[];
  touchedFiles: string[];
  truncated?: boolean;
}> {
  try {
    return await buildRiskNow(rootPath);
  } catch (err) {
    return {
      conflicts: [
        {
          kind: 'same-file',
          files: [],
          message: `coordination signals unavailable: ${err instanceof Error ? err.message : String(err)}`,
          severity: 'warning',
        },
      ],
      touchedFiles: [],
    };
  }
}

interface WorkplanQualitySignals {
  files: string[];
  evidence: WorkplanEvidence[];
  topRisks: WorkplanTopRisk[];
}

async function safeQualitySignals(
  rootPath: string,
  mode: WorkplanMode,
): Promise<WorkplanQualitySignals> {
  if (mode !== 'bug_hunt') return emptyQualitySignals();
  try {
    const report = await computeQualityScorecard(rootPath, { maxRisks: MAX_TOP_RISKS });
    const topRisks = report.topRisks
      .map(qualityRiskToWorkplanRisk)
      .filter((risk): risk is WorkplanTopRisk => risk !== undefined);
    return {
      files: unique(report.topRisks.flatMap((risk) => risk.files)),
      evidence: topRisks.map((risk) => ({
        source: risk.source,
        message: risk.message,
        ...(risk.severity ? { severity: risk.severity } : {}),
        ...(risk.file ? { file: risk.file } : {}),
        ...(risk.issueId ? { issueId: risk.issueId } : {}),
        ...(risk.tool ? { tool: risk.tool } : {}),
      })),
      topRisks,
    };
  } catch {
    return emptyQualitySignals();
  }
}

function emptyQualitySignals(): WorkplanQualitySignals {
  return { files: [], evidence: [], topRisks: [] };
}

function qualityRiskToWorkplanRisk(risk: QualityScorecardRisk): WorkplanTopRisk | undefined {
  if (risk.files.length === 0) return undefined;
  const tool = toolFromCommand(risk.command);
  return {
    source: workplanSourceFromQualityRisk(risk.source),
    message: risk.title,
    priority: risk.priority,
    file: risk.files[0],
    ...(tool ? { tool } : {}),
  };
}

function workplanSourceFromQualityRisk(
  source: QualityScorecardRisk['source'],
): WorkplanEvidence['source'] {
  if (source === 'hotspot') return 'hotspots';
  if (source === 'coordination') return 'coordination';
  return 'doctor';
}

function toolFromCommand(command: string): string | undefined {
  if (command.startsWith('projscan file ')) return 'projscan_file';
  if (command.startsWith('projscan doctor ')) return 'projscan_doctor';
  if (command.startsWith('projscan session ')) return 'projscan_session';
  if (command.startsWith('projscan quality-scorecard ')) return 'projscan_quality_scorecard';
  return undefined;
}

function buildCoordination(
  verdict: PreflightVerdict,
  touchedFiles: string[],
  conflicts: SessionConflict[],
): WorkplanCoordination {
  const visibleTouched = touchedFiles.slice(0, MAX_COORDINATION_FILES);
  let recommendedNextAgent = 'preflight agent: run the safety gate, then pick the first p0/p1 task';
  if (verdict === 'block') {
    recommendedNextAgent = 'hardening agent: resolve p0 blockers before feature work continues';
  } else if (conflicts.length > 0) {
    recommendedNextAgent =
      'coordination agent: inspect touched-file overlap before parallel edits continue';
  } else if (visibleTouched.length > 0) {
    recommendedNextAgent =
      'handoff/preflight agent: continue from touched-file context, then confirm the safety gate before editing';
  }
  return {
    touchedFiles: visibleTouched,
    conflicts,
    recommendedNextAgent,
  };
}

function tasksFromPreflight(reasons: PreflightReason[]): WorkplanTask[] {
  const tasks: WorkplanTask[] = [];
  const bySource = new Map<string, PreflightReason[]>();
  for (const reason of reasons) {
    const key = `${reason.source}:${reason.severity}`;
    const group = bySource.get(key) ?? [];
    group.push(reason);
    bySource.set(key, group);
  }

  const supplyChain = reasons.filter((reason) => reason.source === 'supply-chain');
  if (supplyChain.length > 0) {
    tasks.push(
      makeTask({
        id: 'wp-supply-chain-1',
        priority: supplyChain.some((reason) => reason.severity === 'error') ? 'p0' : 'p1',
        title: 'Resolve supply-chain trust blockers',
        why: 'Supply-chain findings can mean install-time compromise, unsafe dependency provenance, or hidden persistence hooks. Handle these before continuing with normal product work.',
        evidence: supplyChain.map(reasonToEvidence),
        files: filesFromReasons(supplyChain),
        suggestedTools: ['projscan_doctor', 'projscan_preflight'],
        commands: ['projscan preflight --format json', 'projscan doctor --format json'],
        expected:
          'No supply-chain errors remain, and preflight no longer blocks on supply-chain evidence.',
      }),
    );
  }

  const review = reasons.filter(
    (reason) => reason.source === 'review' || reason.source === 'taint',
  );
  if (review.length > 0) {
    tasks.push(
      makeTask({
        id: 'wp-review-gate',
        priority: review.some((reason) => reason.severity === 'error') ? 'p0' : 'p1',
        title: 'Inspect review and dataflow blockers',
        why: 'Review, taint, and dataflow findings describe merge safety, new risky flows, and structural changes that need explicit handling before handoff.',
        evidence: review.map(reasonToEvidence),
        files: filesFromReasons(review),
        suggestedTools: [
          'projscan_review',
          'projscan_semantic_graph',
          'projscan_taint',
          'projscan_dataflow',
        ],
        commands: [
          'projscan review --format json',
          'projscan semantic-graph --format json',
          'projscan dataflow --format json',
          'projscan preflight --mode before_merge --format json',
        ],
        expected:
          'The review verdict is ok or the remaining review items are intentionally documented.',
      }),
    );
  }

  const doctor = reasons.filter(
    (reason) => reason.source === 'doctor' || reason.source === 'plugin',
  );
  if (doctor.length > 0) {
    tasks.push(
      makeTask({
        id: 'wp-health-policy',
        priority: doctor.some((reason) => reason.severity === 'error') ? 'p0' : 'p1',
        title: 'Fix health and plugin-policy findings',
        why: 'Health and local policy findings are the fastest path from diagnosis to concrete fixes because they point at files, issue ids, and existing fix suggestions.',
        evidence: doctor.map(reasonToEvidence),
        files: filesFromReasons(doctor),
        suggestedTools: ['projscan_doctor', 'projscan_fix_suggest'],
        commands: ['projscan doctor --format json', 'npm test'],
        expected:
          'The relevant issue ids disappear from projscan doctor and the focused test command passes.',
      }),
    );
  }

  const hotspots = reasons.filter((reason) => reason.source === 'hotspots');
  if (hotspots.length > 0) {
    tasks.push(
      makeTask({
        id: 'wp-touched-hotspots',
        priority: 'p1',
        title: 'Review touched high-risk hotspots',
        why: 'Touched hotspots combine churn, complexity, and issue density. They are where small mistakes most often become expensive regressions.',
        evidence: hotspots.map(reasonToEvidence),
        files: filesFromReasons(hotspots),
        suggestedTools: ['projscan_hotspots', 'projscan_file'],
        commands: ['projscan hotspots --format json', 'projscan file <path> --format json'],
        expected:
          'The touched hotspot has a clear owner, test target, and reduced or accepted risk.',
      }),
    );
  }

  const changed = reasons.filter(
    (reason) => reason.source === 'changed-files' || reason.source === 'git',
  );
  if (changed.length > 0) {
    tasks.push(
      makeTask({
        id: 'wp-git-scope',
        priority: 'p1',
        title: 'Stabilize git scope for review',
        why: 'A workplan is only useful when changed-file and base-ref evidence are reliable. Pin the base ref before trusting merge decisions.',
        evidence: changed.map(reasonToEvidence),
        files: [],
        suggestedTools: ['projscan_preflight', 'projscan_review'],
        commands: ['projscan preflight --base-ref main --format json'],
        expected:
          'Changed-file evidence is available and review can compare the intended base/head refs.',
      }),
    );
  }

  return tasks;
}

function tasksFromCoordination(coordination: WorkplanCoordination): WorkplanTask[] {
  if (coordination.touchedFiles.length === 0 && coordination.conflicts.length === 0) return [];
  const evidence: WorkplanEvidence[] = [
    ...coordination.touchedFiles.slice(0, 5).map((file) => ({
      source: 'coordination' as const,
      file,
      message: `session touched ${file}`,
    })),
    ...coordination.conflicts.map((conflict) => ({
      source: 'coordination' as const,
      severity: conflict.severity,
      file: conflict.files[0],
      message: conflict.message,
    })),
  ];
  return [
    makeTask({
      id: 'wp-session-handoff',
      priority: coordination.conflicts.some((conflict) => conflict.severity === 'error')
        ? 'p0'
        : 'p1',
      title: 'Coordinate touched files before parallel work continues',
      why: 'Session evidence tells the next agent what changed recently and which files may collide across agents.',
      evidence,
      files: coordination.touchedFiles,
      suggestedTools: ['projscan_session', 'projscan://handoff', 'projscan://risk-now'],
      commands: ['projscan session touched --format json', 'projscan handoff'],
      expected:
        'The next agent can name touched files, current overlap risks, and the first safe task.',
    }),
  ];
}

function modeTasks(
  mode: WorkplanMode,
  verdict: PreflightVerdict,
  touchedFiles: string[],
  qualityEvidence: WorkplanEvidence[] = [],
): WorkplanTask[] {
  const tasks: WorkplanTask[] = [];
  if (mode === 'bug_hunt') {
    const bugHuntFiles = unique([...touchedFiles, ...filesFromEvidence(qualityEvidence)]);
    tasks.push(
      makeTask({
        id: 'wp-bug-hunt-hotspots',
        priority: verdict === 'block' ? 'p1' : 'p0',
        title: 'Hunt bugs in the highest-risk files',
        why: 'The fastest polish pass starts where churn, complexity, and current issues overlap instead of scanning the whole repository equally.',
        evidence: [
          ...qualityEvidence.slice(0, 5),
          {
            source: 'verification',
            message: 'bug_hunt mode prioritizes hotspots, doctor issues, and focused tests',
          },
        ],
        files: bugHuntFiles,
        suggestedTools: ['projscan_hotspots', 'projscan_file', 'projscan_doctor'],
        commands: ['projscan hotspots --format json', 'projscan doctor --format json', 'npm test'],
        expected:
          'At least one high-risk file or issue is either fixed, covered by a focused test, or explicitly deferred with evidence.',
      }),
    );
    tasks.push(
      makeTask({
        id: 'wp-bug-hunt-regression-tests',
        priority: 'p1',
        title: 'Add or run regression tests for the risky change path',
        why: 'Polish work only sticks when the exact failure mode is covered by a repeatable command.',
        evidence: [
          {
            source: 'verification',
            message: 'every bug hunt task should end with a reproducible verification command',
          },
        ],
        files: touchedFiles,
        suggestedTools: ['projscan_review', 'projscan_coverage'],
        commands: ['npm test', 'npm run lint'],
        expected:
          'The focused regression test fails before the fix, passes after the fix, and lint stays clean.',
      }),
    );
  }

  if (mode === 'release') {
    tasks.push(
      makeTask({
        id: 'wp-release-readiness',
        priority: 'p0',
        title: 'Run the local release-readiness gate',
        why: 'Release work needs one local command that checks version metadata, changelog, tag state, release gates, SBOM, and packed install smoke before any publish action.',
        evidence: [
          {
            source: 'release',
            message: 'release mode requires release:check before tagging or dispatching workflows',
          },
        ],
        files: ['package.json', 'CHANGELOG.md', '.github/mcp-registry/server.json'],
        suggestedTools: ['release:check', 'projscan_preflight'],
        commands: ['npm run release:check'],
        expected: 'release:check reports no blockers and prints the next release action.',
      }),
    );
    tasks.push(
      makeTask({
        id: 'wp-release-website',
        priority: 'p2',
        title: 'Prepare the local website update prompt',
        why: 'The website update starts as local handoff text; package, GitHub Release, and MCP Registry checks wait until release approval.',
        evidence: [
          {
            source: 'release',
            message: 'website follow-up starts from local evidence-pack prompt text',
          },
        ],
        files: ['docs/WEBSITE-UPDATE-PROMPT.md'],
        suggestedTools: ['projscan_evidence_pack', 'website prompt'],
        commands: ['projscan evidence-pack --website-prompt --format json'],
        expected:
          'Website prompt is generated as local handoff text; final website update waits for release approval and shipped assets.',
      }),
    );
  }

  if (mode === 'refactor') {
    tasks.push(
      makeTask({
        id: 'wp-refactor-impact',
        priority: verdict === 'block' ? 'p1' : 'p0',
        title: 'Pick one hotspot and inspect blast radius',
        why: 'A safe refactor starts with one high-risk file and an impact map, not a broad cleanup pass.',
        evidence: [
          {
            source: 'verification',
            message: 'refactor mode composes hotspots with impact before edits',
          },
        ],
        files: touchedFiles,
        suggestedTools: ['projscan_hotspots', 'projscan_impact'],
        commands: ['projscan hotspots --format json', 'projscan impact <file> --format json'],
        expected:
          'The chosen refactor target has importers, tests, and rollback scope identified before edits begin.',
      }),
    );
  }

  if (mode === 'hardening') {
    tasks.push(
      makeTask({
        id: 'wp-hardening-gate',
        priority: verdict === 'block' ? 'p1' : 'p0',
        title: 'Run security and supply-chain hardening checks',
        why: 'Hardening mode should prove the repo can reject compromised dependencies, unsafe scripts, and known audit findings.',
        evidence: [
          {
            source: 'supply-chain',
            message: 'hardening mode pairs preflight evidence with release security gates',
          },
        ],
        files: ['package.json', 'package-lock.json'],
        suggestedTools: [
          'projscan_preflight',
          'projscan_doctor',
          'projscan_semantic_graph',
          'npm audit',
        ],
        commands: [
          'projscan preflight --format json',
          'projscan semantic-graph --format json',
          'npm audit --audit-level=moderate',
        ],
        expected:
          'Preflight has no supply-chain blockers and npm audit reports no moderate-or-higher vulnerabilities.',
      }),
    );
  }

  if (mode === 'before_edit') {
    tasks.push(
      makeTask({
        id: 'wp-before-edit-orient',
        priority: verdict === 'block' ? 'p1' : 'p0',
        title: 'Orient before editing',
        why: 'Before editing, the agent needs a compact safety verdict, touched-file context, and the first target file.',
        evidence: [
          {
            source: 'verification',
            message: 'before_edit mode starts from preflight and session context',
          },
        ],
        files: touchedFiles,
        suggestedTools: ['projscan_preflight', 'projscan_session', 'projscan_hotspots'],
        commands: ['projscan preflight --mode before_edit --format json'],
        expected:
          'The agent can explain whether it may proceed and which evidence supports the next edit.',
      }),
    );
  }

  if (mode === 'before_commit' || mode === 'before_merge') {
    tasks.push(
      makeTask({
        id: 'wp-merge-readiness',
        priority: verdict === 'block' ? 'p1' : 'p0',
        title: 'Prove commit and merge readiness',
        why: 'Commit and merge gates should be based on changed-file evidence, review verdict, taint status, and focused verification commands.',
        evidence: [
          {
            source: 'review',
            message: `${mode} mode composes review, preflight, and changed-file checks`,
          },
        ],
        files: touchedFiles,
        suggestedTools: ['projscan_preflight', 'projscan_review', 'projscan_semantic_graph'],
        commands: [
          `projscan preflight --mode ${mode} --format json`,
          'projscan semantic-graph --format json',
          'npm test',
          'npm run lint',
        ],
        expected:
          'Preflight is proceed or the remaining caution/block reasons are fixed before handoff.',
      }),
    );
  }

  return tasks;
}

function makeTask(input: {
  id: string;
  priority: WorkplanPriority;
  title: string;
  why: string;
  evidence: WorkplanEvidence[];
  files: string[];
  suggestedTools: string[];
  commands: string[];
  expected: string;
}): WorkplanTask {
  const files = unique(input.files.filter(Boolean)).slice(0, 12);
  const handoffText = compact(
    `${input.priority.toUpperCase()} ${input.title}: ${input.why} Verify with ${input.commands.join(' && ')}.${files.length > 0 ? ` Files: ${files.join(', ')}.` : ''}`,
    HANDOFF_LIMIT,
  );
  return {
    id: input.id,
    priority: input.priority,
    title: input.title,
    why: input.why,
    evidence: input.evidence,
    files,
    suggestedTools: unique(input.suggestedTools),
    verification: {
      commands: input.commands,
      expected: input.expected,
    },
    handoffText,
  };
}

export function rankWorkplanTasks(tasks: WorkplanTask[]): WorkplanTask[] {
  const seen = new Set<string>();
  return tasks
    .filter((task) => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    })
    .sort((a, b) => {
      const priority = priorityRank(a.priority) - priorityRank(b.priority);
      if (priority !== 0) return priority;
      const evidence = strongestEvidenceRank(a.evidence) - strongestEvidenceRank(b.evidence);
      if (evidence !== 0) return evidence;
      return a.id.localeCompare(b.id);
    });
}

function strongestEvidenceRank(evidence: WorkplanEvidence[]): number {
  if (evidence.some((item) => item.severity === 'error')) return 0;
  if (evidence.some((item) => item.severity === 'warning')) return 1;
  return 2;
}

function priorityRank(priority: WorkplanPriority): number {
  if (priority === 'p0') return 0;
  if (priority === 'p1') return 1;
  return 2;
}

function reasonToEvidence(reason: PreflightReason): WorkplanEvidence {
  return {
    source: reason.source,
    message: reason.message,
    severity: reason.severity,
    ...(reason.file ? { file: reason.file } : {}),
    ...(reason.issueId ? { issueId: reason.issueId } : {}),
    ...(reason.tool ? { tool: reason.tool } : {}),
  };
}

function filesFromReasons(reasons: PreflightReason[]): string[] {
  return unique(
    reasons.map((reason) => reason.file).filter((file): file is string => typeof file === 'string'),
  );
}

function filesFromEvidence(evidence: WorkplanEvidence[]): string[] {
  return unique(
    evidence.map((item) => item.file).filter((file): file is string => typeof file === 'string'),
  );
}

function buildTopRisks(
  reasons: PreflightReason[],
  conflicts: SessionConflict[],
  extraRisks: WorkplanTopRisk[] = [],
): WorkplanTopRisk[] {
  const reasonRisks = reasons.map((reason) => ({
    ...reasonToEvidence(reason),
    priority: reason.severity === 'error' ? ('p0' as const) : ('p1' as const),
  }));
  const conflictRisks = conflicts.map((conflict) => ({
    source: 'coordination' as const,
    message: conflict.message,
    severity: conflict.severity,
    file: conflict.files[0],
    priority: conflict.severity === 'error' ? ('p0' as const) : ('p1' as const),
  }));
  const seen = new Set<string>();
  return [...reasonRisks, ...conflictRisks, ...extraRisks]
    .map((risk, index) => ({ risk, index }))
    .filter((entry) => {
      const { risk } = entry;
      const key = `${risk.source}:${risk.file ?? ''}:${risk.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const priority = priorityRank(a.risk.priority) - priorityRank(b.risk.priority);
      if (priority !== 0) return priority;
      return a.index - b.index;
    })
    .map((entry) => entry.risk)
    .slice(0, MAX_TOP_RISKS);
}

function annotateTasksWithOwners(
  tasks: WorkplanTask[],
  ownership: OwnershipLookup | undefined,
): WorkplanTask[] {
  if (!ownership) return tasks;
  return tasks.map((task) => {
    const owner = ownerForTask(task, ownership);
    if (!owner) return task;
    return {
      ...task,
      owner,
      handoffText: compact(`${task.handoffText} Owner: ${owner}.`, HANDOFF_LIMIT),
    };
  });
}

function annotateTopRisksWithOwners(
  risks: WorkplanTopRisk[],
  ownership: OwnershipLookup | undefined,
): WorkplanTopRisk[] {
  if (!ownership) return risks;
  return risks.map((risk) => {
    const owner = ownerForFiles(
      [risk.file].filter((file): file is string => typeof file === 'string'),
      ownership,
    );
    return owner ? { ...risk, owner } : risk;
  });
}

function ownerForTask(task: WorkplanTask, ownership: OwnershipLookup): string | undefined {
  const evidenceFiles = task.evidence
    .map((item) => item.file)
    .filter((file): file is string => typeof file === 'string' && file.length > 0);
  return ownerForFiles([...task.files, ...evidenceFiles], ownership);
}

function ownerForFiles(files: string[], ownership: OwnershipLookup): string | undefined {
  for (const file of unique(files)) {
    const owner = ownership(file);
    if (owner) return owner;
  }
  return undefined;
}

function summarizeWorkplan(
  mode: WorkplanMode,
  verdict: PreflightVerdict,
  tasks: WorkplanTask[],
  risks: WorkplanTopRisk[],
): string {
  if (tasks.length === 0) return `${verdict}: ${mode} workplan has no recommended tasks`;
  const riskText = risks.length > 0 ? `${risks.length} top risk(s)` : 'no top risks';
  return `${verdict}: ${mode} workplan has ${tasks.length} task(s), starting with ${tasks[0]?.title}; ${riskText}`;
}

function taskToSuggestedActions(task: WorkplanTask): PreflightSuggestedAction[] {
  return task.suggestedTools.slice(0, 3).flatMap((tool) => {
    const command = commandForSuggestedTool(tool, task);
    if (!command) return [];
    return [
      {
        label: `Use ${tool} for ${task.title}`,
        tool: tool.startsWith('projscan_') ? tool : undefined,
        command,
      },
    ];
  });
}

function commandForSuggestedTool(tool: string, task: WorkplanTask): string | undefined {
  if (!tool.startsWith('projscan_')) return task.verification.commands[0];
  if (tool === 'projscan_file' && task.files[0]) {
    return `projscan file "${escapeDoubleQuoted(task.files[0])}" --format json`;
  }
  const prefix = `projscan ${tool.slice('projscan_'.length).replace(/_/g, '-')}`;
  return task.verification.commands.find((command) => command.startsWith(prefix));
}

function dedupeActions(actions: PreflightSuggestedAction[]): PreflightSuggestedAction[] {
  const seen = new Set<string>();
  const out: PreflightSuggestedAction[] = [];
  for (const action of actions) {
    const key = `${action.label}:${action.command ?? ''}:${action.tool ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(action);
  }
  return out.slice(0, 12);
}

function normalizeMaxTasks(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MAX_TASKS;
  return Math.max(1, Math.min(20, Math.floor(value)));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function compact(value: string, maxLength: number): string {
  const oneLine = value.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= maxLength) return oneLine;
  return `${oneLine.slice(0, maxLength - 3).trimEnd()}...`;
}
