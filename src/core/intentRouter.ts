/**
 * Intent router (4.x agent-ergonomics, epic 4).
 *
 * projscan exposes 40+ MCP tools. An agent shouldn't have to reason over all of
 * them every turn — it should be able to state a goal and get pointed at the one
 * right tool. `routeIntent` does exactly that: a deterministic, curated map from
 * common agent intents to the tool + exact call. No LLM (projscan never embeds
 * inference); ranking is keyword overlap against a hand-curated catalog.
 *
 * This is the additive, non-breaking half of the epic — a discovery entry point.
 * Actually shrinking the advertised tool surface (hiding the long tail behind
 * this router) is a breaking change reserved for 4.0.
 */

export interface RouteEntry {
  /** Short intent label. */
  intent: string;
  category: string;
  tool: string;
  cli: string;
  /** What the tool does, one line. */
  what: string;
  /** When to reach for it. */
  why: string;
  /** A runnable example. */
  example: string;
  /** Terms that signal this intent. */
  keywords: string[];
}

export interface RouteResult {
  intent: string | null;
  matched: boolean;
  matches: RouteEntry[];
}

export const ROUTE_CATALOG: RouteEntry[] = [
  {
    intent: 'Understand a repo before editing',
    category: 'Understand',
    tool: 'projscan_understand',
    cli: 'projscan understand',
    what: 'Cited repo/flow/contract/change/verify maps.',
    why: 'Orient in an unfamiliar codebase before making a change.',
    example: 'projscan understand --view map --format json',
    keywords: ['understand', 'orient', 'overview', 'map', 'comprehend', 'unfamiliar', 'learn', 'explore', 'architecture'],
  },
  {
    intent: 'Review a PR or a set of changes',
    category: 'Review',
    tool: 'projscan_review',
    cli: 'projscan review',
    what: 'One-call structural PR review with a verdict.',
    why: 'Assess risk of a diff: cycles, taint, dataflow, contracts.',
    example: 'projscan review --format json',
    keywords: ['review', 'pr', 'pull', 'request', 'diff', 'changes', 'verdict', 'assess'],
  },
  {
    intent: 'See what breaks if I change something',
    category: 'Impact',
    tool: 'projscan_impact',
    cli: 'projscan impact',
    what: 'Transitive blast radius for a file or symbol.',
    why: 'Before renaming or deleting, see every caller that breaks.',
    example: 'projscan impact --symbol buildCodeGraph --format json',
    keywords: ['impact', 'breaks', 'break', 'blast', 'radius', 'rename', 'delete', 'depends', 'affect', 'callers', 'breaking'],
  },
  {
    intent: 'Check if it is safe to edit / commit / merge',
    category: 'Safety gate',
    tool: 'projscan_preflight',
    cli: 'projscan preflight',
    what: 'proceed / caution / block verdict with evidence.',
    why: 'A safety gate before an edit, commit, or merge.',
    example: 'projscan preflight --mode before_commit --format json',
    keywords: ['safe', 'safety', 'gate', 'commit', 'merge', 'edit', 'proceed', 'block', 'preflight', 'allowed', 'risky'],
  },
  {
    intent: 'Find the riskiest files / where to start',
    category: 'Hotspots',
    tool: 'projscan_hotspots',
    cli: 'projscan hotspots',
    what: 'Files ranked by churn × complexity × issues.',
    why: 'Decide where to focus review or refactoring.',
    example: 'projscan hotspots --format json',
    keywords: ['hotspot', 'risky', 'riskiest', 'where', 'start', 'focus', 'churn', 'complexity', 'dangerous'],
  },
  {
    intent: 'Detect conflicts between parallel agents',
    category: 'Swarm coordination',
    tool: 'projscan_collision',
    cli: 'projscan collisions',
    what: 'Same-file + dependency overlaps across worktrees.',
    why: 'Two agents editing one repo: surface collisions pre-merge.',
    example: 'projscan collisions --format json',
    keywords: ['coordinate', 'coordination', 'parallel', 'agents', 'swarm', 'conflict', 'conflicts', 'collision', 'worktree', 'worktrees', 'overlap', 'simultaneous'],
  },
  {
    intent: 'Claim a file so other agents know who owns it',
    category: 'Swarm coordination',
    tool: 'projscan_claim',
    cli: 'projscan claim',
    what: 'Advisory claims/leases over files, dirs, symbols.',
    why: 'Tell the swarm who is working where; warn on contention.',
    example: 'projscan claim add src/auth.ts --agent me',
    keywords: ['claim', 'lease', 'owns', 'ownership', 'who', 'reserve', 'lock', 'coordinate', 'parallel', 'agents', 'swarm'],
  },
  {
    intent: 'Decide the order to merge in-flight branches',
    category: 'Swarm coordination',
    tool: 'projscan_merge_risk',
    cli: 'projscan merge-risk',
    what: 'Safe integration order + conflict hotspots.',
    why: 'Multiple in-flight worktrees: which to merge first.',
    example: 'projscan merge-risk --format json',
    keywords: ['merge', 'integrate', 'integration', 'order', 'sequence', 'first', 'conflict', 'hotspot', 'coordinate', 'parallel', 'swarm'],
  },
  {
    intent: 'Run a project health check',
    category: 'Health',
    tool: 'projscan_doctor',
    cli: 'projscan doctor',
    what: 'Health score + detected issues.',
    why: 'A quick overall health read on a repo.',
    example: 'projscan doctor --format json',
    keywords: ['health', 'doctor', 'score', 'issues', 'check', 'quality', 'lint'],
  },
  {
    intent: 'Search the codebase',
    category: 'Search',
    tool: 'projscan_search',
    cli: 'projscan search',
    what: 'Symbol / file / content search (BM25 + optional semantic).',
    why: 'Find where something is defined or used.',
    example: 'projscan search "auth token" --format json',
    keywords: ['search', 'find', 'locate', 'where', 'grep', 'lookup', 'symbol'],
  },
  {
    intent: 'Trace dataflow / find injection risk',
    category: 'Security',
    tool: 'projscan_dataflow',
    cli: 'projscan dataflow',
    what: 'Source-to-sink dataflow risks.',
    why: 'Spot request-data reaching dangerous sinks.',
    example: 'projscan dataflow --format json',
    keywords: ['dataflow', 'taint', 'security', 'injection', 'source', 'sink', 'vulnerability', 'sql', 'xss'],
  },
  {
    intent: 'Get a fix for an issue',
    category: 'Fix',
    tool: 'projscan_fix_suggest',
    cli: 'projscan fix-suggest',
    what: 'Structured action prompt for an open issue.',
    why: 'Turn a detected issue into a concrete fix plan.',
    example: 'projscan fix-suggest <issue-id> --format json',
    keywords: ['fix', 'suggest', 'resolve', 'repair', 'remediate', 'how', 'issue'],
  },
  {
    intent: 'Orient on first use / set up projscan',
    category: 'Onboarding',
    tool: 'projscan_start',
    cli: 'projscan start',
    what: 'First-60-seconds orientation + next commands.',
    why: 'New to this repo or to projscan.',
    example: 'projscan start --format json',
    keywords: ['start', 'begin', 'setup', 'onboard', 'first', 'getting', 'started', 'new'],
  },
  {
    intent: 'Plan the next agent work',
    category: 'Agent planning',
    tool: 'projscan_workplan',
    cli: 'projscan workplan',
    what: 'Ordered agent execution plan with verification.',
    why: 'Turn evidence into prioritized, verifiable tasks.',
    example: 'projscan workplan --mode bug_hunt --format json',
    keywords: ['plan', 'workplan', 'tasks', 'next', 'todo', 'prioritize', 'roadmap'],
  },
  {
    intent: 'Find bugs to fix',
    category: 'Agent planning',
    tool: 'projscan_bug_hunt',
    cli: 'projscan bug-hunt',
    what: 'Ranked fix queue from doctor/preflight/hotspots.',
    why: 'Decide which bugs to tackle first.',
    example: 'projscan bug-hunt --format json',
    keywords: ['bug', 'bugs', 'hunt', 'queue', 'defect', 'broken'],
  },
  {
    intent: 'Check dependency health / outdated / audit',
    category: 'Dependencies',
    tool: 'projscan_outdated',
    cli: 'projscan outdated',
    what: 'Outdated deps, audit, and upgrade preview.',
    why: 'Assess dependency freshness and vulnerabilities.',
    example: 'projscan outdated --format json',
    keywords: ['dependency', 'dependencies', 'outdated', 'audit', 'upgrade', 'vulnerable', 'package', 'npm'],
  },
];

const STOPWORDS = new Set([
  'the', 'a', 'an', 'i', 'to', 'my', 'is', 'it', 'of', 'in', 'on', 'and', 'or', 'for', 'this', 'that',
  'do', 'how', 'what', 'me', 'we', 'with', 'can', 'should', 'if', 'be', 'am', 'are',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Map a stated intent to the best-matching projscan tool(s). With no intent,
 * returns the full catalog grouped by category. Ranking is keyword overlap;
 * ties keep catalog order (deterministic).
 */
export function routeIntent(intent: string | undefined): RouteResult {
  if (!intent || intent.trim() === '') {
    const grouped = [...ROUTE_CATALOG].sort((a, b) => a.category.localeCompare(b.category));
    return { intent: null, matched: grouped.length > 0, matches: grouped };
  }

  const tokens = new Set(tokenize(intent));
  const scored = ROUTE_CATALOG.map((entry, index) => {
    let score = 0;
    for (const kw of entry.keywords) {
      if (tokens.has(kw)) score += 1;
    }
    return { entry, score, index };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return {
    intent,
    matched: scored.length > 0,
    matches: scored.map((s) => s.entry),
  };
}
