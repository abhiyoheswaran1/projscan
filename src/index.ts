export { scanRepository } from './core/repositoryScanner.js';
export { detectLanguages } from './core/languageDetector.js';
export { detectFrameworks } from './core/frameworkDetector.js';
export { analyzeDependencies } from './core/dependencyAnalyzer.js';
export { collectIssues } from './core/issueEngine.js';
export { analyzeHotspots, computeRiskScore } from './core/hotspotAnalyzer.js';
export { inspectFile } from './core/fileInspector.js';
export { walkFiles } from './utils/fileWalker.js';
export { loadConfig, applyConfigToIssues } from './utils/config.js';
export { getChangedFiles } from './utils/changedFiles.js';
export { issuesToSarif } from './reporters/sarifReporter.js';
export { createMcpServer, runMcpServer } from './mcp/server.js';
export { getToolDefinitions } from './mcp/tools.js';
export { getPromptDefinitions } from './mcp/prompts.js';
export { getResourceDefinitions } from './mcp/resources.js';

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
  IssueLocation,
  IssueSeverity,
  Fix,
  FixResult,
  FileExplanation,
  FileInspection,
  ImportInfo,
  ExportInfo,
  ArchitectureLayer,
  AnalysisReport,
  ReportFormat,
  FileHotspot,
  HotspotReport,
  AuthorShare,
  BaselineHotspot,
  HotspotDelta,
  HotspotDiffSummary,
  McpToolDefinition,
  McpPromptDefinition,
  McpResourceDefinition,
  ProjscanConfig,
  LoadedConfig,
} from './types.js';
