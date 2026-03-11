import type {
  AnalysisReport,
  Issue,
  FileExplanation,
  ArchitectureLayer,
  DirectoryNode,
  DependencyReport,
} from '../types.js';

export function reportAnalysisJson(report: AnalysisReport): void {
  console.log(JSON.stringify(report, null, 2));
}

export function reportHealthJson(issues: Issue[]): void {
  console.log(
    JSON.stringify(
      {
        health: {
          totalIssues: issues.length,
          errors: issues.filter((i) => i.severity === 'error').length,
          warnings: issues.filter((i) => i.severity === 'warning').length,
          info: issues.filter((i) => i.severity === 'info').length,
          issues,
        },
      },
      null,
      2,
    ),
  );
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
