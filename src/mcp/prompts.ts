import type { McpPromptDefinition } from '../types.js';
import { scanRepository } from '../core/repositoryScanner.js';
import { collectIssues } from '../core/issueEngine.js';
import { analyzeHotspots } from '../core/hotspotAnalyzer.js';
import { inspectFile } from '../core/fileInspector.js';
import { calculateScore } from '../utils/scoreCalculator.js';
import { buildCodeGraph } from '../core/codeGraph.js';
import { computeImpact } from '../core/impact.js';
import { computeReview } from '../core/review.js';
import { findStableRules, loadMemory } from '../core/memory.js';

export interface McpPromptMessage {
  role: 'user' | 'assistant' | 'system';
  content: { type: 'text'; text: string };
}

export interface McpPromptResult {
  description: string;
  messages: McpPromptMessage[];
}

const promptDefinitions: McpPromptDefinition[] = [
  {
    name: 'prioritize_refactoring',
    description:
      "Produce a ranked refactoring plan grounded in this project's current churn-weighted hotspots and open health issues.",
    arguments: [
      {
        name: 'limit',
        description: 'How many hotspots to include (default: 10)',
        required: false,
      },
    ],
  },
  {
    name: 'investigate_file',
    description:
      "Produce a senior-engineer investigation of a specific file, grounded in its churn, ownership, related issues, and structure.",
    arguments: [
      {
        name: 'file',
        description: 'Path to the file (relative to project root)',
        required: true,
      },
    ],
  },
  {
    name: 'refactor_hotspot',
    description:
      'Concrete refactor plan for one specific hotspot file. Pulls the file detail (purpose, risk score, ownership, per-function CC, related issues) and the project-level health context, then asks for a step-by-step refactor with risk acknowledgement.',
    arguments: [
      { name: 'file', description: 'Path to the hotspot file (relative to project root)', required: true },
    ],
  },
  {
    name: 'triage_doctor_issues',
    description:
      'Order the open health issues by what to fix first. Groups by severity and category, surfaces score impact, and asks for an "in this order, here is why" plan.',
    arguments: [
      {
        name: 'severity',
        description: 'Optional. Restrict to "error" / "warning" / "info" / "all" (default: all).',
        required: false,
      },
    ],
  },
  {
    name: 'review_this_pr',
    description:
      'Step-by-step PR review primed with the structural diff, per-file risk, new cycles, risky function additions, and the verdict from projscan_review. Asks the agent to produce a code-review comment in priority order.',
    arguments: [
      { name: 'base', description: 'Base ref. Default: origin/main.', required: false },
      { name: 'head', description: 'Head ref. Default: HEAD.', required: false },
      { name: 'package', description: 'Optional. Workspace package name to scope the review.', required: false },
    ],
  },
  {
    name: 'safely_rename_symbol',
    description:
      'A safe-rename plan for an exported symbol. Pulls the symbol\'s definition site(s), every direct caller, and the transitive blast radius via projscan_impact, then asks for an ordered rename + verification checklist.',
    arguments: [
      { name: 'symbol', description: 'The exported symbol name to rename.', required: true },
      { name: 'to', description: 'Optional. The new name (used in the generated plan).', required: false },
    ],
  },
  {
    name: 'quiet_the_doctor',
    description:
      'Propose silencing rules that have been open across many doctor runs without being addressed. Reads Project Memory\'s stable-rule list, frames the .projscanrc snippet, asks the agent to commit it (with a per-rule rationale).',
    arguments: [],
  },
];

export function getPromptDefinitions(): McpPromptDefinition[] {
  return promptDefinitions;
}

