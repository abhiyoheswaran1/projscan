import type {
  BugHuntFinding,
  Issue,
  SessionConflict,
  WorkplanPriority,
} from '../types.js';

export function issueToBugHuntFinding(issue: Issue): BugHuntFinding {
  const files = filesFromIssue(issue);
  return {
    id: `bh-issue-${issue.id}`,
    priority: severityPriority(issue.severity),
    source: 'doctor',
    title: issue.title,
    why: issue.description,
    files,
    evidence: [
      {
        source: 'doctor',
        severity: issue.severity,
        issueId: issue.id,
        message: issue.title,
        ...(files[0] ? { file: files[0] } : {}),
      },
    ],
    suggestedTools: issue.fixAvailable
      ? ['projscan_explain_issue', 'projscan_fix_suggest', 'projscan_apply_fix']
      : ['projscan_explain_issue', 'projscan_doctor'],
    verification: {
      commands: ['projscan doctor --format json', 'npm test'],
      expected: `Issue ${issue.id} no longer appears in projscan doctor and focused tests pass.`,
    },
  };
}

export function conflictToBugHuntFinding(
  conflict: SessionConflict,
  index: number,
): BugHuntFinding {
  return {
    id: `bh-session-${index + 1}`,
    priority: conflict.severity === 'error' ? 'p0' : 'p1',
    source: 'session',
    title: 'Resolve active coordination conflict',
    why: conflict.message,
    files: conflict.files,
    evidence: [
      {
        source: 'coordination',
        severity: conflict.severity,
        message: conflict.message,
        ...(conflict.files[0] ? { file: conflict.files[0] } : {}),
      },
    ],
    suggestedTools: ['projscan_session', 'projscan_workplan'],
    verification: {
      commands: ['projscan session touched --format json', 'projscan bug-hunt --format json'],
      expected: 'Touched-file overlap is understood and no coordination blocker remains.',
    },
  };
}

function filesFromIssue(issue: Issue): string[] {
  return [...new Set((issue.locations ?? []).map((location) => location.file).filter(Boolean))];
}

function severityPriority(severity: Issue['severity']): WorkplanPriority {
  if (severity === 'error') return 'p0';
  if (severity === 'warning') return 'p1';
  return 'p2';
}
