import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { analyzeHotspots } from './hotspotAnalyzer.js';
import { buildCodeGraph, type CodeGraph, type GraphFile } from './codeGraph.js';
import { computeDataflow } from './dataflow.js';
import { scanRepository } from './repositoryScanner.js';
import { buildSemanticGraph } from './semanticGraph.js';
import { quoteShellArg } from './startShellArgs.js';
import { getChangedFiles } from '../utils/changedFiles.js';
import { applyConfigToIssues, loadConfig } from '../utils/config.js';
import { collectIssues } from './issueEngine.js';
import type {
  UnderstandBoundary,
  UnderstandChangeReadiness,
  UnderstandCitation,
  UnderstandClaim,
  UnderstandConfigContract,
  UnderstandContracts,
  UnderstandDirectTest,
  UnderstandEntrypoint,
  UnderstandFlow,
  UnderstandFlowSideEffect,
  UnderstandPublicExport,
  UnderstandReadFirst,
  UnderstandReport,
  UnderstandRisk,
  UnderstandUnknown,
  UnderstandVerification,
  UnderstandVerificationTier,
  UnderstandView,
} from '../types/understand.js';
import type { Issue } from '../types/common.js';
import type { FileEntry } from '../types/scanning.js';

export interface ComputeUnderstandOptions {
  view?: UnderstandView;
  intent?: string;
  maxItems?: number;
  changedFiles?: string[];
}

