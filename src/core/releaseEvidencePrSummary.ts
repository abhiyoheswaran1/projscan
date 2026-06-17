import { fixFirstFromChangedFiles, fixFirstFromEvidenceRisk } from './fixFirst.js';
import type { OwnershipLookup } from './ownership.js';
import type {
  BaselineTrend,
  BugHuntReport,
  EvidencePackPrSummary,
  EvidencePackTeamRoute,
  EvidencePackTopRisk,
  FixFirstRecommendation,
  PreflightReport,
  PreflightSuggestedAction,
  WorkplanReport,
} from '../types.js';

export interface BuildEvidencePackPrSummaryInput {
  workplan: WorkplanReport;
  bugHunt: BugHuntReport;
  preflight: PreflightReport;
  nextActions: PreflightSuggestedAction[];
  baselineTrend?: BaselineTrend;
  ownership?: OwnershipLookup;
}

export function buildEvidencePackPrSummary({
  workplan,
  bugHunt,
  preflight,
  nextActions,
  baselineTrend,
  ownership,
}: BuildEvidencePackPrSummaryInput): EvidencePackPrSummary {
  const topRisks = buildPrTopRisks(workplan, bugHunt, ownership);
  const changedFileRoutes = buildChangedFileTeamRoutes(preflight, ownership);
  const teamRoutes = mergeTeamRoutes([...buildTeamRoutes(topRisks), ...changedFileRoutes]);
  const ownershipSuggestion =
    teamRoutes.length === 0 ? buildOwnershipSuggestion(preflight) : undefined;
  const trust = calibratePreflightTrust(preflight);
  const nextCommands = buildPrNextCommands(nextActions);
  const fixFirst = buildPrFixFirst(topRisks, preflight, changedFileRoutes);
  const concreteBlockers = concreteDefectMessages(preflight);
  const verdictLabel =
    concreteBlockers.length > 0
      ? 'Concrete blocker'
      : preflight.evidence.releaseScale?.detected
        ? 'Manual review'
        : preflight.verdict === 'proceed'
          ? 'Ready'
          : 'Needs review';
  const decision =
    concreteBlockers.length > 0
      ? `${concreteBlockers.length} concrete blocker(s) need fixing before approval.`
      : preflight.evidence.releaseScale?.detected
        ? 'Scale or complexity needs human sign-off; no concrete taint/dataflow/health/plugin/supply-chain blocker was found.'
        : preflight.verdict === 'proceed'
          ? 'No blocking or cautionary preflight signals found.'
          : 'Review cautions and run the listed next actions before approval.';
  return {
    verdictLabel,
    decision,
    trust,
    topRisks,
    teamRoutes,
    ...(ownershipSuggestion ? { ownershipSuggestion } : {}),
    ...(fixFirst ? { fixFirst } : {}),
    nextCommands,
    ...(baselineTrend ? { baselineTrend } : {}),
  };
}

export function calibratePreflightTrust(
  preflight: PreflightReport,
): EvidencePackPrSummary['trust'] {
  const concreteBlockers = concreteDefectMessages(preflight);
  const warningReasons = preflight.reasons.filter((reason) => reason.severity === 'warning');
  const manualReviewReasons = preflight.reasons.filter(
    (reason) => reason.severity === 'warning' || isReleaseScaleReviewReason(preflight, reason),
  );
  const manualReviewSignals = dedupeStrings([
    ...(preflight.evidence.releaseScale?.detected
      ? [preflight.evidence.releaseScale.explanation]
      : []),
    ...manualReviewReasons
      .filter((reason) =>
        ['changed-files', 'git', 'hotspots', 'release', 'review'].includes(reason.source),
      )
      .map((reason) => reason.message),
  ]).slice(0, 5);
  const watchSignals = dedupeStrings(
    warningReasons
      .filter(
        (reason) =>
          !['changed-files', 'git', 'hotspots', 'release', 'review'].includes(reason.source),
      )
      .map((reason) => reason.message),
  ).slice(0, 5);
  const verdict: EvidencePackPrSummary['trust']['verdict'] =
    concreteBlockers.length > 0
      ? 'actual_defect'
      : manualReviewSignals.length > 0 || watchSignals.length > 0
        ? 'manual_review'
        : 'clean';
  const summary =
    verdict === 'actual_defect'
      ? `${concreteBlockers.length} actual defect/blocker signal(s) require fixes.`
      : verdict === 'manual_review'
        ? `${manualReviewSignals.length + watchSignals.length} manual review/watch signal(s); no actual defect blocker was found.`
        : 'clean: no actual defect, manual review, or watch signals found.';
  return { verdict, summary, concreteBlockers, manualReviewSignals, watchSignals };
}

export function concreteDefectMessages(preflight: PreflightReport): string[] {
  return dedupeStrings([
    ...preflight.reasons
      .filter((reason) => isConcreteDefectReason(preflight, reason))
      .map((reason) => reason.message),
    ...(preflight.evidence.releaseScale?.concreteBlockers ?? []),
  ]).slice(0, 5);
}

function isConcreteDefectReason(
  preflight: PreflightReport,
  reason: PreflightReport['reasons'][number],
): boolean {
  if (reason.severity !== 'error') return false;
  return !isReleaseScaleReviewReason(preflight, reason);
}

function isReleaseScaleReviewReason(
  preflight: PreflightReport,
  reason: PreflightReport['reasons'][number],
): boolean {
  const releaseScale = preflight.evidence.releaseScale;
  return (
    releaseScale?.detected === true &&
    releaseScale.concreteBlockers.length === 0 &&
    reason.source === 'review' &&
    /scale\/complexity|release-scale|large platform|changed-file risk/i.test(reason.message)
  );
}

