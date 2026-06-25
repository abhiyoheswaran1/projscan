import path from 'node:path';

import type {
  ProveChangedFileClassification,
  ProveContract,
  ProveProofRequirement,
  ProveProofRequirementResult,
  ProveProofSufficiency,
  ProveProofSufficiencyStatus,
  ProveReceipt,
  ProveRiskSurface,
} from '../types/prove.js';

const CONFIG_BASENAMES = new Set([
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'tsconfig.json',
]);
const CONFIG_SUFFIXES = ['.config.js', '.config.cjs', '.config.mjs', '.config.ts'];

export function buildProofRequirements(input: {
  allowedFiles: string[];
  likelyTests: string[];
  riskyContracts: string[];
  proofCommands: string[];
}): ProveProofRequirement[] {
  const rows: ProveProofRequirement[] = [];
  const testCommands = input.proofCommands.filter(isTestProofCommand);
  const supportCommands = input.proofCommands.filter((command) => !isTestProofCommand(command));
  const filesBySurface = new Map<ProveRiskSurface, string[]>();
  for (const file of input.allowedFiles) {
    const surface = riskSurfaceForFile(file);
    if (surface === 'test') continue;
    filesBySurface.set(surface, [...(filesBySurface.get(surface) ?? []), file]);
  }
  if (input.likelyTests.length > 0) {
    filesBySurface.set('test', unique([...(filesBySurface.get('test') ?? []), ...input.likelyTests]));
  }
  for (const surface of orderedSurfaces(filesBySurface)) {
    const files = unique(filesBySurface.get(surface) ?? []);
    if (files.length === 0) continue;
    const requiredCommands = requirementCommandsForSurface(surface, testCommands, supportCommands);
    rows.push({
      id: proofRequirementId(surface, files),
      surface,
      files,
      requiredCommands,
      requiredReview: requiredReviewForSurface(surface),
      reason: proofRequirementReason(surface, files),
    });
  }
  for (const surface of riskyContractSurfaces(input.riskyContracts)) {
    if (rows.some((row) => row.surface === surface)) continue;
    rows.push({
      id: proofRequirementId(surface, []),
      surface,
      files: [],
      requiredCommands: requirementCommandsForSurface(surface, testCommands, supportCommands),
      requiredReview: requiredReviewForSurface(surface),
      reason: `Risky contract evidence includes ${surface}.`,
    });
  }
  return rows;
}

export function proofSufficiencyFor(input: {
  contract?: ProveContract;
  scope: ProveReceipt['scope'];
  proofStatus: ProveReceipt['proofStatus'];
}): ProveProofSufficiency {
  if (!input.contract) return missingContractProofSufficiency(input.scope);
  const requirements = proofRequirementsForReceipt(input.contract);
  if (requirements.length === 0) {
    const status: ProveProofSufficiencyStatus =
      input.scope.status === 'within-contract' ? 'adequate' : 'missing';
    return {
      status,
      summary:
        status === 'adequate'
          ? 'No explicit proof requirements were needed for this receipt.'
          : 'No Proof Contract requirements were available for the changed files.',
      requirements: [],
      gaps:
        status === 'adequate'
          ? []
          : ['No Proof Contract requirements were available for the changed files.'],
      weakRequirements: [],
      missingRequirements: status === 'missing' ? ['missing-contract: changed files'] : [],
      staleRequirements: [],
      failedRequirements: [],
    };
  }
  const results = requirements.map((requirement) =>
    proofRequirementResult(requirement, input.scope, input.proofStatus),
  );
  const status = aggregateProofSufficiency(results);
  const gaps = unique(results.flatMap((result) => result.gaps));
  return {
    status,
    summary: proofSufficiencySummary(status, results),
    requirements: results,
    gaps,
    weakRequirements: requirementIdsByStatus(results, 'weak'),
    missingRequirements: requirementIdsByStatus(results, 'missing'),
    staleRequirements: requirementIdsByStatus(results, 'stale'),
    failedRequirements: requirementIdsByStatus(results, 'failed'),
  };
}

export function proofRelevantChangedFiles(files: string[]): string[] {
  return files.filter((file) => !isGeneratedPath(file));
}

export function isDocumentationPath(file: string): boolean {
  return (
    file === 'README.md' ||
    file.startsWith('docs/') ||
    file.endsWith('.md') ||
    file.endsWith('.mdx')
  );
}

