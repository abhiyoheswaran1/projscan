import type {
  DogfoodFeedbackResponse,
  FeedbackIntakeCategory,
  FeedbackIntakeConfidence,
  FeedbackIntakeReport,
} from '../types/dogfood.js';

export function classifyFeedbackIntakeText(
  rawText: string,
  schemaVersion: FeedbackIntakeReport['schemaVersion'],
): FeedbackIntakeReport {
  const text = rawText.trim();
  const lower = text.toLowerCase();
  const category = classifyCategory(lower);
  const signal = primarySignal(category, lower);
  const confidence = confidenceFor(category, lower);
  const taskTitle = taskTitleFor(category, signal);
  const suggestedCommand = commandFor(category, signal);
  const summary = summaryFor(category, signal);
  const agentloopTaskCommand = agentloopCommandFor(category, taskTitle, summary, suggestedCommand);

  return {
    schemaVersion,
    category,
    confidence,
    summary,
    evidence: evidenceFor(category, lower),
    taskTitle,
    suggestedCommand,
    nextCommand: agentloopTaskCommand,
    agentloopTaskCommand,
    followUpCommands: [agentloopTaskCommand, suggestedCommand],
    feedbackResponse: feedbackResponseFor(category, signal, summary),
  };
}

function classifyCategory(text: string): FeedbackIntakeCategory {
  if (
    /\b(?:npm|npx|install|installed|global|globally)\b/.test(text) &&
    /allow[- ]scripts?|install scripts?|node-gyp-build|tree-sitter/.test(text)
  ) {
    return 'install_warning';
  }
  if (
    /\bfalse[- ]positive\b|incorrectly flag|wrongly flag|flagged unused|reported unused|not actually unused/.test(
      text,
    )
  ) {
    return 'false_positive';
  }
  if (
    /\bcaution\b|\bwarning\b/.test(text) &&
    /noise|noisy|background|too many|low[- ]signal|spam/.test(text)
  ) {
    return 'noisy_caution';
  }
  if (
    /missing|not detected|not detect|does not detect|doesn't detect|should detect|misses/.test(
      text,
    ) &&
    /framework|next\.?js|app router|route handler|middleware|koa|hono|fastify|express|sveltekit|astro|remix|request source|ctx\.request/.test(
      text,
    )
  ) {
    return 'missing_framework_rule';
  }
  if (
    /docs|readme|output|wording|message|copy/.test(text) &&
    /confusing|unclear|bigger than|overclaim|overstate|sounds bigger|not demonstrated/.test(text)
  ) {
    return 'confusing_docs_output';
  }
  if (
    /feature breadth|breadth|too many features|feature[s]?.*without.*workflow|killer workflow|killer workflows|trusted daily|trust daily|daily workflow|daily workflows/.test(
      text,
    )
  ) {
    return 'workflow_focus';
  }
  if (/\buseful\b|saved .*minute|prevented|caught|helped|trusted|clear next/.test(text)) {
    return 'useful_signal';
  }
  return 'uncategorized';
}

function primarySignal(category: FeedbackIntakeCategory, text: string): string {
  if (category === 'false_positive') {
    if (/unused[- ]exports?/.test(text)) return 'unused-exports';
    if (/unused[- ]dependenc/.test(text)) return 'unused-dependencies';
    if (/dead[- ]code/.test(text)) return 'dead-code';
    if (/dataflow|taint|source-to-sink/.test(text)) return 'dataflow';
    return 'rule false positive';
  }
  if (category === 'missing_framework_rule') {
    if (/koa/.test(text)) return 'Koa';
    if (/hono/.test(text)) return 'Hono';
    if (/fastify/.test(text)) return 'Fastify';
    if (/express/.test(text)) return 'Express';
    if (/next\.?js|app router|middleware|route handler/.test(text)) return 'Next.js';
    if (/sveltekit/.test(text)) return 'SvelteKit';
    if (/astro/.test(text)) return 'Astro';
    if (/remix/.test(text)) return 'Remix';
    return 'framework request source';
  }
  if (category === 'install_warning') {
    if (/allow[- ]scripts?/.test(text)) return 'npm allow-scripts';
    if (/node-gyp-build|install scripts?/.test(text)) return 'native install scripts';
    if (/tree-sitter/.test(text)) return 'tree-sitter install warning';
    return 'npm install warning';
  }
  if (category === 'noisy_caution') return 'caution';
  if (category === 'confusing_docs_output') return 'docs/output';
  if (category === 'workflow_focus') return 'workflow focus';
  if (category === 'useful_signal') return 'useful workflow';
  return 'unclassified feedback';
}

function confidenceFor(category: FeedbackIntakeCategory, text: string): FeedbackIntakeConfidence {
  if (category === 'uncategorized') return 'low';
  const strongSignals = [
    /\bfalse[- ]positive\b/,
    /unused[- ]exports?/,
    /\bcaution\b.*(?:noise|noisy|background)|(?:noise|noisy|background).*\bcaution\b/,
    /allow[- ]scripts?|node-gyp-build|tree-sitter/,
    /ctx\.request|app router|route handler|middleware/,
    /feature breadth|killer workflows?|trust daily|daily workflows?/,
    /saved .*minute|prevented/,
  ];
  return strongSignals.some((pattern) => pattern.test(text)) ? 'high' : 'medium';
}

function taskTitleFor(category: FeedbackIntakeCategory, signal: string): string {
  switch (category) {
    case 'false_positive':
      return 'Fix false-positive feedback: ' + signal;
    case 'noisy_caution':
      return 'Reduce noisy caution output';
    case 'install_warning':
      return 'Fix install warning feedback: ' + signal;
    case 'missing_framework_rule':
      return 'Add missing framework rule: ' + signal;
    case 'confusing_docs_output':
      return 'Clarify confusing docs or output';
    case 'workflow_focus':
      return 'Focus feature breadth into trusted daily workflows';
    case 'useful_signal':
      return 'Preserve useful feedback signal';
    case 'uncategorized':
      return 'Triage unclassified feedback';
  }
}

