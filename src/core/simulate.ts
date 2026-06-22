import path from 'node:path';
import { buildCodeGraph } from './codeGraph.js';
import { computeQualityScorecard } from './qualityScorecard.js';
import { scanRepository } from './repositoryScanner.js';
import { computeRiskDelta } from './riskDelta.js';
import type { CodeGraph, GraphFile } from './codeGraph.js';
import type { FileEntry, QualityScorecardRisk, WorkplanPriority } from '../types.js';
import type {
  SimulateCandidateFile,
  SimulateConfidence,
  SimulateEvidence,
  SimulateAlternative,
  SimulateReport,
  SimulateRolloutStep,
  SimulateVerdict,
} from '../types/simulate.js';

export interface ComputeSimulationOptions {
  plan: string;
  maxFiles?: number;
}

const DEFAULT_MAX_FILES = 5;
const NO_MATCH_WARNING =
  'No repo files matched the plan. Mention a file, symbol, command, package, or module name for a stronger simulation.';
const IGNORED_SIMULATION_PATH_SEGMENTS = new Set([
  '.agentflight',
  '.agentloop',
  '.git',
  '.projscan-memory',
  'coverage',
  'dist',
  'node_modules',
]);
const SOURCE_LIKE_EXTENSIONS = new Set([
  '.c',
  '.cpp',
  '.cs',
  '.css',
  '.go',
  '.h',
  '.hpp',
  '.html',
  '.java',
  '.js',
  '.json',
  '.jsonc',
  '.jsx',
  '.kt',
  '.md',
  '.mdx',
  '.mjs',
  '.mts',
  '.php',
  '.py',
  '.rb',
  '.rs',
  '.scss',
  '.sh',
  '.sql',
  '.swift',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);
const SOURCE_LIKE_FILENAMES = new Set([
  'dockerfile',
  'makefile',
  'package-lock.json',
  'package.json',
  'pnpm-lock.yaml',
  'readme',
  'tsconfig.json',
  'yarn.lock',
]);
const WEAK_PLAN_TERMS = new Set([
  'add',
  'adding',
  'change',
  'changes',
  'clean',
  'cleaner',
  'code',
  'edit',
  'evidence',
  'extract',
  'file',
  'files',
  'fix',
  'improve',
  'improvement',
  'into',
  'make',
  'module',
  'modules',
  'output',
  'ranking',
  'refactor',
  'safe',
  'safer',
  'ship',
  'split',
  'test',
  'tests',
  'update',
  'week',
]);

export async function computeSimulation(
  rootPath: string,
  options: ComputeSimulationOptions,
): Promise<SimulateReport> {
  const plan = normalizePlan(options.plan);
  if (!plan) throw new Error('simulate requires a non-empty plan');

  const maxFiles = normalizeMaxFiles(options.maxFiles);
  const [scan, quality] = await Promise.all([
    scanRepository(rootPath),
    computeQualityScorecard(rootPath, { maxRisks: maxFiles }),
  ]);
  const graph = await buildCodeGraph(rootPath, scan.files).catch(() => undefined);
  const candidateFiles = rankCandidateFiles({
    plan,
    files: scan.files,
    graph,
    risks: quality.topRisks,
  }).slice(0, maxFiles);
  const testsLikelyAffected = likelyTests(scan.files, candidateFiles);
  const contractsLikelyAffected = inferContracts(plan, candidateFiles);
  const warnings = candidateFiles.length === 0 ? [NO_MATCH_WARNING] : [];
  const proofCards = candidateFiles.map((candidate) => ({
    id: `simulate-${slug(candidate.path)}`,
    priority: priorityForCandidate(candidate),
    source: candidate.qualityRisk ? 'hotspot' : 'plan',
  }));
  const riskDelta = computeRiskDelta({
    healthScore: quality.health.score,
    qualityVerdict: quality.verdict,
    preflightVerdict: 'proceed',
    proofCards,
    selectedCardIds: proofCards.slice(0, 2).map((card) => card.id),
  });
  const confidence = confidenceFor(candidateFiles, graph);
  const verdict = verdictFor(confidence, riskDelta.delta);
  const rolloutPlan = buildRolloutPlan(plan, candidateFiles, testsLikelyAffected);
  const proofCommands = buildProofCommands(plan, candidateFiles, testsLikelyAffected);
  const evidence = buildEvidence(candidateFiles, testsLikelyAffected, contractsLikelyAffected);
  const alternatives = buildAlternatives({
    plan,
    confidence,
    candidateFiles,
    testsLikelyAffected,
    contractsLikelyAffected,
    riskDelta: riskDelta.delta,
    proofCommands,
  });
  const recommendedAlternative = recommendAlternative(alternatives);

  return {
    schemaVersion: 1,
    plan,
    verdict,
    confidence,
    summary: summarize(verdict, confidence, candidateFiles, riskDelta.delta),
    filesLikelyTouched: candidateFiles,
    testsLikelyAffected,
    contractsLikelyAffected,
    riskDelta,
    rolloutPlan,
    proofCommands,
    evidence,
    alternatives,
    recommendedAlternative,
    warnings,
  };
}

function rankCandidateFiles(input: {
  plan: string;
  files: FileEntry[];
  graph?: CodeGraph;
  risks: QualityScorecardRisk[];
}): SimulateCandidateFile[] {
  const planLower = input.plan.toLowerCase();
  const planTerms = tokenize(input.plan);
  const riskByFile = new Map<string, QualityScorecardRisk>();
  for (const risk of input.risks) {
    for (const file of risk.files) riskByFile.set(file, risk);
  }

  return input.files
    .filter((file) => isSimulationCandidatePath(file.relativePath))
    .map((file) => scoreFile(file, planLower, planTerms, input.graph, riskByFile.get(file.relativePath)))
    .filter((candidate): candidate is SimulateCandidateFile => candidate.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        testRank(a.path) - testRank(b.path) ||
        a.path.localeCompare(b.path),
    );
}

function scoreFile(
  file: FileEntry,
  planLower: string,
  planTerms: Set<string>,
  graph: CodeGraph | undefined,
  qualityRisk: QualityScorecardRisk | undefined,
): SimulateCandidateFile {
  const basename = path.basename(file.relativePath);
  const basenameNoExt = basename.replace(/\.[^.]+$/, '');
  const fileTerms = tokenize(`${file.relativePath} ${basenameNoExt}`);
  const reasons: string[] = [];
  let score = 0;

  if (planLower.includes(file.relativePath.toLowerCase())) {
    score += 80;
    reasons.push(`plan mentions ${file.relativePath}`);
  } else if (planLower.includes(basename.toLowerCase())) {
    score += 70;
    reasons.push(`plan mentions ${basename}`);
  } else if (basenameNoExt && planMentionsStem(basenameNoExt, planLower, planTerms)) {
    score += 60;
    reasons.push(`plan mentions ${basenameNoExt}`);
  }

  const overlap = [...fileTerms].filter((term) => planTerms.has(term) && isStrongPlanTerm(term));
  if (overlap.length > 0) {
    score += overlap.length * 12;
    reasons.push(`plan shares term(s): ${overlap.slice(0, 4).join(', ')}`);
  }

  if (qualityRisk && score > 0) {
    score += 8;
    reasons.push(`quality signal: ${qualityRisk.title}`);
  }

  const gf = graph?.files.get(file.relativePath);
  const fanIn = graph?.localImporters.get(file.relativePath)?.size ?? 0;
  const fanOut = gf?.imports.length ?? 0;
  if (score > 0 && gf && (fanIn > 0 || fanOut > 0)) score += Math.min(10, fanIn + fanOut);

  const graphSummary = gf && graph ? graphFor(file.relativePath, gf, graph) : undefined;
  return {
    path: file.relativePath,
    score,
    reasons,
    ...(graphSummary ? { graph: graphSummary } : {}),
    ...(qualityRisk ? { qualityRisk: qualityRisk.title } : {}),
  };
}

function graphFor(file: string, graphFile: GraphFile, graph: CodeGraph): SimulateCandidateFile['graph'] {
  return {
    fanIn: graph.localImporters.get(file)?.size ?? 0,
    fanOut: graphFile.imports.length,
    directImporters: [...(graph.localImporters.get(file) ?? new Set<string>())].sort(),
  };
}

function likelyTests(files: FileEntry[], candidates: SimulateCandidateFile[]): string[] {
  const testFiles = files
    .map((file) => file.relativePath)
    .filter((file) => /(?:^|[./_-])(test|spec)\.[^.]+$/.test(file) || /\.(test|spec)\.[^.]+$/.test(file))
    .sort();
  const matches = new Map<string, number>();
  for (const candidate of candidates) {
    const candidateBase = path.basename(candidate.path).replace(/\.[^.]+$/, '').toLowerCase();
    for (const test of testFiles) {
      const testLower = test.toLowerCase();
      const score = testScore(testLower, candidateBase);
      if (score > 0) matches.set(test, Math.max(matches.get(test) ?? 0, score));
    }
  }
  return [...matches]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([test]) => test);
}

