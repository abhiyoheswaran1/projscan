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
  UpgradePreview,
  WorkspaceInfo,
} from '../types.js';
import { calculateScore } from '../utils/scoreCalculator.js';

export function reportAnalysisJson(report: AnalysisReport): void {
  console.log(JSON.stringify(report, null, 2));
}

export function reportHealthJson(issues: Issue[]): void {
  const { score, grade, errors, warnings, infos } = calculateScore(issues);
  console.log(
    JSON.stringify(
      {
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

export function reportCiJson(issues: Issue[], threshold: number): void {
  const { score, grade, errors, warnings, infos } = calculateScore(issues);
  console.log(
    JSON.stringify(
      {
        ci: {
          score,
          grade,
          pass: score >= threshold,
          threshold,
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

export function reportDiffJson(diff: DiffResult): void {
  console.log(JSON.stringify({ diff }, null, 2));
}

export function reportExplanationJson(explanation: FileExplanation): void {
  console.log(JSON.stringify(explanation, null, 2));
}

export function reportDiagramJson(layers: ArchitectureLayer[]): void {
  console.log(JSON.stringify({ architecture: layers }, null, 2));
}

export function reportStructureJson(tree: DirectoryNode): void {
  console.log(JSON.stringify({ structure: tree }, null, 2));
}

export function reportDependenciesJson(report: DependencyReport): void {
  console.log(JSON.stringify(report, null, 2));
}

export function reportHotspotsJson(report: HotspotReport): void {
  console.log(JSON.stringify({ hotspots: report }, null, 2));
}

export function reportFileJson(inspection: FileInspection): void {
  console.log(JSON.stringify({ file: inspection }, null, 2));
}

export function reportOutdatedJson(report: OutdatedReport): void {
  console.log(JSON.stringify({ outdated: report }, null, 2));
}

export function reportAuditJson(report: AuditReport): void {
  console.log(JSON.stringify({ audit: report }, null, 2));
}

export function reportUpgradeJson(preview: UpgradePreview): void {
  console.log(JSON.stringify({ upgrade: preview }, null, 2));
}

export function reportCoverageJson(report: CoverageJoinedReport): void {
  console.log(JSON.stringify({ coverage: report }, null, 2));
}

export function reportCouplingJson(report: CouplingReport): void {
  console.log(JSON.stringify({ coupling: report }, null, 2));
}

export function reportPrDiffJson(report: PrDiffReport): void {
  console.log(JSON.stringify({ prDiff: report }, null, 2));
}

export function reportWorkspacesJson(info: WorkspaceInfo): void {
  console.log(JSON.stringify({ workspaces: info }, null, 2));
}