const DEFAULT_MAX_ITEMS = 8;
const MAX_GRAPH_TEST_MATCHES = 5;
const MAX_GRAPH_TEST_IMPORTER_DEPTH = 3;
const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.rb',
  '.go',
  '.java',
  '.rs',
  '.php',
  '.cs',
  '.kt',
  '.kts',
  '.swift',
  '.cpp',
  '.cc',
  '.c',
  '.h',
  '.hpp',
]);
const TEST_PATTERNS = [/\.test\./, /\.spec\./, /(^|\/)(test|tests|__tests__)\//];

export async function computeUnderstandReport(
  rootPath: string,
  options: ComputeUnderstandOptions = {},
): Promise<UnderstandReport> {
  const view = normalizeView(options.view);
  const maxItems = normalizeLimit(options.maxItems);
  const configResult = await loadConfig(rootPath).catch(() => ({ config: { ignore: [] } }));
  const scan = await scanRepository(rootPath, { ignore: configResult.config.ignore });
  const issues = applyConfigToIssues(
    await collectIssues(rootPath, scan.files),
    configResult.config,
  );
  const graph = await buildCodeGraph(rootPath, scan.files);
  const semantic = buildSemanticGraph(graph, { maxNodes: 10_000, maxEdges: 25_000 });
  const dataflow = computeDataflow(graph, { sources: [], sinks: [] });
  const changedFiles = await resolveChangedFiles(rootPath, options.changedFiles);

  const entrypoints = buildEntrypoints(rootPath, scan.files, graph, maxItems);
  const boundaries = buildBoundaries(graph, maxItems);
  const sideEffects = buildSideEffects(
    graph,
    dataflow.risks.flatMap((risk) => risk.files),
    maxItems,
  );
  const flows = buildFlows(entrypoints, graph, sideEffects, maxItems);
  const contracts = await buildContracts(rootPath, graph, scan.files, changedFiles, maxItems);
  const readFirst = buildReadFirst(entrypoints, boundaries, graph, maxItems);
  const risks = await buildRisks(
    rootPath,
    scan.files,
    issues,
    graph,
    dataflow.risks.flatMap((risk) => risk.files),
    maxItems,
  );
  const verification = buildVerification(
    scan.files,
    changedFiles.length > 0 ? changedFiles : readFirst.map((item) => item.file),
    graph,
    maxItems,
  );
  const changeReadiness = buildChangeReadiness(options.intent, changedFiles, graph, verification);
  const claims = buildClaims(
    view,
    entrypoints,
    boundaries,
    flows,
    contracts,
    verification,
    readFirst,
  );
  const unknowns = buildUnknowns(view, graph, contracts, verification);

  return {
    schemaVersion: 1,
    view,
    rootPath,
    ...(options.intent ? { intent: options.intent } : {}),
    summary: summarize(
      view,
      entrypoints.length,
      boundaries.length,
      flows.length,
      contracts.publicExports.length,
    ),
    claims,
    entrypoints,
    boundaries,
    flows,
    contracts,
    changeReadiness,
    verification,
    readFirst,
    risks,
    unknowns,
    commands: commandsForView(view),
    ...(semantic.truncated || risks.length >= maxItems || readFirst.length >= maxItems
      ? { truncated: true }
      : {}),
  };
}

function normalizeView(value: UnderstandView | undefined): UnderstandView {
  if (value === 'flow' || value === 'contracts' || value === 'change' || value === 'verify')
    return value;
  return 'map';
}

function normalizeLimit(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MAX_ITEMS;
  return Math.max(1, Math.min(30, Math.floor(value)));
}

async function resolveChangedFiles(
  rootPath: string,
  explicit: string[] | undefined,
): Promise<string[]> {
  if (explicit?.length) return unique(explicit);
  const changed = await getChangedFiles(rootPath).catch(() => ({
    available: false,
    files: [] as string[],
  }));
  return changed.available ? changed.files : [];
}

function buildEntrypoints(
  rootPath: string,
  files: FileEntry[],
  graph: CodeGraph,
  maxItems: number,
): UnderstandEntrypoint[] {
  const packageEntrypoints = packageEntrypointFiles(rootPath);
  const candidates = files
    .filter((file) => CODE_EXTENSIONS.has(file.extension))
    .map((file) => {
      const lower = file.relativePath.toLowerCase();
      const graphFile = graph.files.get(file.relativePath);
      const exports = graphFile?.exports.map((entry) => entry.name).filter(Boolean) ?? [];
      const kind: UnderstandEntrypoint['kind'] = packageEntrypoints.has(file.relativePath)
        ? 'package-export'
        : lower.includes('server') || lower.includes('app')
          ? 'server'
          : lower.includes('route')
            ? 'route'
            : lower.includes('cli') || lower.includes('bin')
              ? 'cli'
              : TEST_PATTERNS.some((pattern) => pattern.test(file.relativePath))
                ? 'test'
                : lower.endsWith('index.ts') || lower.endsWith('index.js') || exports.length > 0
                  ? 'module'
                  : 'module';
      const score =
        (kind === 'package-export' ? 50 : 0) +
        (kind === 'server' || kind === 'cli' || kind === 'route' ? 30 : 0) +
        exports.length +
        (graph.localImporters.get(file.relativePath)?.size ?? 0);
      return { file, graphFile, exports, kind, score };
    })
    .filter((entry) => entry.score > 0 || entry.kind !== 'module')
    .sort((a, b) => b.score - a.score || a.file.relativePath.localeCompare(b.file.relativePath))
    .slice(0, maxItems);

  if (candidates.length === 0) {
    return files
      .filter((file) => CODE_EXTENSIONS.has(file.extension))
      .slice(0, Math.min(1, maxItems))
      .map((entry) =>
        entrypoint(
          entry.relativePath,
          'module',
          [],
          'First parseable source file found in the scan.',
        ),
      );
  }

  return candidates.map((entry) =>
    entrypoint(
      entry.file.relativePath,
      entry.kind,
      entry.exports.slice(0, 8),
      entry.kind === 'package-export'
        ? 'Package metadata points at this file as a public entry.'
        : entry.kind === 'server' || entry.kind === 'route'
          ? 'Filename and graph evidence suggest runtime request handling starts here.'
          : entry.kind === 'cli'
            ? 'Filename suggests this is a command-line entry surface.'
            : 'Exports and importer evidence make this a useful orientation entry.',
    ),
  );
}

function packageEntrypointFiles(rootPath: string): Set<string> {
  try {
    const pkg = JSON.parse(readFileSync(path.join(rootPath, 'package.json'), 'utf8')) as {
      main?: string;
      bin?: string | Record<string, string>;
      exports?: string | Record<string, unknown>;
    };
    const values = [
      pkg.main,
      typeof pkg.bin === 'string' ? pkg.bin : undefined,
      ...(pkg.bin && typeof pkg.bin === 'object' ? Object.values(pkg.bin) : []),
      ...(typeof pkg.exports === 'string' ? [pkg.exports] : []),
    ];
    return new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map(normalizePackagePath),
    );
  } catch {
    return new Set();
  }
}