export function isGeneratedPath(file: string): boolean {
  return (
    file.startsWith('.projscan/') ||
    file.startsWith('.projscan-memory/') ||
    file.startsWith('.agentloop/') ||
    file.startsWith('.agentflight/') ||
    file.startsWith('coverage/') ||
    file.startsWith('dist/')
  );
}

export function isSecuritySensitivePath(file: string): boolean {
  return (
    file === '.env' ||
    file.startsWith('.env.') ||
    file.includes('/auth') ||
    file.includes('/security') ||
    file.includes('/secrets') ||
    file.endsWith('.pem') ||
    file.endsWith('.key')
  );
}

export function isConfigPath(file: string): boolean {
  const basename = path.posix.basename(file);
  return (
    CONFIG_BASENAMES.has(basename) ||
    CONFIG_SUFFIXES.some((suffix) => basename.endsWith(suffix)) ||
    file.startsWith('.github/')
  );
}

export function isTestPath(file: string): boolean {
  return (
    file.startsWith('test/') ||
    file.startsWith('tests/') ||
    file.includes('/__tests__/') ||
    /\.test\.[cm]?[jt]sx?$/.test(file) ||
    /\.spec\.[cm]?[jt]sx?$/.test(file)
  );
}

export function isProductionPath(file: string): boolean {
  return (
    file.startsWith('src/') ||
    file.startsWith('app/') ||
    file.startsWith('lib/') ||
    file.startsWith('packages/') ||
    file.startsWith('apps/')
  );
}

function proofRequirementsForReceipt(contract: ProveContract): ProveProofRequirement[] {
  if (contract.proofRequirements?.length) return contract.proofRequirements;
  return buildProofRequirements({
    allowedFiles: contract.allowedFiles,
    likelyTests: contract.likelyTests,
    riskyContracts: contract.riskyContracts,
    proofCommands: contract.proofCommands,
  });
}

function missingContractProofSufficiency(
  scope: ProveReceipt['scope'],
): ProveProofSufficiency {
  const files = proofRelevantChangedFiles(scope.changedFiles);
  const requirement: ProveProofRequirementResult = {
    id: 'missing-contract: changed files',
    surface: 'unknown',
    status: 'missing',
    files,
    requiredCommands: ['projscan prove --intent "<change>" --save-contract .projscan/proof-contract.json'],
    matchedCommands: [],
    requiredReview: 'review changed files without a saved Proof Contract',
    reason: 'No Proof Contract was available to map changed files to required proof.',
    gaps: ['missing-contract: changed files is missing proof.'],
  };
  return {
    status: 'missing',
    summary: 'missing: no Proof Contract requirements were available for the changed files',
    requirements: files.length > 0 ? [requirement] : [],
    gaps: ['No Proof Contract requirements were available for the changed files.'],
    weakRequirements: [],
    missingRequirements: files.length > 0 ? [requirement.id] : ['missing-contract: changed files'],
    staleRequirements: [],
    failedRequirements: [],
  };
}

function proofRequirementResult(
  requirement: ProveProofRequirement,
  scope: ProveReceipt['scope'],
  proofStatus: ProveReceipt['proofStatus'],
): ProveProofRequirementResult {
  const requiredCommandSet = new Set(requirement.requiredCommands);
  const changedFileSet = new Set(scope.changedFiles);
  const commandEvidence = proofStatus.commandEvidence.filter((entry) =>
    requiredCommandSet.has(entry.command),
  );
  const matchedCommands = commandEvidence.map((entry) => entry.command);
  const touchedFiles = requirement.files.filter((file) => changedFileSet.has(file));
  const surfaceTouched = scope.classifications.some(
    (classification) => riskSurfaceForFile(classification.file, classification.kind) === requirement.surface,
  );
  const freshPassed = commandEvidence.filter((entry) => entry.status === 'passed' && entry.fresh);
  const freshFailed = commandEvidence.filter((entry) => entry.status === 'failed' && entry.fresh);
  const stale = commandEvidence.filter((entry) => entry.status === 'stale');
  const trustedFreshPassed = freshPassed.filter((entry) => isTrustedProofSource(entry.source));
  const status = proofRequirementStatus({
    requirement,
    touchedFiles,
    surfaceTouched,
    freshPassedCount: freshPassed.length,
    trustedFreshPassedCount: trustedFreshPassed.length,
    freshFailedCount: freshFailed.length,
    staleCount: stale.length,
    matchedCount: matchedCommands.length,
    expectedTestTouched: scope.expectedTests.length > 0,
  });
  return {
    id: requirement.id,
    surface: requirement.surface,
    status,
    files: requirement.files,
    requiredCommands: requirement.requiredCommands,
    matchedCommands,
    requiredReview: requirement.requiredReview,
    reason: requirement.reason,
    gaps: proofRequirementGaps({
      requirement,
      status,
      touchedFiles,
      surfaceTouched,
      matchedCommands,
      expectedTestTouched: scope.expectedTests.length > 0,
    }),
    ...(requirement.source ? { source: requirement.source } : {}),
    ...(requirement.recipeId ? { recipeId: requirement.recipeId } : {}),
    ...(requirement.requiredReviewers ? { requiredReviewers: requirement.requiredReviewers } : {}),
  };
}