function testScore(testLower: string, candidateBase: string): number {
  const testBase = path
    .basename(testLower)
    .replace(/\.(test|spec)\.[^.]+$/, '')
    .replace(/\.[^.]+$/, '');
  if (testBase === candidateBase) return 100;
  if (candidateBase.length < 3) return 0;
  return testLower.includes(candidateBase) ? 40 : 0;
}

function inferContracts(plan: string, candidates: SimulateCandidateFile[]): string[] {
  const terms = tokenize(plan);
  const contracts = new Set<string>();
  if (hasAny(terms, ['split', 'extract', 'module', 'modules', 'boundary'])) contracts.add('module boundary');
  if (hasAny(terms, ['cli', 'command', 'commands'])) contracts.add('CLI command surface');
  if (hasAny(terms, ['mcp', 'tool', 'tools'])) contracts.add('MCP tool surface');
  if (hasAny(terms, ['type', 'types', 'api', 'export', 'public'])) contracts.add('public API/types');
  if (candidates.some((candidate) => candidate.path.startsWith('src/cli/')))
    contracts.add('CLI command surface');
  if (candidates.some((candidate) => candidate.path.startsWith('src/mcp/')))
    contracts.add('MCP tool surface');
  if (candidates.some((candidate) => candidate.path.includes('/types') || candidate.path === 'src/types.ts'))
    contracts.add('public API/types');
  return [...contracts].sort();
}

