export { scanRepository } from './core/repositoryScanner.js';
export { detectLanguages } from './core/languageDetector.js';
export { detectFrameworks } from './core/frameworkDetector.js';
export { analyzeDependencies } from './core/dependencyAnalyzer.js';
export { collectIssues } from './core/issueEngine.js';
export { analyzeHotspots, computeRiskScore } from './core/hotspotAnalyzer.js';
export { computeAssess } from './core/assess.js';
export {
  createBaseframeAssessment,
  type CreateBaseframeAssessmentOptions,
} from './core/baseframeAssessment.js';
export { computeSimulation } from './core/simulate.js';
export { computeProve } from './core/prove.js';
export { computePassport } from './core/passport.js';
export { computeProofBroker } from './core/proofBroker.js';
export { computeReviewGate } from './core/reviewGate.js';
export { computeGuard } from './core/guard.js';
export { inspectFile } from './core/fileInspector.js';
export {
  buildImportGraph,
  toPackageName,
  isPackageUsed,
  filesImporting,
} from './core/importGraph.js';
export { detectOutdated } from './core/outdatedDetector.js';
export { runAudit, auditFindingsToIssues } from './core/auditRunner.js';
export { previewUpgrade, isValidPackageName } from './core/upgradePreview.js';
export { parseCoverage, coverageMap } from './core/coverageParser.js';
export { joinCoverageWithHotspots } from './core/coverageJoin.js';
export { parseSource, isParseable, type FunctionInfo } from './core/ast.js';
export {
  buildCodeGraph,
  incrementallyUpdateGraph,
  filesImportingFile,
  filesImportingPackage,
  filesDefiningSymbol,
  exportsOf,
  importsOf,
  importersOf,
  type CodeGraph,
  type GraphFile,
} from './core/codeGraph.js';
export { startWatcher, type WatchEvent, type WatchOptions, type WatchHandle } from './core/watcher.js';
export { loadCachedGraph, saveCachedGraph, invalidateCache } from './core/indexCache.js';
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
  buildChunks,
  type SemanticChunk,
} from './core/semanticSearch.js';
export { findDependencyLines } from './utils/packageJsonLocator.js';
export {
  parse as parseSemver,
  compare as compareSemver,
  drift as semverDrift,
} from './utils/semver.js';
export { walkFiles } from './utils/fileWalker.js';
export { loadConfig, applyConfigToIssues } from './utils/config.js';
export { getChangedFiles } from './utils/changedFiles.js';
export { issuesToSarif } from './reporters/sarifReporter.js';
export { buildSemanticGraph } from './core/semanticGraph.js';
export { computeDataflow, type DataflowOptions } from './core/dataflow.js';
export { computeGraphCorpus } from './core/graphCorpus.js';
