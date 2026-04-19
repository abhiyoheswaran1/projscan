export { scanRepository } from './core/repositoryScanner.js';
export { detectLanguages } from './core/languageDetector.js';
export { detectFrameworks } from './core/frameworkDetector.js';
export { analyzeDependencies } from './core/dependencyAnalyzer.js';
export { collectIssues } from './core/issueEngine.js';
export { analyzeHotspots, computeRiskScore } from './core/hotspotAnalyzer.js';
export { walkFiles } from './utils/fileWalker.js';
export { createMcpServer, runMcpServer } from './mcp/server.js';
export { getToolDefinitions } from './mcp/tools.js';

export type {
  ScanResult,
  FileEntry,
  DirectoryNode,
  LanguageBreakdown,
  LanguageStat,
  FrameworkResult,
  DetectedFramework,
  DependencyReport,
  DependencyRisk,
  Issue,
  IssueSeverity,
  Fix,
  FixResult,
  FileExplanation,
  ImportInfo,
  ExportInfo,
  ArchitectureLayer,
  AnalysisReport,
  ReportFormat,
  FileHotspot,
  HotspotReport,
  McpToolDefinition,
} from './types.js';