function commandFor(category: FeedbackIntakeCategory, signal: string): string {
  if (category === 'false_positive' && signal === 'unused-exports') {
    return 'npm test -- tests/analyzers/deadCodeCheck.test.ts tests/core/importGraph.test.ts';
  }
  switch (category) {
    case 'false_positive':
      return 'npm test -- tests/analyzers tests/core/importGraph.test.ts';
    case 'noisy_caution':
      return 'npm test -- tests/core/preflight*.test.ts tests/core/releaseEvidence.test.ts';
    case 'install_warning':
      return 'npm test -- tests/integration/packSmokeTest.test.ts';
    case 'missing_framework_rule':
      return 'npm test -- tests/core/dataflow.test.ts tests/analyzers/securityCheck.test.ts';
    case 'confusing_docs_output':
      return 'npm test -- tests/docs tests/cli/startConsoleGuidance.test.ts';
    case 'workflow_focus':
      return 'npm test -- tests/core/start*.test.ts tests/docs/startRoutingDocs.test.ts';
    case 'useful_signal':
      return 'projscan feedback summary --file .projscan-feedback.json --format json';
    case 'uncategorized':
      return 'projscan feedback summary --file .projscan-feedback.json --format json';
  }
}

function summaryFor(category: FeedbackIntakeCategory, signal: string): string {
  switch (category) {
    case 'false_positive':
      return 'Classified as false-positive feedback for ' + signal + '.';
    case 'noisy_caution':
      return 'Classified as caution noise that should be ranked or grouped.';
    case 'install_warning':
      return 'Classified as setup/install warning feedback for ' + signal + '.';
    case 'missing_framework_rule':
      return 'Classified as missing framework coverage for ' + signal + '.';
    case 'confusing_docs_output':
      return 'Classified as confusing docs or output wording.';
    case 'workflow_focus':
      return 'Classified as workflow-focus feedback about breadth versus trusted daily use.';
    case 'useful_signal':
      return 'Classified as a useful workflow signal to preserve.';
    case 'uncategorized':
      return 'Classified as feedback that needs maintainer triage.';
  }
}

function evidenceFor(category: FeedbackIntakeCategory, text: string): string[] {
  const evidence: string[] = [];
  if (/false[- ]positive|flagged unused|reported unused/.test(text))
    evidence.push('false-positive wording');
  if (/unused[- ]exports?/.test(text)) evidence.push('unused-exports signal');
  if (/caution|warning/.test(text)) evidence.push('caution wording');
  if (/\b(?:npm|npx|install|installed|global|globally)\b/.test(text))
    evidence.push('npm install wording');
  if (/allow[- ]scripts?/.test(text)) evidence.push('allow-scripts warning');
  if (/node-gyp-build|tree-sitter/.test(text)) evidence.push('native grammar install wording');
  if (/noise|noisy|background/.test(text)) evidence.push('noise wording');
  if (/koa|hono|fastify|express|next\.?js|sveltekit|astro|remix/.test(text))
    evidence.push('framework wording');
  if (/docs|readme|output|wording|message/.test(text)) evidence.push('docs/output wording');
  if (/feature breadth|breadth|too many features/.test(text))
    evidence.push('feature breadth wording');
  if (/killer workflows?|daily workflows?|trust daily|trusted daily/.test(text))
    evidence.push('trusted workflow wording');
  if (/useful|saved .*minute|prevented|caught|helped/.test(text))
    evidence.push('usefulness wording');
  if (evidence.length === 0) evidence.push(category);
  return evidence;
}

function feedbackResponseFor(
  category: FeedbackIntakeCategory,
  signal: string,
  summary: string,
): DogfoodFeedbackResponse {
  const response: DogfoodFeedbackResponse = {
    reviewer: 'agent-intake',
    useful: category === 'useful_signal',
    minutesSaved: 0,
    note: summary,
  };
  if (category === 'false_positive') response.falsePositiveRules = [signal];
  if (category === 'missing_framework_rule') response.missingSignals = [signal];
  if (category === 'noisy_caution') response.noisyFindings = [signal];
  if (category === 'install_warning') response.noisyFindings = [signal];
  if (category === 'confusing_docs_output') response.noisyFindings = [signal];
  if (category === 'workflow_focus') response.noisyFindings = [signal];
  return response;
}

function agentloopCommandFor(
  category: FeedbackIntakeCategory,
  taskTitle: string,
  summary: string,
  suggestedCommand: string,
): string {
  const taskType = category === 'useful_signal' ? 'tests' : 'bugfix';
  const problem =
    'Reviewer feedback classified as ' +
    category +
    ': ' +
    summary +
    ' Preserve the raw signal in local feedback evidence and avoid broad product scope.';
  const outcome =
    category === 'useful_signal'
      ? 'Keep the useful workflow covered by focused tests or docs so later changes do not regress it.'
      : 'Reproduce and fix the feedback signal, or document the remaining limitation with focused verification.';
  return [
    'npm exec agentloop -- create-task',
    '--type ' + taskType,
    '--title ' + shellQuote(taskTitle),
    '--problem ' + shellQuote(problem),
    '--outcome ' + shellQuote(outcome),
    '--acceptance ' + shellQuote('The feedback signal is addressed with a focused test or documented as deferred.'),
    '--verify-command ' + shellQuote(suggestedCommand),
    '--rollback ' + shellQuote('Revert the focused feedback fix if verification fails.'),
  ].join(' ');
}

function shellQuote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}