function buildRolloutPlan(
  plan: string,
  candidates: SimulateCandidateFile[],
  tests: string[],
): SimulateRolloutStep[] {
  const primary = candidates[0]?.path;
  const firstTest = tests[0];
  return [
    {
      title: 'Lock the current behavior',
      detail: firstTest
        ? `Run or add the closest regression test before moving code: ${firstTest}.`
        : 'Add one regression test around the behavior named in the plan before moving code.',
      commands: firstTest ? [`npm test -- ${firstTest}`] : ['projscan assess --mode fix-first --format json'],
    },
    {
      title: 'Extract the smallest module boundary',
      detail: primary
        ? `Move one responsibility out of ${primary}; keep imports and public exports stable until tests pass.`
        : 'Name the target file or symbol, then extract one responsibility without broad cleanup.',
      commands: primary ? [`projscan file ${primary} --format json`] : ['projscan understand --intent "where should this change go?" --format json'],
    },
    {
      title: 'Wire callers through the existing public surface',
      detail: 'Update direct importers first and avoid renaming public contracts unless the simulation calls them out.',
      commands: primary ? [`projscan impact ${primary} --format json`] : ['projscan quality-scorecard --format json'],
    },
    {
      title: 'Run proof commands and compare risk',
      detail: `After the change, rerun the simulator for the same plan and compare risk delta.`,
      commands: [`projscan simulate --plan ${quotePlan(plan)} --format json`],
    },
  ];
}

