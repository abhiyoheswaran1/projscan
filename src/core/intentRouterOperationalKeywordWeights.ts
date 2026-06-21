import { isPrDiffKeyword } from './intentRouterPrDiffKeywords.js';

const AGENT_BRIEF_WEIGHT_TWO_KEYWORDS = new Set(['brief', 'handoff', 'agent']);

const SESSION_WEIGHT_TWO_KEYWORDS = new Set([
  'session',
  'touched',
  'touch',
  'resume',
  'leave',
  'left',
  'off',
  'agent',
  'asleep',
  'slept',
  'away',
  'offline',
  'changed',
  'events',
  'history',
]);

const QUALITY_SCORECARD_WEIGHT_TWO_KEYWORDS = new Set([
  'quality',
  'scorecard',
  'risk',
  'risks',
  'risky',
  'picture',
]);

const HOTSPOT_WEIGHT_TWO_KEYWORDS = new Set([
  'files',
  'file',
  'touch',
  'complexity',
  'complex',
  'refactor',
  'refactoring',
  'simplify',
  'simplification',
  'tech',
  'debt',
  'duplicate',
  'duplicated',
  'duplication',
  'over',
  'engineered',
  'performance',
  'perf',
  'bottleneck',
  'bottlenecks',
  'optimize',
  'optimise',
  'faster',
  'slow',
]);

const COORDINATE_WEIGHT_TWO_KEYWORDS = new Set([
  'who',
  'else',
  'working',
  'editing',
  'coordinate',
  'coordination',
  'status',
  'readiness',
  'parallel',
  'agents',
  'agent',
  'collide',
  'colliding',
  'swarm',
  'conflict',
  'conflicts',
  'conflicting',
  'conflicted',
  'active',
]);

const PREFLIGHT_WEIGHT_TWO_KEYWORDS = new Set([
  'ready',
  'block',
  'blocked',
  'blocker',
  'blockers',
  'blocking',
  'risk',
  'risks',
  'rebase',
  'rebasing',
  'conflict',
  'conflicts',
  'resolve',
  'resolving',
  'wrong',
  'stuck',
]);

const CLAIM_WEIGHT_TWO_KEYWORDS = new Set(['claim', 'claims', 'lease', 'leases', 'reserve', 'lock']);

const ANALYZE_WEIGHT_THREE_KEYWORDS = new Set([
  'redact',
  'redacted',
  'redaction',
  'scoped',
  'scope',
]);

const ANALYZE_WEIGHT_TWO_KEYWORDS = new Set([
  'share',
  'shared',
  'shareable',
  'sharing',
  'evidence',
  'artifact',
  'artifacts',
  'export',
  'exports',
  'external',
  'partner',
  'vendor',
  'security',
  'paths',
  'report',
  'reports',
]);

const DOCTOR_WEIGHT_TWO_KEYWORDS = new Set(['dead', 'orphaned', 'delete', 'remove']);
const DOCTOR_WEIGHT_ONE_KEYWORDS = new Set(['safe', 'safely']);

const REVIEW_WEIGHT_TWO_KEYWORDS = new Set(['review', 'secure', 'security', 'risk', 'risks', 'risky']);

const PR_DIFF_WEIGHT_HALF_KEYWORDS = new Set(['since', 'branch', 'main', 'base', 'head']);

const COLLISION_WEIGHT_TWO_KEYWORDS = new Set(['collide', 'colliding']);

export function operationalKeywordWeight(tool: string, keyword: string): number | undefined {
  if (tool === 'projscan_agent_brief') return setWeight(AGENT_BRIEF_WEIGHT_TWO_KEYWORDS, keyword, 2);
  if (tool === 'projscan_session') return setWeight(SESSION_WEIGHT_TWO_KEYWORDS, keyword, 2);
  if (tool === 'projscan_quality_scorecard') {
    return setWeight(QUALITY_SCORECARD_WEIGHT_TWO_KEYWORDS, keyword, 2);
  }
  if (tool === 'projscan_hotspots') return setWeight(HOTSPOT_WEIGHT_TWO_KEYWORDS, keyword, 2);
  if (tool === 'projscan_coordinate') return setWeight(COORDINATE_WEIGHT_TWO_KEYWORDS, keyword, 2);
  if (tool === 'projscan_preflight') return setWeight(PREFLIGHT_WEIGHT_TWO_KEYWORDS, keyword, 2);
  if (tool === 'projscan_claim') return claimKeywordWeight(keyword);
  if (tool === 'projscan_analyze') return analyzeKeywordWeight(keyword);
  if (tool === 'projscan_doctor') return doctorKeywordWeight(keyword);
  if (tool === 'projscan_review') return reviewKeywordWeight(keyword);
  if (tool === 'projscan_pr_diff') return prDiffKeywordWeight(keyword);
  if (tool === 'projscan_collision') return collisionKeywordWeight(keyword);
  if (tool === 'projscan_merge_risk' && keyword === 'first') return 1;
  return undefined;
}

function setWeight(keywords: Set<string>, keyword: string, weight: number): number | undefined {
  return keywords.has(keyword) ? weight : undefined;
}

function claimKeywordWeight(keyword: string): number | undefined {
  if (keyword === 'active') return 0.5;
  if (CLAIM_WEIGHT_TWO_KEYWORDS.has(keyword)) return 2;
  return undefined;
}

function analyzeKeywordWeight(keyword: string): number | undefined {
  if (ANALYZE_WEIGHT_THREE_KEYWORDS.has(keyword)) return 3;
  if (ANALYZE_WEIGHT_TWO_KEYWORDS.has(keyword)) return 2;
  return undefined;
}

function doctorKeywordWeight(keyword: string): number | undefined {
  if (keyword === 'unused') return 3;
  if (DOCTOR_WEIGHT_TWO_KEYWORDS.has(keyword)) return 2;
  if (DOCTOR_WEIGHT_ONE_KEYWORDS.has(keyword)) return 1;
  return undefined;
}

function reviewKeywordWeight(keyword: string): number | undefined {
  if (keyword === 'pr') return 0.25;
  if (REVIEW_WEIGHT_TWO_KEYWORDS.has(keyword)) return 2;
  return undefined;
}

function prDiffKeywordWeight(keyword: string): number | undefined {
  if (keyword === 'pr') return 0.25;
  if (PR_DIFF_WEIGHT_HALF_KEYWORDS.has(keyword)) return 0.5;
  if (isPrDiffKeyword(keyword)) return 2;
  return undefined;
}

function collisionKeywordWeight(keyword: string): number | undefined {
  if (keyword === 'overlapping') return 3;
  if (COLLISION_WEIGHT_TWO_KEYWORDS.has(keyword)) return 2;
  return undefined;
}
