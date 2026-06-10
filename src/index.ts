export { scanRepository } from './core/repositoryScanner.js';
export { detectLanguages } from './core/languageDetector.js';
export { detectFrameworks } from './core/frameworkDetector.js';
export { analyzeDependencies } from './core/dependencyAnalyzer.js';
export { collectIssues } from './core/issueEngine.js';
export { analyzeHotspots, computeRiskScore } from './core/hotspotAnalyzer.js';
export { inspectFile } from './core/fileInspector.js';
export { buildImportGraph, toPackageName, isPackageUsed, filesImporting } from './core/importGraph.js';
export { detectOutdated } from './core/outdatedDetector.js';
export { runAudit, auditFindingsToIssues } from './core/auditRunner.js';
export { previewUpgrade, isValidPackageName } from './core/upgradePreview.js';
export { parseCoverage, coverageMap } from './core/coverageParser.js';
export { joinCoverageWithHotspots } from './core/coverageJoin.js';
export { parseSource, isParseable } from './core/ast.js';
export type { FunctionInfo } from './core/ast.js';
export {
  buildCodeGraph,
  incrementallyUpdateGraph,
  filesImportingFile,
  filesImportingPackage,
  filesDefiningSymbol,
  exportsOf,
  importsOf,
  importersOf,
} from './core/codeGraph.js';
export { startWatcher } from './core/watcher.js';
export type { WatchEvent, WatchOptions, WatchHandle } from './core/watcher.js';
export { loadCachedGraph, saveCachedGraph, invalidateCache } from './core/indexCache.js';
export { applyBudget, estimateTokens } from './mcp/tokenBudget.js';
export { paginate, encodeCursor, decodeCursor, listChecksum, readPageParams } from './mcp/pagination.js';
export { toContentBlocks } from './mcp/chunker.js';
export { emitProgress, withProgress } from './mcp/progress.js';
export {
  buildSearchIndex,
  search,
  tokenize,
  expandQuery,
  attachExcerpts,
} from './core/searchIndex.js';
export {
  isSemanticAvailable,
  embedText,
  embedBatch,
  cosineSimilarity,
  DEFAULT_MODEL,
  EMBEDDING_DIM,
} from './core/embeddings.js';
export {
  buildSemanticIndex,
  semanticSearch,
  reciprocalRankFusion,
} from './core/semanticSearch.js';
export { findDependencyLines } from './utils/packageJsonLocator.js';
export { parse as parseSemver, compare as compareSemver, drift as semverDrift } from './utils/semver.js';
export { walkFiles } from './utils/fileWalker.js';
export { loadConfig, applyConfigToIssues } from './utils/config.js';
export { getChangedFiles } from './utils/changedFiles.js';
export { issuesToSarif } from './reporters/sarifReporter.js';
export { computeReview } from './core/review.js';
export { buildSemanticGraph } from './core/semanticGraph.js';
export { computeDataflow, type DataflowOptions } from './core/dataflow.js';
export { computeGraphCorpus } from './core/graphCorpus.js';
export { buildWorkplanHandoff, computeWorkplan } from './core/workplan.js';
export { computeReleaseTrain } from './core/releaseTrain.js';
export { computeBugHunt } from './core/bugHunt.js';
export { computeEvidencePack, renderEvidencePackPrComment, validateEvidencePackPrComment } from './core/releaseEvidence.js';
export { computeRegressionPlan } from './core/regressionPlan.js';
export { computeAgentBrief } from './core/agentBrief.js';
export { computeQualityScorecard } from './core/qualityScorecard.js';
export { computeStartReport } from './core/start.js';
export { loadMissionOutcome } from './core/missionOutcome.js';
export { computeMissionProofReport } from './core/missionProof.js';
export {
  loadMissionProofBaseline,
  missionProofBaselineTemplate,
  validateMissionProofBaselineRuns,
} from './core/missionProofBaseline.js';
export { renderMissionProofMarkdown } from './core/missionProofMarkdown.js';
export { renderMissionProofSummary } from './core/missionProofSummary.js';
export { computeDogfoodReport } from './core/dogfood.js';
export { computeTrialReport } from './core/trial.js';
export { addFeedbackResponse, createFeedbackTemplate, readFeedbackFile, summarizeFeedback, summarizeFeedbackFile } from './core/feedback.js';
export {
  buildFeedbackTelemetry,
  disableTelemetry,
  enableTelemetry,
  explainTelemetryPolicy,
  flushTelemetry,
  getTelemetryOptInPrompt,
  getTelemetryStatus,
  recordCommandTelemetry,
  recordFeedbackTelemetry,
} from './core/telemetry.js';
export {
  computeFirstRunDiagnostics,
  computeMcpSetupDoctor,
  getGithubActionStarter,
  getMcpConfigGuide,
  getPolicyStarterKit,
  getWorkflowRecipes,
  isPolicyStarterTeam,
  writeGithubActionStarter,
  writePolicyStarterKit,
  writeTeamStarterKit,
} from './core/adoption.js';
export type {
  AgentWorkflowRecipe,
  FirstRunDiagnostic,
  FirstRunReport,
  McpConfigCatalog,
  McpConfigGuide,
  McpClientId,
  McpSetupDoctorCheck,
  McpSetupDoctorReport,
  TeamStarterKit,
  TeamOnboardingStep,
  WorkflowRecipeCatalog,
  GithubActionStarter,
  PolicyStarterKit,
  PolicyStarterTeam,
  WriteGithubActionStarterResult,
  WritePolicyStarterResult,
} from './core/adoption.js';
export { suggestFixForIssue, previewSuggestionForIssue, syntheticIssue, findIssue } from './core/fixSuggest.js';
export { explainIssue } from './core/explainIssue.js';
export { computeImpact } from './core/impact.js';
export { buildChunks } from './core/semanticSearch.js';
export type { SemanticChunk } from './core/semanticSearch.js';
export { createMcpServer, runMcpServer } from './mcp/server.js';
export { getToolDefinitions } from './mcp/tools.js';
export { getPromptDefinitions } from './mcp/prompts.js';
export { getResourceDefinitions } from './mcp/resources.js';
export { BUILTIN_LANGUAGE_IDS } from './core/languages/LanguageAdapter.js';
export type { BuiltinLanguageId, LanguageId, LanguageAdapter } from './core/languages/LanguageAdapter.js';

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
  FunctionDetail,
  ImportInfo,
  ExportInfo,
  ArchitectureLayer,
  AnalysisReport,
  AgentBriefGuardrail,
  AgentBriefIntent,
  AgentBriefItem,
  AgentBriefReport,
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
  SemverDrift,
  OutdatedPackage,
  OutdatedReport,
  AuditSeverity,
  AuditFinding,
  AuditReport,
  UpgradePreview,
  CoverageSource,
  FileCoverage,
  CoverageReport,
  CoverageJoinedHotspot,
  CoverageJoinedReport,
  ReviewReport,
  ReviewFile,
  ReviewCycle,
  ReviewDataflowRisk,
  ReviewFunction,
  ReviewDependencyChange,
  FixSuggestion,
  IssueExplanation,
  ImportPolicyRule,
  ImpactReport,
  ImpactNode,
  GraphCorpusFixtureMetrics,
  GraphCorpusReport,
  DataflowReport,
  DataflowRisk,
  DataflowRiskConfidence,
  DataflowRiskKind,
  DataflowRiskSeverity,
  SemanticGraphEdge,
  SemanticGraphEdgeKind,
  SemanticGraphNode,
  SemanticGraphNodeKind,
  SemanticGraphReport,
  BugHuntFinding,
  BugHuntReport,
  BugHuntVerdict,
  EvidencePackArtifact,
  EvidencePackArtifactStatus,
  EvidencePackPrCommentValidation,
  EvidencePackPrCommentValidationCheck,
  EvidencePackReport,
  EvidencePackTrustCalibration,
  EvidencePackVerdict,
  RegressionPlanLevel,
  RegressionPlanReport,
  RegressionPlanTarget,
  RegressionPlanVerdict,
  QualityScorecardDimension,
  QualityScorecardReport,
  QualityScorecardRisk,
  QualityScorecardStatus,
  QualityScorecardVerdict,
  StartAdoptionGap,
  StartAdoptionLoop,
  StartAdoptionLoopMetric,
  StartFirstTenMinutes,
  StartFirstTenMinutesStep,
  StartReport,
  StartRisk,
  StartWorkflowRecommendation,
  MissionOutcome,
  MissionProofBaselineRun,
  MissionProofReport,
  MissionProofStatusRow,
  MissionProofTotals,
  MissionReviewDecisionRecord,
  MissionRunStatus,
  DogfoodFeedbackInput,
  DogfoodFeedbackResponse,
  FeedbackSummaryReport,
  FeedbackTemplateResult,
  DogfoodMarketValidation,
  DogfoodReport,
  DogfoodRepoResult,
  DogfoodRepoStatus,
  DogfoodRepoValidation,
  DogfoodWebsiteProof,
  TrialReport,
  TrialVerdict,
  PluginTestResult,
  RiskNowResource,
  SessionCoordinationHint,
  SessionHandoff,
  SessionResourceSummary,
  ReleaseTrainReport,
  ReleaseTrainTask,
  ReleaseTrainTrack,
  WorkplanCoordination,
  WorkplanHandoffPayload,
  WorkplanEvidence,
  WorkplanMode,
  WorkplanPriority,
  WorkplanReport,
  WorkplanTask,
  WorkplanTopRisk,
  WorkplanVerification,
} from './types.js';