function normalizePackagePath(value: string): string {
  return value
    .replace(/^\.\//, '')
    .replace(/^dist\//, 'src/')
    .replace(/\.js$/, '.ts');
}

function entrypoint(
  file: string,
  kind: UnderstandEntrypoint['kind'],
  symbols: string[],
  why: string,
): UnderstandEntrypoint {
  return {
    file,
    kind,
    symbols,
    why,
    citations: [citation(file, symbols[0], why)],
  };
}

function buildBoundaries(graph: CodeGraph, maxItems: number): UnderstandBoundary[] {
  const grouped = new Map<string, GraphFile[]>();
  for (const [relativePath, file] of graph.files) {
    const name = boundaryName(relativePath);
    const list = grouped.get(name) ?? [];
    list.push(file);
    grouped.set(name, list);
  }
  return [...grouped.entries()]
    .map(([name, files]) => {
      const fileNames = new Set(files.map((file) => file.relativePath));
      const dependsOn = new Set<string>();
      for (const file of files) {
        for (const local of localDependenciesFor(file.relativePath, graph)) {
          if (!fileNames.has(local)) dependsOn.add(boundaryName(local));
        }
        for (const pkg of packageDependenciesFor(file.relativePath, graph)) dependsOn.add(pkg);
      }
      const publicExports = files
        .flatMap((file) => file.exports.map((entry) => entry.name).filter(Boolean))
        .slice(0, 12);
      return {
        name,
        files: files.length,
        publicExports,
        dependsOn: [...dependsOn]
          .filter((entry) => entry !== name)
          .sort()
          .slice(0, 12),
        citations: files
          .slice(0, 3)
          .map((file) =>
            citation(
              file.relativePath,
              publicExports[0],
              'Boundary contains parseable source files.',
            ),
          ),
      };
    })
    .sort((a, b) => b.files - a.files || a.name.localeCompare(b.name))
    .slice(0, maxItems);
}

function boundaryName(relativePath: string): string {
  const parts = relativePath.split('/');
  if (parts.length <= 1) return '.';
  return parts[0] ?? '.';
}

function buildSideEffects(
  graph: CodeGraph,
  dataflowFiles: string[],
  maxItems: number,
): UnderstandFlowSideEffect[] {
  const effects: UnderstandFlowSideEffect[] = [];
  const seen = new Set<string>();
  for (const [file, entry] of graph.files) {
    const calls = entry.callSites.join(' ');
    const imports = entry.imports.map((imp) => imp.source).join(' ');
    const text = `${calls} ${imports}`;
    const detected: Array<[UnderstandFlowSideEffect['kind'], RegExp, string]> = [
      [
        'database',
        /\b(query|execute|sql|db|pool|repository)\b/i,
        'Database-style query or repository call detected.',
      ],
      [
        'filesystem',
        /\b(readFile|writeFile|fs\.|createReadStream|createWriteStream)\b/i,
        'Filesystem read/write call detected.',
      ],
      ['network', /\b(fetch|axios|http|https|request)\b/i, 'Network client call detected.'],
      ['process', /\b(spawn|exec|execFile|process\.exit)\b/i, 'Process control call detected.'],
      ['env', /\bprocess\.env\b/i, 'Environment/config read detected.'],
    ];
    for (const [kind, pattern, label] of detected) {
      const key = `${kind}:${file}`;
      if (
        !seen.has(key) &&
        (pattern.test(text) || (kind === 'database' && dataflowFiles.includes(file)))
      ) {
        seen.add(key);
        effects.push({ kind, label, files: [file], citations: [citation(file, undefined, label)] });
      }
    }
  }
  return effects.slice(0, maxItems);
}

function buildFlows(
  entrypoints: UnderstandEntrypoint[],
  graph: CodeGraph,
  sideEffects: UnderstandFlowSideEffect[],
  maxItems: number,
): UnderstandFlow[] {
  const flows = entrypoints
    .filter(
      (entry) =>
        entry.kind === 'server' ||
        entry.kind === 'route' ||
        entry.kind === 'cli' ||
        entry.kind === 'package-export',
    )
    .map((entry, index): UnderstandFlow => {
      const reachable = reachableFiles(entry.file, graph, 5);
      const effects = sideEffects.filter((effect) =>
        effect.files.some((file) => reachable.includes(file) || file === entry.file),
      );
      const pathFiles = unique([
        entry.file,
        ...reachable,
        ...effects.flatMap((effect) => effect.files),
      ]).slice(0, 8);
      return {
        id: `flow-${index + 1}`,
        label: `${entry.kind} flow from ${entry.file}`,
        entry,
        path: pathFiles,
        sideEffects: effects.length > 0 ? effects : sideEffects.slice(0, 2),
        confidence: pathFiles.length > 1 ? 'medium' : 'low',
        citations: pathFiles
          .slice(0, 4)
          .map((file) =>
            citation(
              file,
              undefined,
              'Flow path is derived from local import and side-effect evidence.',
            ),
          ),
      };
    })
    .slice(0, maxItems);
  return flows.length > 0
    ? flows
    : entrypoints.slice(0, 1).map((entry) => ({
        id: 'flow-1',
        label: `entry flow from ${entry.file}`,
        entry,
        path: [entry.file],
        sideEffects: sideEffects.slice(0, 2),
        confidence: 'low',
        citations: entry.citations,
      }));
}

function reachableFiles(entryFile: string, graph: CodeGraph, maxDepth: number): string[] {
  const result: string[] = [];
  const queue: Array<{ file: string; depth: number }> = [{ file: entryFile, depth: 0 }];
  const seen = new Set([entryFile]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;
    const graphFile = graph.files.get(current.file);
    if (!graphFile) continue;
    for (const target of localDependenciesFor(current.file, graph)) {
      if (target && !seen.has(target)) {
        seen.add(target);
        result.push(target);
        queue.push({ file: target, depth: current.depth + 1 });
      }
    }
  }
  return result;
}

function localDependenciesFor(file: string, graph: CodeGraph): string[] {
  const dependencies: string[] = [];
  for (const [target, importers] of graph.localImporters) {
    if (importers.has(file)) dependencies.push(target);
  }
  return dependencies.sort();
}

function packageDependenciesFor(file: string, graph: CodeGraph): string[] {
  const dependencies: string[] = [];
  for (const [pkg, importers] of graph.packageImporters) {
    if (importers.has(file)) dependencies.push(pkg);
  }
  return dependencies.sort();
}

async function buildContracts(
  rootPath: string,
  graph: CodeGraph,
  files: FileEntry[],
  changedFiles: string[],
  maxItems: number,
): Promise<UnderstandContracts> {
  const packageExports = [...packageEntrypointFiles(rootPath)].map(
    (file): UnderstandPublicExport => ({
      name: file,
      file,
      kind: 'package',
      citations: [citation('package.json', file, 'Package metadata exposes this file.')],
    }),
  );
  const symbolExports = [...graph.files.values()]
    .flatMap((file) =>
      file.exports.map(
        (entry): UnderstandPublicExport => ({
          name: entry.name,
          file: file.relativePath,
          kind: 'symbol',
          citations: [
            citation(
              file.relativePath,
              entry.name,
              'Exported symbol is part of the code contract.',
            ),
          ],
        }),
      ),
    )
    .filter((entry) => Boolean(entry.name));
  const configContracts = await findConfigContracts(rootPath, files, maxItems);
  const focusFiles =
    changedFiles.length > 0
      ? changedFiles
      : [
          ...new Set([
            ...packageExports.map((entry) => entry.file),
            ...symbolExports.map((entry) => entry.file),
          ]),
        ];
  const breakingChangeRisks = focusFiles.slice(0, maxItems).map((file, index) => ({
    id: `contract-risk-${index + 1}`,
    title: `Changing ${file} may affect public imports or runtime configuration`,
    files: [file],
    why: 'The file is exported, imported, or contains configuration evidence that other code may rely on.',
    command: `projscan impact ${quoteShellArg(file)} --format json`,
  }));
  return {
    publicExports: uniqueBy(
      [...packageExports, ...symbolExports],
      (entry) => `${entry.kind}:${entry.file}:${entry.name}`,
    ).slice(0, maxItems),
    configContracts,
    breakingChangeRisks,
  };
}

async function findConfigContracts(
  rootPath: string,
  files: FileEntry[],
  maxItems: number,
): Promise<UnderstandConfigContract[]> {
  const contracts: UnderstandConfigContract[] = [];
  const relevant = files
    .filter((file) => CODE_EXTENSIONS.has(file.extension) || file.relativePath === 'package.json')
    .slice(0, 400);
  for (const file of relevant) {
    if (contracts.length >= maxItems) break;
    const full = path.join(rootPath, file.relativePath);
    const content = await fs.readFile(full, 'utf8').catch(() => '');
    for (const match of content.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      const name = match[1];
      if (
        !name ||
        contracts.some((entry) => entry.name === name && entry.file === file.relativePath)
      )
        continue;
      contracts.push({
        name,
        file: file.relativePath,
        kind: 'env',
        required: false,
        citations: [
          citation(file.relativePath, name, 'Environment variable is read by source code.'),
        ],
      });
    }
  }
  return contracts;
}

function buildReadFirst(
  entrypoints: UnderstandEntrypoint[],
  boundaries: UnderstandBoundary[],
  graph: CodeGraph,
  maxItems: number,
): UnderstandReadFirst[] {
  const candidates = unique([
    ...entrypoints.map((entry) => entry.file),
    ...boundaries.flatMap((boundary) => boundary.citations.map((cite) => cite.file)),
    ...[...graph.files.values()]
      .sort(
        (a, b) => b.exports.length + b.callSites.length - (a.exports.length + a.callSites.length),
      )
      .map((file) => file.relativePath),
  ]);
  return candidates.slice(0, maxItems).map((file) => ({
    file,
    why: entrypoints.some((entry) => entry.file === file)
      ? 'Start here because it is an entrypoint into the repo.'
      : 'Read this early because graph evidence shows exports, calls, or package boundary value.',
    command: `projscan file ${quoteShellArg(file)} --format json`,
    citations: [
      citation(
        file,
        undefined,
        'Read-first recommendation is backed by graph or entrypoint evidence.',
      ),
    ],
  }));
}

async function buildRisks(
  rootPath: string,
  files: FileEntry[],
  issues: Issue[],
  graph: CodeGraph,
  dataflowFiles: string[],
  maxItems: number,
): Promise<UnderstandRisk[]> {
  const hotspots = await analyzeHotspots(rootPath, files, issues, { limit: maxItems, graph }).catch(
    () => null,
  );
  const fromHotspots = hotspots?.available
    ? hotspots.hotspots.slice(0, maxItems).map(
        (hotspot): UnderstandRisk => ({
          id: `understand-hotspot-${slug(hotspot.relativePath)}`,
          priority: hotspot.riskScore >= 70 ? 'p0' : hotspot.riskScore >= 30 ? 'p1' : 'p2',
          title: `Hotspot ${hotspot.relativePath}`,
          files: [hotspot.relativePath],
          why: hotspot.reasons[0] ?? `Risk score ${Math.round(hotspot.riskScore)}`,
          command: `projscan file ${quoteShellArg(hotspot.relativePath)} --format json`,
        }),
      )
    : [];
  const fromDataflow = unique(dataflowFiles)
    .slice(0, maxItems)
    .map(
      (file): UnderstandRisk => ({
        id: `understand-dataflow-${slug(file)}`,
        priority: 'p1',
        title: `Review side effects in ${file}`,
        files: [file],
        why: 'Dataflow or side-effect evidence touches this file.',
        command: 'projscan dataflow --format json',
      }),
    );
  const fromIssues = issues.slice(0, maxItems).map(
    (issue): UnderstandRisk => ({
      id: `understand-issue-${issue.id}`,
      priority: issue.severity === 'error' ? 'p0' : issue.severity === 'warning' ? 'p1' : 'p2',
      title: issue.title,
      files: issue.locations?.map((location) => location.file) ?? [],
      why: issue.description,
      command: `projscan explain-issue ${issue.id} --format json`,
    }),
  );
  return uniqueBy([...fromDataflow, ...fromHotspots, ...fromIssues], (risk) => risk.id).slice(
    0,
    maxItems,
  );
}

function buildChangeReadiness(
  intent: string | undefined,
  changedFiles: string[],
  graph: CodeGraph,
  verification: UnderstandVerification,
): UnderstandChangeReadiness {
  const focusFiles = changedFiles.length > 0 ? changedFiles : [...graph.files.keys()].slice(0, 1);
  const blastRadius = focusFiles.map((file) => {
    const importers = [...(graph.localImporters.get(file) ?? new Set<string>())].sort();
    return {
      label: `Blast radius for ${file}`,
      files: unique([file, ...importers]),
      why:
        importers.length > 0
          ? 'Local importers depend on this file and should be reviewed before editing.'
          : 'No local importers were found; inspect the file contract and tests before editing.',
      command: `projscan impact ${quoteShellArg(file)} --format json`,
    };
  });
  const firstFile = focusFiles[0] ?? '.';
  return {
    intent: intent ?? 'understand the next safe change',
    blastRadius,
    safeEdit: {
      title: `Inspect ${firstFile} before editing`,
      files: [firstFile],
      command: `projscan file ${quoteShellArg(firstFile)} --format json`,
      why: 'Start with the smallest cited file that matches the intended change, then follow importers before editing.',
    },
    owners: [
      {
        owner: 'unassigned',
        files: focusFiles,
        reason:
          'No CODEOWNERS lookup is required for this local understand report; add ownership metadata to improve routing.',
      },
    ],
    rollback: {
      command:
        focusFiles.length > 0
          ? `git restore ${focusFiles.map(quoteShellArg).join(' ')}`
          : 'git restore .',
      why: 'Keep a simple rollback command visible before making broad edits.',
    },
    verificationCommands: unique([
      'projscan understand --view verify --format json',
      ...verification.tiers[0].commands,
    ]),
  };
}

function buildVerification(
  files: FileEntry[],
  changedFiles: string[],
  graph: CodeGraph,
  maxItems: number,
): UnderstandVerification {
  const sourceFiles = unique(changedFiles.filter((file) => !isTestFile(file))).slice(0, maxItems);
  const testFiles = files.filter((file) => isTestFile(file.relativePath));
  const testFileSet = new Set(testFiles.map((file) => file.relativePath));
  const directTests: UnderstandDirectTest[] = sourceFiles.map((file) => {
    const token = directTestMatchToken(file);
    const filenameTests = token
      ? testFiles
          .map((entry) => entry.relativePath)
          .filter((testFile) => testFile.toLowerCase().includes(token.toLowerCase()))
          .slice(0, 5)
      : [];
    const graphTests =
      filenameTests.length > 0 ? [] : graphLinkedTestFiles(graph, file, testFileSet);
    const tests = unique([...filenameTests, ...graphTests]).slice(0, 5);
    return {
      file,
      tests,
      confidence:
        filenameTests.length > 0 ? 'medium' : graphTests.length > 0 ? 'low' : 'none',
    };
  });
  const gaps = directTests
    .filter((entry) => entry.tests.length === 0)
    .map((entry) => ({
      file: entry.file,
      reason: 'No direct test file matched by filename or import graph.',
      command: `projscan search ${quoteShellArg(directTestSearchToken(entry.file) ?? entry.file)} --format json`,
    }));
  return {
    tiers: verificationTiers(),
    directTests,
    gaps,
  };
}

function graphLinkedTestFiles(
  graph: CodeGraph,
  file: string,
  testFileSet: Set<string>,
): string[] {
  if (!graph.files.has(file)) return [];
  const state = graphTestSearchState(file);
  while (state.queue.length > 0 && state.tests.length < MAX_GRAPH_TEST_MATCHES) {
    visitNextGraphTestImporter(graph, testFileSet, state);
  }
  return state.tests;
}

function graphTestSearchState(file: string): {
  tests: string[];
  seen: Set<string>;
  queue: Array<{ file: string; depth: number }>;
} {
  return {
    tests: [],
    seen: new Set([file]),
    queue: [{ file, depth: 0 }],
  };
}

function visitNextGraphTestImporter(
  graph: CodeGraph,
  testFileSet: Set<string>,
  state: ReturnType<typeof graphTestSearchState>,
): void {
  const current = state.queue.shift();
  if (!current || current.depth >= MAX_GRAPH_TEST_IMPORTER_DEPTH) return;
  for (const importer of sortedImporters(graph, current.file)) {
    addGraphTestCandidate(importer, current.depth + 1, testFileSet, state);
    if (state.tests.length >= MAX_GRAPH_TEST_MATCHES) return;
  }
}

function sortedImporters(graph: CodeGraph, file: string): string[] {
  return [...(graph.localImporters.get(file) ?? [])].sort();
}

function addGraphTestCandidate(
  importer: string,
  depth: number,
  testFileSet: Set<string>,
  state: ReturnType<typeof graphTestSearchState>,
): void {
  if (state.seen.has(importer)) return;
  state.seen.add(importer);
  if (testFileSet.has(importer)) {
    state.tests.push(importer);
    return;
  }
  state.queue.push({ file: importer, depth });
}

function verificationTiers(): UnderstandVerificationTier[] {
  return [
    {
      id: 'minimal',
      label: 'Minimal local proof',
      commands: [
        'projscan preflight --mode before_edit --format json',
        'projscan understand --view change --format json',
      ],
      when: 'Before a small edit or exploratory agent pass.',
    },
    {
      id: 'focused',
      label: 'Focused change proof',
      commands: ['projscan understand --view verify --format json', 'npm test'],
      when: 'Before handing a meaningful code change to review.',
    },
    {
      id: 'full',
      label: 'Release-grade proof',
      commands: ['npm run build', 'npm test', 'npm run lint', 'npm run check:stability'],
      when: 'Before merge, release prep, or broad refactors.',
    },
  ];
}

function buildClaims(
  view: UnderstandView,
  entrypoints: UnderstandEntrypoint[],
  boundaries: UnderstandBoundary[],
  flows: UnderstandFlow[],
  contracts: UnderstandContracts,
  verification: UnderstandVerification,
  readFirst: UnderstandReadFirst[],
): UnderstandClaim[] {
  const claims: UnderstandClaim[] = [
    {
      id: 'map-entrypoints',
      title: 'Primary entrypoints are identifiable from package and graph evidence',
      detail: `${entrypoints.length} entrypoint candidate(s) found.`,
      confidence: entrypoints.length > 0 ? 'high' : 'low',
      citations: entrypoints.flatMap((entry) => entry.citations).slice(0, 5),
    },
    {
      id: 'map-boundaries',
      title: 'Top module boundaries are visible from source directories',
      detail: `${boundaries.length} boundary candidate(s) found.`,
      confidence: boundaries.length > 0 ? 'medium' : 'low',
      citations: boundaries.flatMap((boundary) => boundary.citations).slice(0, 5),
    },
  ];
  if (view === 'flow' || flows.length > 0) {
    claims.push({
      id: 'flow-runtime-paths',
      title: 'Runtime paths can be followed from entrypoints to side effects',
      detail: `${flows.length} flow candidate(s) found.`,
      confidence: flows.some((flow) => flow.sideEffects.length > 0) ? 'medium' : 'low',
      citations: flows.flatMap((flow) => flow.citations).slice(0, 5),
    });
  }
  if (view === 'contracts' || contracts.publicExports.length > 0) {
    claims.push({
      id: 'contracts-public-surface',
      title: 'Public exports and config reads define the change contract',
      detail: `${contracts.publicExports.length} export(s), ${contracts.configContracts.length} config contract(s).`,
      confidence:
        contracts.publicExports.length > 0 || contracts.configContracts.length > 0 ? 'high' : 'low',
      citations: [...contracts.publicExports, ...contracts.configContracts]
        .flatMap((entry) => entry.citations)
        .slice(0, 5),
    });
  }
  if (view === 'verify') {
    claims.push({
      id: 'verify-proof-tiers',
      title: 'Verification can be staged by change size',
      detail: `${verification.tiers.length} verification tier(s) available.`,
      confidence: 'high',
      citations: readFirst.slice(0, 1).flatMap((entry) => entry.citations),
    });
  }
  return claims.filter((claim) => claim.citations.length > 0);
}

function buildUnknowns(
  view: UnderstandView,
  graph: CodeGraph,
  contracts: UnderstandContracts,
  verification: UnderstandVerification,
): UnderstandUnknown[] {
  const unknowns: UnderstandUnknown[] = [];
  if (graph.files.size === 0) {
    unknowns.push({
      id: 'no-parseable-graph',
      question: 'Which files define the runtime graph?',
      whyUnknown: 'No parseable files were available to the graph builder.',
      command: 'projscan doctor --format json',
    });
  }
  if (contracts.configContracts.length === 0 && (view === 'contracts' || view === 'map')) {
    unknowns.push({
      id: 'config-contracts-unknown',
      question: 'Which environment or config values are required?',
      whyUnknown:
        'No static process.env reads or config files were detected in the sampled source files.',
      command: 'projscan search process.env --format json',
    });
  }
  if (verification.gaps.length > 0 && (view === 'verify' || view === 'change')) {
    unknowns.push({
      id: 'direct-tests-missing',
      question: 'Which tests prove the touched source files?',
      whyUnknown: 'At least one source file has no filename or graph-linked test.',
      command: 'projscan understand --view verify --format json',
    });
  }
  return unknowns;
}

function commandsForView(view: UnderstandView): string[] {
  return unique(
    [
      `projscan understand --view ${view} --format json`,
      'projscan start --mode before_edit --format json',
      'projscan preflight --mode before_edit --format json',
      view === 'change' ? 'projscan understand --view verify --format json' : undefined,
    ].filter((command): command is string => Boolean(command)),
  );
}

function summarize(
  view: UnderstandView,
  entrypointCount: number,
  boundaryCount: number,
  flowCount: number,
  contractCount: number,
): string {
  if (view === 'flow')
    return `flow map: ${flowCount} runtime path(s), ${entrypointCount} entrypoint(s)`;
  if (view === 'contracts')
    return `contract map: ${contractCount} public contract(s), ${boundaryCount} boundary candidate(s)`;
  if (view === 'change')
    return `change readiness: ${entrypointCount} entrypoint(s), ${boundaryCount} boundary candidate(s)`;
  if (view === 'verify')
    return `verification map: proof tiers and direct-test gaps for likely touched files`;
  return `repo map: ${entrypointCount} entrypoint(s), ${boundaryCount} boundary candidate(s)`;
}

function citation(file: string, symbol: string | undefined, reason: string): UnderstandCitation {
  return {
    file,
    ...(symbol ? { symbol } : {}),
    reason,
  };
}

function isTestFile(file: string): boolean {
  return TEST_PATTERNS.some((pattern) => pattern.test(file));
}

function directTestMatchToken(file: string): string | null {
  if (/[\\/]$/.test(file)) return null;
  return directTestSearchToken(file);
}

function directTestSearchToken(file: string): string | null {
  const basename = path.basename(file.replace(/[\\/]+$/, ''));
  if (!basename) return null;
  const extension = path.extname(basename);
  const token =
    extension && extension !== basename ? basename.slice(0, -extension.length) : basename;
  return token.trim() || null;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values.filter(Boolean))];
}

function uniqueBy<T>(values: T[], keyFn: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = keyFn(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'item'
  );
}
