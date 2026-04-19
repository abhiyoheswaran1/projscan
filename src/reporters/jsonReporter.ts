import type {
  AnalysisReport,
  Issue,
  FileExplanation,
  ArchitectureLayer,
  DirectoryNode,
  DependencyReport,
  DiffResult,
  HotspotReport,
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