function buildPrNextCommands(actions: PreflightSuggestedAction[]): string[] {
  return dedupeStrings([
    'projscan preflight --mode before_merge --format json',
    ...actions
      .map((action) => action.command ?? (action.tool ? `MCP ${action.tool}` : ''))
      .filter(Boolean),
  ]).slice(0, 6);
}

function buildPrTopRisks(
  workplan: WorkplanReport,
  bugHunt: BugHuntReport,
  ownership: OwnershipLookup | undefined,
): EvidencePackTopRisk[] {
  const risks: EvidencePackTopRisk[] = [];
  for (const risk of workplan.topRisks) {
    const files = risk.file ? [risk.file] : [];
    const owner = ownerFor(files, ownership);
    risks.push({
      priority: risk.priority,
      title: risk.message,
      files,
      ...(owner ? { owner } : {}),
      command: risk.tool ? toolCommand(risk.tool) : 'projscan preflight --format json',
    });
  }
  for (const finding of bugHunt.topSuspects) {
    const owner = ownerFor(finding.files, ownership);
    risks.push({
      priority: finding.priority,
      title: finding.title,
      files: finding.files,
      ...(owner ? { owner } : {}),
      command: finding.verification.commands[0] ?? 'projscan bug-hunt --format json',
    });
  }
  const seen = new Set<string>();
  return risks
    .filter((risk) => {
      const key = `${risk.title}:${risk.files.join(',')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

function buildTeamRoutes(risks: EvidencePackTopRisk[]): EvidencePackTeamRoute[] {
  const byOwner = new Map<string, Set<string>>();
  for (const risk of risks) {
    if (!risk.owner) continue;
    const files = byOwner.get(risk.owner) ?? new Set<string>();
    for (const file of risk.files) files.add(file);
    byOwner.set(risk.owner, files);
  }
  return [...byOwner.entries()].map(([owner, files]) => ({
    owner,
    files: [...files].slice(0, 5),
    reason: 'owns one or more top PR risks',
  }));
}

function ownerFor(files: string[], ownership: OwnershipLookup | undefined): string | undefined {
  if (!ownership) return undefined;
  for (const file of files) {
    const owner = ownership(file);
    if (owner) return owner;
  }
  return undefined;
}

function toolCommand(tool: string): string {
  if (tool === 'projscan_review') return 'projscan review --format json';
  if (tool === 'projscan_hotspots') return 'projscan hotspots --format json';
  if (tool === 'projscan_doctor') return 'projscan doctor --format json';
  return 'projscan preflight --format json';
}

function buildPrFixFirst(
  risks: EvidencePackTopRisk[],
  preflight: PreflightReport,
  changedFileRoutes: EvidencePackTeamRoute[],
): FixFirstRecommendation | undefined {
  const riskFix = fixFirstFromEvidenceRisk(risks[0]);
  if (riskFix) return riskFix;
  const route = changedFileRoutes[0];
  if (route) return fixFirstFromChangedFiles(route.files, route.owner);
  const changedFiles = preflight.evidence.changedFiles?.files ?? [];
  return fixFirstFromChangedFiles(changedFiles);
}

function buildOwnershipSuggestion(preflight: PreflightReport): string | undefined {
  const paths = (preflight.evidence.changedFiles?.files ?? [])
    .map(normalizeChangedFilePath)
    .filter(
      (file) =>
        file.length > 0 && !file.endsWith('package-lock.json') && !file.startsWith('.projscan-'),
    );
  if (paths.length === 0) return undefined;

  const counts = new Map<string, number>();
  for (const file of paths) {
    const pattern = codeownersPatternForPath(file);
    counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  }
  const [pattern] =
    [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [];
  return pattern ? `${pattern} @team-name` : undefined;
}

function normalizeChangedFilePath(value: string): string {
  return value.replace(/^(?:[ MADRCU?!]{1,2}|\?\?)\s+/, '').trim();
}

function codeownersPatternForPath(file: string): string {
  const normalized = file.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return '*';
  if (parts.length >= 2 && ['src', 'app', 'packages', 'apps', 'services'].includes(parts[0])) {
    return `${parts[0]}/${parts[1]}/**`;
  }
  if (parts.length >= 2 && parts[0] === '.github') return '.github/**';
  if (parts.length >= 2) return `${parts[0]}/**`;
  return normalized;
}

function buildChangedFileTeamRoutes(
  preflight: PreflightReport,
  ownership: OwnershipLookup | undefined,
): EvidencePackTeamRoute[] {
  if (!ownership) return [];
  const byOwner = new Map<string, Set<string>>();
  for (const rawFile of preflight.evidence.changedFiles?.files ?? []) {
    const file = normalizeChangedFilePath(rawFile);
    if (!file) continue;
    const owner = ownership(file);
    if (!owner) continue;
    const files = byOwner.get(owner) ?? new Set<string>();
    files.add(file);
    byOwner.set(owner, files);
  }
  return [...byOwner.entries()].map(([owner, files]) => ({
    owner,
    files: [...files].slice(0, 5),
    reason: 'owns changed file(s) in this PR',
  }));
}

function mergeTeamRoutes(routes: EvidencePackTeamRoute[]): EvidencePackTeamRoute[] {
  const byOwner = new Map<string, EvidencePackTeamRoute>();
  for (const route of routes) {
    const existing = byOwner.get(route.owner);
    if (!existing) {
      byOwner.set(route.owner, { ...route, files: [...route.files] });
      continue;
    }
    existing.files = [...new Set([...existing.files, ...route.files])].slice(0, 5);
    if (!existing.reason.includes(route.reason))
      existing.reason = `${existing.reason}; ${route.reason}`;
  }
  return [...byOwner.values()].slice(0, 5);
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