function buildProofCommands(
  plan: string,
  candidates: SimulateCandidateFile[],
  tests: string[],
): string[] {
  const commands = [
    `projscan simulate --plan ${quotePlan(plan)} --format json`,
    'projscan assess --mode fix-first --format json',
    'projscan quality-scorecard --format json',
  ];
  for (const candidate of candidates.slice(0, 3)) {
    commands.push(`projscan file ${candidate.path} --format json`);
    commands.push(`projscan impact ${candidate.path} --format json`);
  }
  for (const test of tests.slice(0, 3)) commands.push(`npm test -- ${test}`);
  return [...new Set(commands)];
}

function buildEvidence(
  candidates: SimulateCandidateFile[],
  tests: string[],
  contracts: string[],
): SimulateEvidence[] {
  const evidence: SimulateEvidence[] = [];
  for (const candidate of candidates) {
    evidence.push({
      source: 'plan-match',
      detail: candidate.reasons.join('; '),
      file: candidate.path,
      command: `projscan file ${candidate.path} --format json`,
    });
    if (candidate.graph) {
      evidence.push({
        source: 'code-graph',
        detail: `fan-in ${candidate.graph.fanIn}, fan-out ${candidate.graph.fanOut}, direct importers ${candidate.graph.directImporters.length}`,
        file: candidate.path,
        command: `projscan impact ${candidate.path} --format json`,
      });
    }
  }
  if (tests.length > 0) {
    evidence.push({
      source: 'test-neighbor',
      detail: `${tests.length} likely affected test file(s)`,
      file: tests[0],
    });
  }
  if (contracts.length > 0) {
    evidence.push({
      source: 'contract-inference',
      detail: contracts.join(', '),
    });
  }
  return evidence;
}

function buildAlternatives(input: {
  plan: string;
  confidence: SimulateConfidence;
  candidateFiles: SimulateCandidateFile[];
  testsLikelyAffected: string[];
  contractsLikelyAffected: string[];
  riskDelta: number;
  proofCommands: string[];
}): SimulateAlternative[] {
  const primary = input.candidateFiles[0]?.path;
  const firstTest = input.testsLikelyAffected[0];
  const extractionDelta = input.candidateFiles.length > 0 ? Math.max(6, input.riskDelta) : 0;
  const extractionBlastRadius =
    input.candidateFiles.length + input.contractsLikelyAffected.length * 2;
  const testFirstDelta = firstTest ? Math.max(4, Math.min(10, Math.round(extractionDelta / 2))) : 3;
  const testFirstBlastRadius = firstTest ? 1 : 2;

  return [
    {
      id: 'bounded-extraction',
      title: 'Bounded extraction',
      summary: primary
        ? `Extract one responsibility from ${primary} while preserving public imports.`
        : 'Name the target file before extracting code.',
      riskDelta: extractionDelta,
      blastRadius: extractionBlastRadius,
      confidence: input.confidence,
      proofCommands: input.proofCommands.slice(0, 5),
      reason:
        extractionDelta > 0
          ? 'Best when the plan names a hotspot or module boundary and nearby tests exist.'
          : 'Not recommended until the plan names a concrete file or symbol.',
      tradeoffs: [
        'Removes maintainability risk when kept to one responsibility.',
        'Touches production code and can affect import contracts.',
      ],
    },
    {
      id: 'test-first',
      title: 'Regression test first',
      summary: firstTest
        ? `Start by locking behavior in ${firstTest}.`
        : 'Add one regression test around the behavior before refactoring.',
      riskDelta: testFirstDelta,
      blastRadius: testFirstBlastRadius,
      confidence: firstTest ? input.confidence : 'medium',
      proofCommands: firstTest ? [`npm test -- ${firstTest}`] : ['projscan assess --mode fix-first --format json'],
      reason: 'Best when confidence is medium or the safest first move is proving current behavior.',
      tradeoffs: [
        'Lowest blast radius.',
        'Usually reduces uncertainty more than structural risk.',
      ],
    },
    {
      id: 'leave-unchanged',
      title: 'Leave unchanged',
      summary: 'Do not edit until the plan has stronger evidence or a clearer target.',
      riskDelta: 0,
      blastRadius: 0,
      confidence: 'high',
      proofCommands: ['projscan assess --mode fix-first --format json'],
      reason: 'Best when simulation confidence is low or no repo files match the plan.',
      tradeoffs: [
        'No code risk.',
        'Does not remove the underlying maintainability or verification risk.',
      ],
    },
  ];
}