function proofRequirementStatus(input: {
  requirement: ProveProofRequirement;
  touchedFiles: string[];
  surfaceTouched: boolean;
  freshPassedCount: number;
  trustedFreshPassedCount: number;
  freshFailedCount: number;
  staleCount: number;
  matchedCount: number;
  expectedTestTouched: boolean;
}): ProveProofSufficiencyStatus {
  if (input.freshFailedCount > 0) return 'failed';
  if (input.requirement.source === 'recipe') {
    if (input.matchedCount === 0) return 'missing';
    if (input.freshPassedCount === 0 && input.staleCount > 0) return 'stale';
    if (input.freshPassedCount === 0) return 'missing';
    return 'strong';
  }
  if (input.requirement.requiredCommands.length === 0) {
    return input.requirement.surface === 'documentation' || input.requirement.surface === 'generated'
      ? 'adequate'
      : 'weak';
  }
  if (input.matchedCount === 0) return 'missing';
  if (input.freshPassedCount === 0 && input.staleCount > 0) return 'stale';
  if (input.freshPassedCount === 0) return 'missing';
  if (input.trustedFreshPassedCount === 0) return 'weak';
  if (input.requirement.surface === 'production') {
    if (input.touchedFiles.length > 0 && input.expectedTestTouched) return 'strong';
    if (input.touchedFiles.length > 0) return 'adequate';
    return 'weak';
  }
  if (input.touchedFiles.length > 0 || input.surfaceTouched) return 'strong';
  return 'adequate';
}

function isTrustedProofSource(source: string | undefined): boolean {
  return source === 'prove-run' || source === 'mission' || source === 'external';
}

function proofRequirementGaps(input: {
  requirement: ProveProofRequirement;
  status: ProveProofSufficiencyStatus;
  touchedFiles: string[];
  surfaceTouched: boolean;
  matchedCommands: string[];
  expectedTestTouched: boolean;
}): string[] {
  if (input.status === 'strong' || input.status === 'adequate') return [];
  if (input.requirement.source === 'recipe') {
    const label = `recipe ${input.requirement.recipeId ?? input.requirement.id}`;
    if (input.status === 'failed') return [`${label} has failed proof.`];
    if (input.status === 'stale') return [`${label} has stale proof after newer edits.`];
    if (input.status === 'missing') return [`${label} is missing proof.`];
    return [`${label} has weak proof mapping.`];
  }
  const label = `${input.requirement.surface} requirement ${input.requirement.id}`;
  if (input.status === 'failed') return [`${label} has failed proof.`];
  if (input.status === 'stale') return [`${label} has stale proof after newer edits.`];
  if (input.status === 'missing') return [`${label} is missing proof.`];
  const gaps = [`${label} has weak proof mapping.`];
  if (input.requirement.surface === 'production' && !input.expectedTestTouched) {
    gaps.push(`${label} has no changed expected test evidence.`);
  }
  if (input.touchedFiles.length === 0 && !input.surfaceTouched && input.matchedCommands.length > 0) {
    gaps.push(`${label} has proof commands but no changed file on that surface.`);
  }
  return gaps;
}

function aggregateProofSufficiency(
  results: ProveProofRequirementResult[],
): ProveProofSufficiencyStatus {
  const severity: ProveProofSufficiencyStatus[] = [
    'failed',
    'stale',
    'missing',
    'weak',
    'adequate',
    'strong',
  ];
  return severity.find((status) => results.some((result) => result.status === status)) ?? 'adequate';
}

function proofSufficiencySummary(
  status: ProveProofSufficiencyStatus,
  results: ProveProofRequirementResult[],
): string {
  const counts = new Map<ProveProofSufficiencyStatus, number>();
  for (const result of results) counts.set(result.status, (counts.get(result.status) ?? 0) + 1);
  const parts = [...counts.entries()]
    .map(([entryStatus, count]) => `${count} ${entryStatus}`)
    .join(', ');
  return `${status}: ${parts || 'no'} proof requirement(s) evaluated`;
}

