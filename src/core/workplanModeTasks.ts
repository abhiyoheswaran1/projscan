import type {
  PreflightVerdict,
  WorkplanEvidence,
  WorkplanMode,
  WorkplanPriority,
  WorkplanTask,
} from '../types.js';

const HANDOFF_LIMIT = 320;

export function modeTasks(
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
        priority: 'p1',
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

function filesFromEvidence(evidence: WorkplanEvidence[]): string[] {
  return unique(
    evidence.map((item) => item.file).filter((file): file is string => typeof file === 'string'),
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function compact(value: string, maxLength: number): string {
  const oneLine = value.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= maxLength) return oneLine;
  return `${oneLine.slice(0, maxLength - 3).trimEnd()}...`;
}