export async function getPrompt(
  name: string,
  args: Record<string, unknown>,
  rootPath: string,
): Promise<McpPromptResult> {
  switch (name) {
    case 'prioritize_refactoring':
      return await prioritizeRefactoringPrompt(args, rootPath);
    case 'investigate_file':
      return await investigateFilePrompt(args, rootPath);
    case 'refactor_hotspot':
      return await refactorHotspotPrompt(args, rootPath);
    case 'triage_doctor_issues':
      return await triageDoctorIssuesPrompt(args, rootPath);
    case 'review_this_pr':
      return await reviewThisPrPrompt(args, rootPath);
    case 'safely_rename_symbol':
      return await safelyRenameSymbolPrompt(args, rootPath);
    case 'quiet_the_doctor':
      return await quietTheDoctorPrompt(rootPath);
    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}

async function prioritizeRefactoringPrompt(
  args: Record<string, unknown>,
  rootPath: string,
): Promise<McpPromptResult> {
  const limit = coerceLimit(args.limit, 10);
  const scan = await scanRepository(rootPath);
  const issues = await collectIssues(rootPath, scan.files);
  const hotspots = await analyzeHotspots(rootPath, scan.files, issues, { limit });
  const { score, grade } = calculateScore(issues);

  const hotspotLines = hotspots.available && hotspots.hotspots.length > 0
    ? hotspots.hotspots
        .map((h, i) => {
          const reasons = h.reasons.length > 0 ? h.reasons.join(', ') : 'ranked by risk';
          const ownership = h.busFactorOne && h.primaryAuthor
            ? ` [BUS FACTOR 1: ${h.primaryAuthor}]`
            : '';
          return `${i + 1}. ${h.relativePath} - risk ${h.riskScore.toFixed(1)} (${reasons})${ownership}`;
        })
        .join('\n')
    : '(no hotspots available - project may not be a git repository)';

  const topIssues = issues
    .slice(0, 15)
    .map((issue) => `- [${issue.severity}] ${issue.title}`)
    .join('\n');

  const text = [
    'You are a senior engineer reviewing a codebase. Produce a concrete, prioritized refactoring plan.',
    '',
    `Current health: ${grade} (${score}/100). Issues: ${issues.length}.`,
    '',
    'Top hotspots (ranked by churn × complexity × open issues × recency):',
    hotspotLines,
    '',
    'Top health issues:',
    topIssues || '(none)',
    '',
    'For each of the top 3 hotspots, output:',
    '1. Why it is risky (in one sentence, citing the evidence above)',
    '2. A specific refactoring or investigation action',
    '3. Estimated effort (S / M / L)',
    '',
    'Then propose an ordering that maximizes risk reduction per unit of effort.',
  ].join('\n');

  return {
    description: 'Prioritized refactoring plan grounded in live project data',
    messages: [
      { role: 'user', content: { type: 'text', text } },
    ],
  };
}

async function investigateFilePrompt(
  args: Record<string, unknown>,
  rootPath: string,
): Promise<McpPromptResult> {
  const file = typeof args.file === 'string' ? args.file : '';
  if (!file) throw new Error('investigate_file requires a "file" argument');

  const insp = await inspectFile(rootPath, file);
  const body = JSON.stringify(insp, null, 2);
  const text = [
    `You are a senior engineer investigating \`${file}\`.`,
    '',
    "Here is the file report from projscan (purpose, risk score, ownership, related health issues, imports, exports):",
    '',
    '```json',
    body,
    '```',
    '',
    'Explain in order:',
    '1. What this file does and how it fits in the codebase.',
    '2. What is risky about it right now (cite evidence from the report).',
    '3. Concrete next actions - questions to ask, tests to add, or refactors to attempt.',
    '4. Who to involve (based on ownership, if available).',
  ].join('\n');

  return {
    description: `Investigation brief for ${file}`,
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}

function coerceLimit(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.min(100, Math.floor(value)));
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) return Math.max(1, Math.min(100, parsed));
  }
  return fallback;
}

