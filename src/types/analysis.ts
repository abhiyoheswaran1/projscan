import type { ExportInfo, ImportInfo, Issue, IssueSeverity } from './common.js';
import type {
  DependencyReport,
  FrameworkResult,
  LanguageBreakdown,
  ScanResult,
} from './scanning.js';

export interface FileExplanation {
  filePath: string;
  purpose: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
  potentialIssues: string[];
  lineCount: number;
}

export interface ArchitectureLayer {
  name: string;
  technologies: string[];
  directories: string[];
}

export interface AnalysisReport {
  projectName: string;
  rootPath: string;
  scan: ScanResult;
  languages: LanguageBreakdown;
  frameworks: FrameworkResult;
  dependencies: DependencyReport | null;
  issues: Issue[];
  timestamp: string;
}

export interface HealthScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  errors: number;
  warnings: number;
  infos: number;
  scoreBreakdown?: ScoreBreakdown;
}

export interface ScoreSeverityBreakdown {
  count: number;
  weight: number;
  penalty: number;
}

export interface ScoreCategoryBreakdown {
  category: string;
  count: number;
  penalty: number;
}

export interface ScoreBreakdown {
  baseScore: number;
  finalScore: number;
  grade: HealthScore['grade'];
  totalPenalty: number;
  uncappedPenalty: number;
  bySeverity: Record<IssueSeverity, ScoreSeverityBreakdown>;
  byCategory: ScoreCategoryBreakdown[];
}