function recommendAlternative(alternatives: SimulateAlternative[]): SimulateAlternative {
  return [...alternatives].sort(
    (a, b) =>
      alternativeScore(b) - alternativeScore(a) ||
      alternativeOrder(a.id) - alternativeOrder(b.id),
  )[0]!;
}

function alternativeScore(option: SimulateAlternative): number {
  return option.riskDelta * 2 - option.blastRadius * 3 + confidenceScore(option.confidence);
}

function confidenceScore(confidence: SimulateConfidence): number {
  if (confidence === 'high') return 4;
  if (confidence === 'medium') return 2;
  return -4;
}

function alternativeOrder(id: SimulateAlternative['id']): number {
  if (id === 'bounded-extraction') return 0;
  if (id === 'test-first') return 1;
  return 2;
}

function verdictFor(confidence: SimulateConfidence, delta: number): SimulateVerdict {
  if (confidence === 'low') return 'needs-more-evidence';
  if (delta <= 0) return 'not-worth-it-yet';
  return 'worth-doing';
}

function confidenceFor(
  candidates: SimulateCandidateFile[],
  graph: CodeGraph | undefined,
): SimulateConfidence {
  if (candidates.length === 0) return 'low';
  if (candidates[0] && candidates[0].score >= 80 && graph) return 'high';
  return 'medium';
}

function summarize(
  verdict: SimulateVerdict,
  confidence: SimulateConfidence,
  candidates: SimulateCandidateFile[],
  delta: number,
): string {
  if (candidates.length === 0) return `${verdict}: low-confidence simulation needs a concrete target`;
  return `${verdict}: ${confidence}-confidence plan touches ${candidates.length} likely file(s), projected risk delta +${delta}`;
}

function priorityForCandidate(candidate: SimulateCandidateFile): WorkplanPriority {
  if (candidate.score >= 90) return 'p0';
  if (candidate.score >= 45) return 'p1';
  return 'p2';
}

function normalizePlan(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

function normalizeMaxFiles(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MAX_FILES;
  return Math.max(1, Math.min(25, Math.floor(value)));
}

function tokenize(value: string): Set<string> {
  const spaced = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  const terms = spaced.match(/[a-z0-9]+/g) ?? [];
  return new Set(terms.filter((term) => term.length > 1));
}

function hasAny(terms: Set<string>, values: string[]): boolean {
  return values.some((value) => terms.has(value));
}

function isSimulationCandidatePath(filePath: string): boolean {
  const segments = filePath.split(/[\\/]+/);
  if (segments.some((segment) => IGNORED_SIMULATION_PATH_SEGMENTS.has(segment))) return false;
  const basename = path.basename(filePath).toLowerCase();
  if (SOURCE_LIKE_FILENAMES.has(basename)) return true;
  if (SOURCE_LIKE_FILENAMES.has(basename.replace(/\.[^.]+$/, ''))) return true;
  return SOURCE_LIKE_EXTENSIONS.has(path.extname(basename));
}

function isStrongPlanTerm(term: string): boolean {
  return term.length > 2 && !WEAK_PLAN_TERMS.has(term);
}

function planMentionsStem(stem: string, planLower: string, planTerms: Set<string>): boolean {
  const normalized = stem.toLowerCase();
  if (normalized.length < 3) return planTerms.has(normalized);
  return planLower.includes(normalized);
}

function quotePlan(plan: string): string {
  return `"${plan.replace(/["\\]/g, '\\$&')}"`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function testRank(file: string): number {
  return /\.(test|spec)\.[^.]+$/.test(file) ? 1 : 0;
}
