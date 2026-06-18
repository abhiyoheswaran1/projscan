import type { StartDailyWorkflow } from '../types/start.js';

export function buildStartDailyWorkflows(): StartDailyWorkflow[] {
  return [
    {
      id: 'before_edit',
      name: 'Before editing a feature',
      outcome: 'The agent starts with cited change context and a before-edit gate.',
      commands: [
        'projscan start --intent "what files do I need to change for auth?"',
        'projscan understand --view change --intent "add auth token refresh" --format json',
        'projscan preflight --mode before_edit --format json',
      ],
      successCriteria: [
        'Agent has cited change context before editing.',
        'Likely touched files and read-first context are explicit.',
        'Before-edit preflight is visible before code changes.',
      ],
    },
    {
      id: 'before_handoff',
      name: 'Before handoff or commit',
      outcome: 'The reviewer sees proof commands and separated fix/review gates.',
      commands: [
        'projscan bug-hunt --format json',
        'projscan preflight --mode before_commit --format json',
        'projscan evidence-pack --pr-comment',
      ],
      successCriteria: [
        'Concrete fix targets and manual review gates are separated.',
        'Reviewer-facing evidence includes exact proof commands.',
        'The handoff does not depend on reading an agent transcript.',
      ],
    },
    {
      id: 'release_candidate_review',
      name: 'Release-candidate review',
      outcome: 'Release-readiness stays read-only and separates fixes from sign-off.',
      commands: [
        'projscan release-train --format json',
        'projscan preflight --mode before_merge --format json',
        'projscan evidence-pack --pr-comment',
      ],
      successCriteria: [
        'Release-readiness output stays read-only.',
        'Caution output explains whether fixes or manual sign-off are needed.',
        'No version, publish, tag, or deploy step is implied.',
      ],
    },
  ];
}
