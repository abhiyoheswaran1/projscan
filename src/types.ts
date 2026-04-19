// === Scanning Results ===

export interface ScanResult {
  rootPath: string;
  totalFiles: number;
  totalDirectories: number;
  files: FileEntry[];
  directoryTree: DirectoryNode;
  scanDurationMs: number;
}

export interface FileEntry {
  relativePath: string;
  absolutePath: string;
  extension: string;
  sizeBytes: number;
  directory: string;
}

export interface DirectoryNode {
  name: string;
  path: string;
  children: DirectoryNode[];
  fileCount: number;
  totalFileCount: number;
}

// === Language Detection ===

export interface LanguageBreakdown {
  primary: string;
  languages: Record<string, LanguageStat>;
}

export interface LanguageStat {
  name: string;
  fileCount: number;
  percentage: number;
  extensions: string[];
}

// === Framework Detection ===

export interface FrameworkResult {
  frameworks: DetectedFramework[];
  buildTools: string[];
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'unknown';
}

export interface DetectedFramework {
  name: string;
  version?: string;
  category: 'frontend' | 'backend' | 'testing' | 'bundler' | 'css' | 'other';
  confidence: 'high' | 'medium' | 'low';
}

// === Dependency Analysis ===

export interface DependencyReport {
  totalDependencies: number;
  totalDevDependencies: number;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  risks: DependencyRisk[];
}

export interface DependencyRisk {
  name: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

// === Issues / Health ===

export type IssueSeverity = 'info' | 'warning' | 'error';

export interface Issue {
  id: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  category: string;
  fixAvailable: boolean;
  fixId?: string;
}

// === Fix System ===

export interface Fix {
  id: string;
  title: string;
  description: string;
  issueId: string;
  apply: (rootPath: string) => Promise<void>;
}

export interface FixResult {
  fix: Fix;
  success: boolean;
  error?: string;
}

// === File Explanation ===

export interface FileExplanation {
  filePath: string;
  purpose: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
  potentialIssues: string[];
  lineCount: number;
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  isRelative: boolean;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'default' | 'unknown';
}

// === Diagram ===

export interface ArchitectureLayer {
  name: string;
  technologies: string[];
  directories: string[];
}

// === Full Analysis Report ===

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

// === Health Score ===

export interface HealthScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  errors: number;
  warnings: number;
  infos: number;
}

// === Baseline / Diff ===

export interface Baseline {
  score: number;
  grade: HealthScore['grade'];
  issues: { id: string; title: string; severity: IssueSeverity }[];
  timestamp: string;
}

export interface DiffResult {
  before: Baseline;
  after: Baseline;
  scoreDelta: number;
  newIssues: string[];
  resolvedIssues: string[];
}

// === Reporter Interface ===

export type ReportFormat = 'console' | 'json' | 'markdown';

// === Hotspots ===

export interface FileHotspot {
  relativePath: string;
  churn: number;
  distinctAuthors: number;
  daysSinceLastChange: number | null;
  lineCount: number;
  sizeBytes: number;
  issueCount: number;
  issueIds: string[];
  riskScore: number;
  reasons: string[];
}

export interface HotspotReport {
  available: boolean;
  reason?: string;
  window: { since: string | null; commitsScanned: number };
  hotspots: FileHotspot[];
  totalFilesRanked: number;
}

// === MCP ===

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}
