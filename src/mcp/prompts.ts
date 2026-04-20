import type { McpPromptDefinition } from '../types.js';
import { scanRepository } from '../core/repositoryScanner.js';
import { collectIssues } from '../core/issueEngine.js';
import { analyzeHotspots } from '../core/hotspotAnalyzer.js';
import { inspectFile } from '../core/fileInspector.js';
import { calculateScore } from '../utils/scoreCalculator.js';

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