async function refactorHotspotPrompt(
  args: Record<string, unknown>,
  rootPath: string,
): Promise<McpPromptResult> {
  const file = typeof args.file === 'string' ? args.file : '';
  if (!file) throw new Error('refactor_hotspot requires a "file" argument');

  const insp = await inspectFile(rootPath, file);
  const fileBody = JSON.stringify(insp, null, 2);

  const text = [
    `You are a senior engineer producing a concrete refactor plan for \`${file}\`.`,
    '',
    'Live projscan report on this file (purpose, risk score, ownership, per-function CC, related issues):',
    '',
    '```json',
    fileBody,
    '```',
    '',
    'Output a step-by-step refactor plan with the following sections:',
    '',
    '1. **Why this file is risky now** — cite the evidence above (CC, churn, fan-in/out, ownership).',
    '2. **Refactor strategy** — the high-level move (e.g. extract module, split god-function, invert dependency).',
    '3. **Step-by-step changes** — ordered, each step independently shippable.',
    '4. **Test coverage gaps to close before / during the refactor.**',
    '5. **Risk acknowledgement** — what could break, who to coordinate with (if `busFactorOne` is set in the report, name the primary author).',
    '6. **Estimated effort** (S / M / L) and verification checklist.',
    '',
    'Be specific. Reference actual function names from the per-function CC table. Do not propose generic "add tests" without naming what to test.',
  ].join('\n');

  return {
    description: `Refactor plan for ${file}`,
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}

async function triageDoctorIssuesPrompt(
  args: Record<string, unknown>,
  rootPath: string,
): Promise<McpPromptResult> {
  const rawSeverity = typeof args.severity === 'string' ? args.severity.toLowerCase() : 'all';
  const severity = ['error', 'warning', 'info'].includes(rawSeverity) ? rawSeverity : 'all';
  const scan = await scanRepository(rootPath);
  const issues = await collectIssues(rootPath, scan.files);
  const { score, grade } = calculateScore(issues);

  const filtered = severity === 'all' ? issues : issues.filter((i) => i.severity === severity);

  // Group by category for the agent's quick read.
  const byCategory: Record<string, typeof filtered> = {};
  for (const issue of filtered) {
    const key = issue.category ?? 'other';
    (byCategory[key] ||= []).push(issue);
  }

  const grouped = Object.entries(byCategory)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([cat, list]) => {
      const top = list
        .slice(0, 8)
        .map((i) => `  - [${i.severity}] ${i.title}${i.id ? ` (id: ${i.id})` : ''}`)
        .join('\n');
      return `### ${cat} (${list.length})\n${top}${list.length > 8 ? `\n  - … and ${list.length - 8} more` : ''}`;
    })
    .join('\n\n');

  const text = [
    'You are triaging the open health issues from projscan. Produce a fix-this-first plan.',
    '',
    `Project health: **${grade} (${score}/100)**.`,
    `Total issues${severity !== 'all' ? ` (severity=${severity})` : ''}: **${filtered.length}**.`,
    '',
    'Issues grouped by category:',
    '',
    grouped || '(no issues at this severity)',
    '',
    'Output a triage plan in this exact shape:',
    '',
    '1. **Critical (fix this week)** — list issues that block correctness, security, or shipping. For each: issue id (if any), why it\'s critical, the projscan_fix_suggest call to invoke.',
    '2. **Important (fix this sprint)** — issues that meaningfully reduce risk but aren\'t blockers.',
    '3. **Backlog** — defer-able with rationale (e.g. "low signal, will be fixed by an upcoming refactor").',
    '4. **Score impact** — estimate how many points the project would gain by clearing items 1-2.',
    '',
    'For each item, the next-action MUST be a concrete projscan tool call (`projscan_fix_suggest <issue_id>`, `projscan_explain_issue <issue_id>`, or a code change scoped to a specific file).',
  ].join('\n');

  return {
    description: 'Triage plan for current open health issues',
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}

async function reviewThisPrPrompt(
  args: Record<string, unknown>,
  rootPath: string,
): Promise<McpPromptResult> {
  const base = typeof args.base === 'string' ? args.base : undefined;
  const head = typeof args.head === 'string' ? args.head : undefined;
  const pkg = typeof args.package === 'string' ? args.package : undefined;

  const review = await computeReview(rootPath, { base, head });
  const reviewBody = JSON.stringify(
    {
      verdict: review.verdict,
      summary: review.summary,
      base: review.base,
      head: review.head,
      filesChanged: review.changedFiles.length,
      topChangedFiles: review.changedFiles.slice(0, 6),
      newCycles: review.newCycles.slice(0, 3),
      riskyFunctions: review.riskyFunctions.slice(0, 5),
      dependencyChanges: review.dependencyChanges.slice(0, 5),
      newTaintFlows: review.newTaintFlows.slice(0, 5),
      ...(pkg ? { scopedToPackage: pkg } : {}),
    },
    null,
    2,
  );

  const text = [
    'You are doing a code review on a pull request. projscan has already analyzed the structural diff.',
    '',
    'Live PR review report:',
    '',
    '```json',
    reviewBody,
    '```',
    '',
    'Produce a PR-comment-ready review in this order:',
    '',
    '1. **Verdict line** — restate projscan\'s verdict and whether you concur after looking at the structural data.',
    '2. **Security: NEW taint flows** — if `newTaintFlows` is non-empty, this is the lead concern. Name each flow (`source → sink` in `sourceFn`), say what an attacker would need to exploit it, and demand the author either neutralize it or justify why the source is trusted. A new taint flow is presumed `request-changes` unless the author closes the loop.',
    '3. **Must-look-at** — the highest-risk file(s) from `topChangedFiles` and `riskyFunctions`. For each: one sentence on why, and a concrete question to ask the author.',
    '4. **Cycle / coupling concerns** — if `newCycles` is non-empty, name each and propose how to break or document it.',
    '5. **Dependency concerns** — call out anything in `dependencyChanges` that warrants a closer look (major bumps, new deps with unclear purpose).',
    '6. **Approval recommendation** — `approve` / `request-changes` / `comment` with rationale.',
    '',
    'Stay grounded in the data above. Do not speculate about code you can\'t see; if you need to inspect a file, request `projscan_file <path>` for it.',
  ].join('\n');

  return {
    description: `PR review brief (${review.base.ref} → ${review.head.ref})`,
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}

async function safelyRenameSymbolPrompt(
  args: Record<string, unknown>,
  rootPath: string,
): Promise<McpPromptResult> {
  const symbol = typeof args.symbol === 'string' ? args.symbol : '';
  if (!symbol) throw new Error('safely_rename_symbol requires a "symbol" argument');
  const newName = typeof args.to === 'string' && args.to.length > 0 ? args.to : null;

  const scan = await scanRepository(rootPath);
  const graph = await buildCodeGraph(rootPath, scan.files);
  const impact = computeImpact(graph, { kind: 'symbol', value: symbol });

  const impactBody = JSON.stringify(
    {
      symbol,
      newName,
      available: impact.available,
      reason: impact.reason,
      definitionFiles: impact.definitionFiles,
      directCallers: impact.directCallers,
      reachableCount: impact.totalReachable,
      reachableSample: impact.reachable.slice(0, 12),
      truncated: impact.truncated,
    },
    null,
    2,
  );

  const renameDirective = newName
    ? `Rename \`${symbol}\` → \`${newName}\` safely.`
    : `Rename \`${symbol}\` safely (caller will tell you the new name).`;

  const text = [
    `You are producing a safe-rename plan for the exported symbol \`${symbol}\`.`,
    '',
    renameDirective,
    '',
    'Blast-radius report from projscan_impact (symbol mode):',
    '',
    '```json',
    impactBody,
    '```',
    '',
    'Output an ordered checklist that minimizes risk:',
    '',
    `1. **Definition-site change** — name the file(s) under \`definitionFiles\` and the exact rename to make there (export name, JSDoc, types).`,
    '2. **Direct-caller updates** — for each file in `directCallers`, list the import / call-site changes required.',
    '3. **Re-export sweep** — barrel files (`index.ts`, `__init__.py`) that may re-export the old name.',
    '4. **Test updates** — every test file under `directCallers` and any explicit string match on the old symbol name.',
    '5. **Verification** — the smallest test suite or manual check that confirms no caller is broken.',
    '6. **Backout plan** — what to do if a transitive caller surfaces post-merge.',
    '',
    'Sequence the steps so each one is independently committable. If `truncated: true` appears, recommend a follow-up `projscan_impact` call with a higher `max_distance` before merging.',
  ].join('\n');

  return {
    description: `Safe-rename plan for ${symbol}${newName ? ` → ${newName}` : ''}`,
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}

async function quietTheDoctorPrompt(rootPath: string): Promise<McpPromptResult> {
  const memory = await loadMemory(rootPath);
  const stable = findStableRules(memory);

  if (stable.length === 0) {
    const text = [
      'You were asked to silence stable doctor rules in this project, but Project Memory has no candidates yet.',
      '',
      `Total runs recorded: **${memory.totalRuns}**.`,
      `Rules tracked: **${Object.keys(memory.rules).length}**.`,
      '',
      'A rule becomes "stable" after surfacing in ≥ 3 runs over ≥ 7 days without ever being fixed. None of the tracked rules meet that threshold yet — either the project is being actively cleaned, or memory needs more runs to accumulate signal.',
      '',
      'Tell the user there\'s nothing to silence and recommend running the doctor a few more times to build memory, OR proposing a sweep of the existing open issues if they\'re willing to work through them.',
    ].join('\n');
    return {
      description: 'No stable rules to silence (Project Memory has insufficient signal)',
      messages: [{ role: 'user', content: { type: 'text', text } }],
    };
  }

  const snippet = JSON.stringify({ disableRules: stable.map((r) => r.ruleId) }, null, 2);
  const detail = stable
    .map(
      (r) =>
        `- \`${r.ruleId}\` — surfaced ${r.runCount} times since ${r.firstSeenAt.slice(0, 10)} (last seen ${r.lastSeenAt.slice(0, 10)})`,
    )
    .join('\n');

  const text = [
    'You are silencing analyzer rules that this project has been carrying across many doctor runs without ever fixing — i.e. the user has implicitly accepted them. Project Memory tracked this; here\'s the recommendation.',
    '',
    `**${stable.length} stable rule${stable.length === 1 ? '' : 's'}** (across ${memory.totalRuns} runs):`,
    '',
    detail,
    '',
    'Suggested `.projscanrc.json` patch:',
    '',
    '```json',
    snippet,
    '```',
    '',
    'Output a PR-ready proposal in this exact shape:',
    '',
    `1. **Rationale per rule** — for each of the ${stable.length} rule${stable.length === 1 ? '' : 's'}, one sentence explaining what it flags and why silencing is appropriate (e.g. "this dependency is loaded via a build script, not an import"). Be specific to the rule id.`,
    '2. **The patch** — the exact `.projscanrc.json` change, merging cleanly with whatever \`disableRules\` already exists.',
    '3. **Verification** — one command the user can run after applying the patch to confirm the doctor is quieter (typically `projscan ci --min-score 90`).',
    '4. **Rollback note** — how to remove a single entry from `disableRules` if the user later wants the rule re-enabled.',
    '',
    'Tone: matter-of-fact. The user has already implicitly accepted these by not fixing them; you\'re documenting the acceptance, not advocating for it.',
  ].join('\n');

  return {
    description: `Quiet ${stable.length} stable rule${stable.length === 1 ? '' : 's'} via .projscanrc`,
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