function requirementIdsByStatus(
  results: ProveProofRequirementResult[],
  status: ProveProofSufficiencyStatus,
): string[] {
  return results.filter((result) => result.status === status).map((result) => result.id);
}

function orderedSurfaces(filesBySurface: Map<ProveRiskSurface, string[]>): ProveRiskSurface[] {
  const preferred: ProveRiskSurface[] = [
    'security',
    'dependency',
    'config',
    'public-api',
    'cli',
    'mcp',
    'production',
    'test',
    'documentation',
    'generated',
    'unknown',
  ];
  return preferred.filter((surface) => filesBySurface.has(surface));
}

function requirementCommandsForSurface(
  surface: ProveRiskSurface,
  testCommands: string[],
  supportCommands: string[],
): string[] {
  if (surface === 'documentation' || surface === 'generated') return [];
  if (surface === 'config' || surface === 'security' || surface === 'dependency') {
    return unique([...testCommands, ...supportCommands]);
  }
  return unique([...testCommands, ...supportCommands.slice(0, 1)]);
}

function isTestProofCommand(command: string): boolean {
  return /^npm (?:run )?test\b/.test(command);
}

function proofRequirementId(surface: ProveRiskSurface, files: string[]): string {
  const filePart = files.length > 0 ? slug(files.slice(0, 3).join('-')) : 'contract';
  return `${surface}:${filePart}`;
}

function requiredReviewForSurface(surface: ProveRiskSurface): string {
  switch (surface) {
    case 'production':
      return 'review changed production behavior and matching regression proof';
    case 'test':
      return 'review test intent and confirm it covers the changed behavior';
    case 'security':
      return 'require explicit security review and fresh proof';
    case 'config':
      return 'require config-owner review and preflight proof';
    case 'dependency':
      return 'require dependency or lockfile review and install/test proof';
    case 'public-api':
      return 'review public API compatibility and migration risk';
    case 'cli':
      return 'review CLI behavior and documented command output';
    case 'mcp':
      return 'review MCP tool contract compatibility';
    case 'documentation':
      return 'confirm docs describe the same proof slice';
    case 'generated':
      return 'confirm generated proof artifacts are local and ignored';
    default:
      return 'review the changed surface and require focused proof';
  }
}

function proofRequirementReason(surface: ProveRiskSurface, files: string[]): string {
  const fileSummary = files.length > 0 ? files.join(', ') : 'contract-only evidence';
  return `${surface} surface requires proof because it covers ${fileSummary}.`;
}

function riskyContractSurfaces(contracts: string[]): ProveRiskSurface[] {
  const surfaces: ProveRiskSurface[] = [];
  for (const contract of contracts.map((value) => value.toLowerCase())) {
    if (contract.includes('cli')) surfaces.push('cli');
    if (contract.includes('mcp')) surfaces.push('mcp');
    if (contract.includes('public api') || contract.includes('types')) surfaces.push('public-api');
  }
  return unique(surfaces);
}

function riskSurfaceForFile(
  file: string,
  classificationKind?: ProveChangedFileClassification['kind'],
): ProveRiskSurface {
  if (classificationKind === 'expected-test' || classificationKind === 'unexpected-test') return 'test';
  if (classificationKind === 'documentation') return 'documentation';
  if (classificationKind === 'security-sensitive') return 'security';
  if (classificationKind === 'generated') return 'generated';
  if (isGeneratedPath(file)) return 'generated';
  if (isTestPath(file)) return 'test';
  if (isDocumentationPath(file)) return 'documentation';
  if (isSecuritySensitivePath(file)) return 'security';
  if (isDependencyPath(file)) return 'dependency';
  if (isConfigPath(file)) return 'config';
  if (file.startsWith('src/cli/')) return 'cli';
  if (file.startsWith('src/mcp/')) return 'mcp';
  if (isPublicApiPath(file)) return 'public-api';
  if (isProductionPath(file)) return 'production';
  return 'unknown';
}

function isDependencyPath(file: string): boolean {
  const basename = path.posix.basename(file);
  return (
    basename === 'package.json' ||
    basename === 'package-lock.json' ||
    basename === 'pnpm-lock.yaml' ||
    basename === 'yarn.lock'
  );
}

function isPublicApiPath(file: string): boolean {
  return (
    file === 'src/types.ts' ||
    file.startsWith('src/types/') ||
    file.startsWith('src/public') ||
    file.includes('/types/')
  );
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}
