import type {
  AnalysisReport,
  AuditReport,
  CoverageJoinedReport,
  CouplingReport,
  Issue,
  FileExplanation,
  FileInspection,
  ArchitectureLayer,
  DirectoryNode,
  DependencyReport,
  DiffResult,
  HotspotReport,
  OutdatedReport,
  PrDiffReport,
  FixSuggestion,
  ImpactReport,
  IssueExplanation,
  UpgradePreview,
  WorkspaceInfo,
} from '../types.js';
import type { ReportControlsMetadata } from '../core/reportScope.js';
import type { ReviewReport } from '../types/review.js';
import { calculateScore } from '../utils/scoreCalculator.js';
import { toCiIssueDetail } from './ciIssueDetails.js';

export const CLI_JSON_SCHEMA_VERSION = 2;

function emitJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ schemaVersion: CLI_JSON_SCHEMA_VERSION, ...payload }, null, 2));
}

export function reportAnalysisJson(
  report: AnalysisReport,
  reportControls?: ReportControlsMetadata,
): void {
  emitJson({
    ...(report as unknown as Record<string, unknown>),
    ...(reportControls ? { reportControls } : {}),
  });
}

export function reportHealthJson(issues: Issue[], reportControls?: ReportControlsMetadata): void {
  const { score, grade, errors, warnings, infos } = calculateScore(issues);
  console.log(
    JSON.stringify(
      {
        schemaVersion: CLI_JSON_SCHEMA_VERSION,
        ...(reportControls ? { reportControls } : {}),
        health: {
          score,
          grade,
          totalIssues: issues.length,
          errors,
          warnings,
          info: infos,
          issues,
        },
      },
      null,
      2,
    ),
  );
}

export function reportCiJson(
  issues: Issue[],
  threshold: number,
  reportControls?: ReportControlsMetadata,
): void {
  const { score, grade, errors, warnings, infos } = calculateScore(issues);
  console.log(
    JSON.stringify(
      {
        schemaVersion: CLI_JSON_SCHEMA_VERSION,
        ...(reportControls ? { reportControls } : {}),
        ci: {
          score,
          grade,
          pass: score >= threshold,
          threshold,
          totalIssues: issues.length,
          errors,
          warnings,
          info: infos,
          issues: issues.map(toCiIssueDetail),
        },
      },
      null,
      2,
    ),
  );
}

export function reportDiffJson(diff: DiffResult): void {
  emitJson({ diff });
}

export function reportExplanationJson(explanation: FileExplanation): void {
  emitJson(explanation as unknown as Record<string, unknown>);
}

export function reportDiagramJson(layers: ArchitectureLayer[]): void {
  emitJson({ architecture: layers });
}

export function reportStructureJson(tree: DirectoryNode): void {
  emitJson({ structure: tree });
}

export function reportDependenciesJson(report: DependencyReport): void {
  emitJson(report as unknown as Record<string, unknown>);
}

export function reportHotspotsJson(report: HotspotReport): void {
  emitJson({ hotspots: report });
}

export function reportFileJson(inspection: FileInspection): void {
  emitJson({ file: inspection });
}

export function reportOutdatedJson(report: OutdatedReport): void {
  emitJson({ outdated: report });
}

export function reportAuditJson(report: AuditReport): void {
  emitJson({ audit: report });
}

export function reportUpgradeJson(preview: UpgradePreview): void {
  emitJson({ upgrade: preview });
}

export function reportCoverageJson(report: CoverageJoinedReport): void {
  emitJson({ coverage: report });
}

export function reportCouplingJson(report: CouplingReport): void {
  emitJson({ coupling: report });
}

export function reportPrDiffJson(report: PrDiffReport): void {
  emitJson({ prDiff: report });
}

export function reportReviewJson(report: ReviewReport): void {
  emitJson({ review: report });
}

export function reportFixSuggestJson(result: {
  matched: boolean;
  fix?: FixSuggestion;
  reason?: string;
  synthetic?: boolean;
}): void {
  emitJson({ fixSuggest: result });
}

export function reportExplainIssueJson(explanation: IssueExplanation): void {
  emitJson({ issueExplanation: explanation });
}

export function reportImpactJson(report: ImpactReport): void {
  emitJson({ impact: report });
}

export function reportWorkspacesJson(info: WorkspaceInfo): void {
  emitJson({ workspaces: info });
}
