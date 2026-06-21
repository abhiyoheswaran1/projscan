const EVIDENCE_PACK_WEIGHT_ONE_KEYWORDS = new Set(['changed', 'file', 'files']);

const EVIDENCE_PACK_WEIGHT_TWO_KEYWORDS = new Set([
  'evidence',
  'proof',
  'approval',
  'approve',
  'comment',
  'summarize',
  'changes',
  'description',
  'draft',
  'say',
  'checklist',
  'tell',
  'team',
  'change',
  'share',
  'reviewer',
  'reviewers',
  'summary',
  'packet',
  'paste',
  'who',
  'review',
  'ready',
  'release',
  'readiness',
  'check',
  'publish',
  'publishing',
  'open',
  'opening',
  'before',
  'prepare',
  'owner',
  'owners',
  'owns',
  'routing',
]);

const RELEASE_TRAIN_WEIGHT_TWO_KEYWORDS = new Set([
  'releasing',
  'deploy',
  'deploying',
  'deployed',
  'deployment',
  'build',
  'next',
  'roadmap',
  'plan',
  'product',
  'products',
  'feature',
  'features',
  'workstream',
  'workstreams',
  'changed',
  'since',
  'last',
  'changelog',
  'note',
  'notes',
  'entry',
  'summarize',
  'summary',
]);

const BUG_HUNT_WEIGHT_TWO_KEYWORDS = new Set([
  'bug',
  'bugs',
  'hunt',
  'defect',
  'broken',
  'first',
  'fastest',
  'quickest',
  'quick',
  'smallest',
  'small',
  'low',
  'lowest',
  'improve',
  'improvement',
  'useful',
  'easy',
  'beginner',
  'starter',
  'intern',
  'interns',
  'task',
  'tasks',
  'five',
  'minutes',
  'today',
  'win',
  'wins',
]);

export function workflowKeywordWeight(tool: string, keyword: string): number | undefined {
  if (tool === 'projscan_evidence_pack') return evidencePackKeywordWeight(keyword);
  if (tool === 'projscan_release_train') return releaseTrainKeywordWeight(keyword);
  if (tool === 'projscan_bug_hunt') return bugHuntKeywordWeight(keyword);
  return undefined;
}

function evidencePackKeywordWeight(keyword: string): number | undefined {
  if (keyword === 'pr') return 0.25;
  if (EVIDENCE_PACK_WEIGHT_ONE_KEYWORDS.has(keyword)) return 1;
  if (EVIDENCE_PACK_WEIGHT_TWO_KEYWORDS.has(keyword)) return 2;
  return undefined;
}

function releaseTrainKeywordWeight(keyword: string): number | undefined {
  return RELEASE_TRAIN_WEIGHT_TWO_KEYWORDS.has(keyword) ? 2 : undefined;
}

function bugHuntKeywordWeight(keyword: string): number | undefined {
  if (BUG_HUNT_WEIGHT_TWO_KEYWORDS.has(keyword)) return 2;
  if (['find', 'fix', 'pr'].includes(keyword)) return 0.25;
  return undefined;
}
