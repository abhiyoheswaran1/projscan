// === Scanning Results ===

export interface ScanResult {
  rootPath: string;
  totalFiles: number;
  totalDirectories: number;
  files: FileEntry[];
  directoryTree: DirectoryNode;
  scanDurationMs: number;
  scanBoundary: ScanBoundary;
}

export interface ScanBoundary {
  source: 'git' | 'glob';
  gitignoreRespected: boolean;
  includeIgnored: boolean;
  ignoredFileCount: number;
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
  licenses?: DependencyLicenseSummary;
  sizes?: DependencySizeSummary;
  /**
   * Per-workspace breakdown when scanning a monorepo (0.13.0+). Absent for
   * single-package repos. The top-level `totalDependencies`,
   * `totalDevDependencies`, `dependencies`, `devDependencies`, and `risks`
   * fields aggregate across all workspaces (root manifest + each package).
   * For per-package detail, read this array.
   */
  byWorkspace?: Array<{
    workspace: string;
    relativePath: string;
    isRoot: boolean;
    totalDependencies: number;
    totalDevDependencies: number;
    risks: DependencyRisk[];
  }>;
}

export interface DependencyLicenseEntry {
  name: string;
  version: string;
  scope: 'production' | 'development';
  license: string | null;
  workspace?: string;
}

export interface DependencyLicenseSummary {
  packages: DependencyLicenseEntry[];
  byLicense: Record<string, number>;
  unknown: string[];
  copyleft: DependencyLicenseEntry[];
  noticeCandidates: DependencyLicenseEntry[];
}

export interface DependencySizeEntry {
  name: string;
  version: string;
  scope: 'production' | 'development';
  bytes: number | null;
  formatted: string;
  installed: boolean;
  workspace?: string;
}

export interface DependencySizeSummary {
  packages: DependencySizeEntry[];
  largest: DependencySizeEntry[];
  totalBytes: number;
  formattedTotal: string;
  missing: string[];
}

export interface DependencyRisk {
  name: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  /** Workspace package name when found in a monorepo workspace manifest. Absent for the root. */
  workspace?: string;
}

// === Issues / Health ===

export type IssueSeverity = 'info' | 'warning' | 'error';

export interface IssueLocation {
  file: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  category: string;
  fixAvailable: boolean;
  fixId?: string;
  locations?: IssueLocation[];
  /**
   * One-line hint shown inline in projscan_doctor output (0.14.0+). Points
   * at the fix-suggest pipeline. Absent when no template matches the issue.
   */
  suggestedAction?: { summary: string };
}

// === Fix Suggest (0.14) ===

/**
 * Structured action prompt the agent can paste into its plan. Returned by
 * projscan_fix_suggest. projscan does not run an LLM - this is rule-driven
 * guidance with the issue, the location, and a one-paragraph instruction
 * the agent (LLM) is expected to act on.
 */
export interface FixSuggestion {
  /** Echoes the input issue id when matched. */
  issueId: string;
  /** Severity level passed through from the source issue. */
  severity: IssueSeverity;
  /** Issue category passed through. */
  category: string;
  /** One-line "what is wrong". */
  headline: string;
  /** 2-4 sentences of why this matters. Severity-anchored. */
  why: string;
  /** Affected locations (mirrors Issue.locations when known). */
  where: IssueLocation[];
  /** One-paragraph instruction for the driving agent. */
  instruction: string;
  /** Optional "verify the fix by..." note. */
  suggestedTest?: string;
  /** Optional related files (importers, peer rules) for context. */
  relatedFiles?: string[];
  /** Optional documentation links. */
  references?: string[];
}

/**
 * Markdown-rendered deep dive for a single issue. Returned by
 * projscan_explain_issue. Includes the surrounding code excerpt and any
 * git-log evidence of similar fixes already merged in this repo.
 */
export interface IssueExplanation {
  issueId: string;
  title: string;
  severity: IssueSeverity;
  category: string;
  headline: string;
  /** Source-code excerpt around the primary location. Empty when no location. */
  excerpt: { file: string; startLine: number; endLine: number; lines: string[] } | null;
  /** Other open issues touching the same file (id + title pairs). */
  relatedIssues: Array<{ id: string; title: string }>;
  /**
   * Git log references where this issue id (or its rule prefix) appears in a
   * commit message - hints at how teammates have addressed it before.
   * Empty when none found or git history unavailable.
   */
  similarFixes: Array<{ sha: string; subject: string; date: string }>;
  /** The full FixSuggestion if a template matched; null otherwise. */
  fix: FixSuggestion | null;
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

// === Agent Preflight (2.1) ===

export type PreflightMode = 'before_edit' | 'before_commit' | 'before_merge';

export type PreflightVerdict = 'proceed' | 'caution' | 'block';

export type PreflightReasonSource =
  | 'doctor'
  | 'review'
  | 'taint'
  | 'session'
  | 'plugin'
  | 'supply-chain'
  | 'memory'
  | 'changed-files'
  | 'hotspots'
  | 'git'
  | 'format'
  | 'release'
  | 'coordination';

export interface PreflightReason {
  severity: IssueSeverity;
  source: PreflightReasonSource;
  message: string;
  file?: string;
  issueId?: string;
  tool?: string;
}

export interface PreflightRequiredCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'unavailable';
  reason?: string;
}

export interface PreflightSuggestedAction {
  label: string;
  command?: string;
  tool?: string;
  args?: Record<string, unknown>;
}

export interface PreflightReleaseScaleEvidence {
  detected: boolean;
  changedFiles: number;
  threshold: number;
  reviewVerdict?: ReviewReport['verdict'];
  reviewSummary?: string;
  concreteBlockers: string[];
  explanation: string;
}

export interface PreflightEvidence {
  health?: {
    score: number;
    grade: HealthScore['grade'];
    errors: number;
    warnings: number;
    infos: number;
  };
  changedFiles?: {
    available: boolean;
    count: number;
    files: string[];
    reason?: string;
  };
  review?: {
    available: boolean;
    verdict?: ReviewReport['verdict'];
    summary?: string;
    reason?: string;
  };
  session?: {
    kind?: 'remembered-session';
    id: string;
    touchedFiles: string[];
    totalTouchedFiles?: number;
    eventCount: number;
    note?: string;
    truncated?: boolean;
  };
  riskSources?: {
    currentWorktree: {
      kind: 'current-worktree';
      available: boolean;
      count: number;
      files: string[];
      baseRef: string | null;
      reason?: string;
    };
    sessionMemory: {
      kind: 'remembered-session';
      id: string;
      touchedFiles: string[];
      totalTouchedFiles: number;
      eventCount: number;
      note: string;
      truncated?: boolean;
    };
  };
  hotspots?: {
    touched: Array<{ file: string; riskScore: number }>;
  };
  plugins?: {
    enabled: boolean;
    errorIssues: number;
    warningIssues: number;
  };
  supplyChain?: {
    errorIssues: number;
    warningIssues: number;
  };
  releaseScale?: PreflightReleaseScaleEvidence;
  coordination?: {
    available: boolean;
    readiness: 'clear' | 'caution' | 'conflicted';
    worktreeCount: number;
    collisions: { high: number; medium: number };
    contendedClaims: number;
  };
}

export interface PreflightReport {
  schemaVersion: 1;
  mode: PreflightMode;
  verdict: PreflightVerdict;
  summary: string;
  reasons: PreflightReason[];
  evidence: PreflightEvidence;
  requiredChecks: PreflightRequiredCheck[];
  suggestedNextActions: PreflightSuggestedAction[];
  toolCalls: PreflightSuggestedAction[];
  truncated?: boolean;
}

// === Agent Workplan (2.3) ===

export type WorkplanMode =
  | PreflightMode
  | 'refactor'
  | 'release'
  | 'bug_hunt'
  | 'hardening';

export type WorkplanPriority = 'p0' | 'p1' | 'p2';

export interface WorkplanEvidence {
  source: PreflightReasonSource | 'coordination' | 'release' | 'verification' | 'graph';
  message: string;
  severity?: IssueSeverity;
  file?: string;
  issueId?: string;
  tool?: string;
}

export interface WorkplanVerification {
  commands: string[];
  expected: string;
}

export interface FixFirstRecommendation {
  id: string;
  title: string;
  source: string;
  priority: WorkplanPriority;
  whyFirst: string;
  files: string[];
  owner?: string;
  commands: string[];
  expected?: string;
}

export interface WorkplanTask {
  id: string;
  priority: WorkplanPriority;
  title: string;
  why: string;
  evidence: WorkplanEvidence[];
  files: string[];
  owner?: string;
  suggestedTools: string[];
  verification: WorkplanVerification;
  handoffText: string;
}

export interface WorkplanTopRisk extends WorkplanEvidence {
  priority: WorkplanPriority;
  owner?: string;
}

export interface WorkplanCoordination {
  touchedFiles: string[];
  conflicts: SessionConflict[];
  recommendedNextAgent: string;
}

export interface WorkplanReport {
  schemaVersion: 1;
  mode: WorkplanMode;
  verdict: PreflightVerdict;
  summary: string;
  topRisks: WorkplanTopRisk[];
  tasks: WorkplanTask[];
  fixFirst?: FixFirstRecommendation;
  coordination: WorkplanCoordination;
  suggestedNextActions: PreflightSuggestedAction[];
  truncated?: boolean;
}

// === Product Planning / Bug Hunt / Readiness (2.3+) ===

export interface ReleaseTrainTrack {
  line: string;
  theme: string;
  outcome: string;
  includedInPlan: boolean;
  scope: string[];
  successCriteria: string[];
}

export interface ReleaseTrainTask {
  id: string;
  priority: WorkplanPriority;
  title: string;
  why: string;
  track: string;
  files: string[];
  verification: WorkplanVerification;
}

export interface ReleaseTrainReport {
  schemaVersion: 1;
  currentVersion: string | null;
  plan: {
    policy: 'product-readiness-plan';
    lines: string[];
    readOnly: true;
  };
  readiness: {
    verdict: PreflightVerdict;
    blockers: number;
    cautions: number;
    summary: string;
  };
  tracks: ReleaseTrainTrack[];
  tasks: ReleaseTrainTask[];
  suggestedNextActions: PreflightSuggestedAction[];
}

export type BugHuntVerdict = 'clean' | 'fix' | 'block';

export interface BugHuntFinding {
  id: string;
  priority: WorkplanPriority;
  source: 'doctor' | 'preflight' | 'session' | 'hotspot' | 'verification';
  title: string;
  why: string;
  files: string[];
  evidence: WorkplanEvidence[];
  suggestedTools: string[];
  verification: WorkplanVerification;
}

export interface BugHuntReport {
  schemaVersion: 1;
  verdict: BugHuntVerdict;
  summary: string;
  health: HealthScore;
  evidence: {
    issueCounts: {
      errors: number;
      warnings: number;
      infos: number;
    };
    hotspotCount: number;
    preflightVerdict: PreflightVerdict;
    touchedFiles: string[];
    conflicts: number;
  };
  topSuspects: BugHuntFinding[];
  fixQueue: BugHuntFinding[];
  fixFirst?: FixFirstRecommendation;
  verificationMatrix: Array<{ command: string; reason: string; expected: string }>;
  truncated?: boolean;
}

export type EvidencePackVerdict = 'ready' | 'caution' | 'blocked';
export type EvidencePackArtifactStatus = 'ready' | 'caution' | 'blocked';

export interface EvidencePackArtifact {
  id: string;
  title: string;
  status: EvidencePackArtifactStatus;
  summary: string;
  evidence: string[];
  commands: string[];
}

export interface EvidencePackTopRisk {
  priority: WorkplanPriority;
  title: string;
  files: string[];
  owner?: string;
  command: string;
}

export interface EvidencePackTeamRoute {
  owner: string;
  files: string[];
  reason: string;
}

export interface EvidencePackTrustCalibration {
  verdict: 'clean' | 'manual_review' | 'actual_defect';
  summary: string;
  concreteBlockers: string[];
  manualReviewSignals: string[];
  watchSignals: string[];
}

export interface EvidencePackPrSummary {
  verdictLabel: string;
  decision: string;
  trust: EvidencePackTrustCalibration;
  topRisks: EvidencePackTopRisk[];
  teamRoutes: EvidencePackTeamRoute[];
  ownershipSuggestion?: string;
  fixFirst?: FixFirstRecommendation;
  nextCommands: string[];
  baselineTrend?: BaselineTrend;
}

export interface EvidencePackPrCommentValidationCheck {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  summary: string;
}

export interface EvidencePackPrCommentValidation {
  status: 'pass' | 'warn' | 'fail';
  checks: EvidencePackPrCommentValidationCheck[];
}

export interface EvidencePackReport {
  schemaVersion: 1;
  currentVersion: string | null;
  readOnly: true;
  verdict: EvidencePackVerdict;
  summary: string;
  train: {
    lines: string[];
    readiness: ReleaseTrainReport['readiness'];
  };
  approval: {
    required: true;
    recommendation: string;
    blockingReasons: string[];
  };
  artifacts: EvidencePackArtifact[];
  changelogEntries: string[];
  websitePrompt?: string;
  prComment?: string;
  prCommentValidation?: EvidencePackPrCommentValidation;
  prSummary?: EvidencePackPrSummary;
  suggestedNextActions: PreflightSuggestedAction[];
}

export type RegressionPlanLevel = 'smoke' | 'focused' | 'full';
export type RegressionPlanVerdict = 'ready' | 'needs_tests' | 'blocked';

export interface RegressionPlanTarget {
  id: string;
  priority: WorkplanPriority;
  source: 'baseline' | 'bug-hunt' | 'product-line' | 'preflight';
  title: string;
  why: string;
  files: string[];
  verification: WorkplanVerification;
}

export interface RegressionPlanReport {
  schemaVersion: 1;
  level: RegressionPlanLevel;
  verdict: RegressionPlanVerdict;
  summary: string;
  releaseLines: string[];
  evidence: {
    healthScore: number;
    bugHuntVerdict: BugHuntVerdict;
    preflightVerdict: PreflightVerdict;
    changedFiles: number;
    touchedFiles: number;
  };
  targets: RegressionPlanTarget[];
  commands: string[];
  suggestedNextActions: PreflightSuggestedAction[];
  truncated?: boolean;
}

export type AgentBriefIntent = 'next_agent' | 'bug_hunt' | 'release' | 'refactor' | 'hardening';

export interface AgentBriefItem {
  id: string;
  priority: WorkplanPriority;
  title: string;
  why: string;
  files: string[];
  commands: string[];
}

export interface AgentBriefGuardrail {
  id: string;
  label: string;
  reason: string;
  command: string;
}

export interface GraphEvidenceSummary {
  schemaVersion: 1;
  changedFiles?: number;
  changedFunctions?: number;
  totalFunctions: number;
  totalPackages: number;
  totalCallEdges: number;
  dataflowRisks: number;
  topPackages: string[];
}

export interface AgentBriefReport {
  schemaVersion: 1;
  intent: AgentBriefIntent;
  summary: string;
  health: HealthScore;
  context: {
    totalFiles: number;
    totalDirectories: number;
    topDirectories: Array<{ directory: string; files: number }>;
    touchedFiles: string[];
    conflicts: number;
    graph?: GraphEvidenceSummary;
    coordinationHints: SessionCoordinationHint[];
  };
  focus: AgentBriefItem[];
  guardrails: AgentBriefGuardrail[];
  suggestedNextActions: PreflightSuggestedAction[];
  truncated?: boolean;
}


export interface WorkplanHandoffPayload {
  summary: string;
  verdict: PreflightVerdict;
  mode: WorkplanMode;
  next: string[];
  verificationCommands: string[];
  coordination: WorkplanCoordination;
  markdown: string;
}

export interface StartWorkflowRecommendation {
  id: string;
  name: string;
  why: string;
  commands: string[];
  mcpTools: string[];
}

export interface StartRisk {
  id: string;
  priority: WorkplanPriority;
  title: string;
  source: string;
  files: string[];
  command: string;
}

export interface StartAdoptionGap {
  id: string;
  status: 'info' | 'warn' | 'fail';
  title: string;
  summary: string;
  command?: string;
}

export interface StartAdoptionLoopMetric {
  id: string;
  label: string;
  target: string;
  command?: string;
}

export interface StartAdoptionLoop {
  cadence: 'every_pr';
  why: string;
  metrics: StartAdoptionLoopMetric[];
  nextCommands: string[];
}

export interface StartFirstTenMinutesStep {
  id: string;
  label: string;
  why: string;
  command: string;
}

export interface StartFirstTenMinutes {
  title: string;
  outcome: string;
  commands: StartFirstTenMinutesStep[];
}

export type StartModeSource = 'explicit' | 'intent' | 'default';

export type StartMissionControlStatus = 'ready' | 'needs_setup' | 'needs_attention' | 'blocked';

export interface StartRoutedIntent {
  intent: string;
  category: string;
  tool: string;
  cli: string;
  why: string;
  example: string;
  confidence: 'high' | 'medium' | 'low';
  rank: number;
  score: number;
  matchedKeywords: string[];
}

export interface StartUnresolvedInput {
  name: string;
  placeholder: string;
  sourceAction: string;
  instruction: string;
}

export interface StartMissionResumeReference {
  id: string;
  phaseId: StartExecutionPhaseId;
  kind: StartExecutionStepKind;
  status: StartExecutionStatus;
  label: string;
  instruction?: string;
  command?: string;
  placeholder?: string;
}

export interface StartMissionToolCall {
  tool: string;
  args?: Record<string, unknown>;
}

export interface StartMissionInputBinding {
  inputId: string;
  label: string;
  placeholder: string;
  instruction: string;
  followUpIds: string[];
}

export interface StartMissionResumeFollowUp {
  id: string;
  phaseId: StartExecutionPhaseId;
  kind: StartExecutionStepKind;
  status: StartExecutionStatus;
  label: string;
  command?: string;
  tool?: string;
  args?: Record<string, unknown>;
  blockedBy?: string[];
  dependsOn?: string[];
}

export interface StartMissionResume {
  currentStep: StartExecutionCursor;
  status: StartExecutionStatus;
  instruction: string;
  prompt: string;
  commandBlock?: string;
  toolCall?: StartMissionToolCall;
  followUps?: StartMissionResumeFollowUp[];
  inputBindings?: StartMissionInputBinding[];
  unlocks?: StartMissionResumeReference[];
  blockedBy?: StartMissionResumeReference[];
}

export interface StartMissionHandoff {
  currentStep: StartExecutionCursor;
  resume: StartMissionResume;
  nextAction: PreflightSuggestedAction;
  readyActions: PreflightSuggestedAction[];
  needsInput: StartUnresolvedInput[];
  doneWhen: string[];
  readyProof: {
    summary: string;
    commands: string[];
  };
}

export type StartExecutionPhaseId = 'next_action' | 'ready_now' | 'resolve_inputs' | 'follow_up' | 'proof' | 'done_when';

export type StartExecutionStatus = 'ready' | 'blocked' | 'pending';

export type StartExecutionStepKind = 'tool' | 'input' | 'proof' | 'criterion' | 'handoff';

export interface StartExecutionStep {
  id: string;
  kind: StartExecutionStepKind;
  status: StartExecutionStatus;
  label: string;
  command?: string;
  tool?: string;
  args?: Record<string, unknown>;
  instruction?: string;
  placeholder?: string;
  dependsOn?: string[];
  blockedBy?: string[];
  unlocks?: string[];
}

export interface StartExecutionPhase {
  id: StartExecutionPhaseId;
  title: string;
  status: StartExecutionStatus;
  steps: StartExecutionStep[];
}

export interface StartExecutionCursor {
  phaseId: StartExecutionPhaseId;
  stepId: string;
  status: StartExecutionStatus;
  kind: StartExecutionStepKind;
  label: string;
  command?: string;
  instruction?: string;
  placeholder?: string;
  blockedBy?: string[];
  unlocks?: string[];
  reason: string;
}

export interface StartExecutionPlan {
  summary: string;
  currentPhase: StartExecutionPhaseId;
  cursor: StartExecutionCursor;
  phases: StartExecutionPhase[];
}

export interface StartMissionRunbook {
  title: string;
  status: StartMissionControlStatus;
  currentPhase: StartExecutionPhaseId;
  currentStep: StartExecutionCursor;
  resume: StartMissionResume;
  readyCommandBlock: string;
  blockedInputSummary?: string;
  markdown: string;
}

export interface StartMissionControl {
  intent?: string;
  status: StartMissionControlStatus;
  headline: string;
  whyNow: string;
  primaryAction: PreflightSuggestedAction;
  actionPlan: PreflightSuggestedAction[];
  readyActions: PreflightSuggestedAction[];
  routedIntent?: StartRoutedIntent;
  alternatives?: StartRoutedIntent[];
  unresolvedInputs: StartUnresolvedInput[];
  guardrails: PreflightSuggestedAction[];
  successCriteria: string[];
  proofSummary: string;
  proofCommands: string[];
  resume: StartMissionResume;
  handoff: StartMissionHandoff;
  executionPlan: StartExecutionPlan;
  runbook: StartMissionRunbook;
  handoffPrompt: string;
}

export interface StartReport {
  schemaVersion: 1;
  readOnly: true;
  rootPath: string;
  mode: WorkplanMode;
  modeSource: StartModeSource;
  modeReason: string;
  summary: string;
  setup: {
    overall: 'pass' | 'warn' | 'fail' | 'info';
    diagnostics: Array<{ id: string; label: string; status: 'pass' | 'warn' | 'fail' | 'info'; summary: string; detail?: string; command?: string }>;
  };
  recommendedWorkflow: StartWorkflowRecommendation;
  firstTenMinutes: StartFirstTenMinutes;
  missionControl: StartMissionControl;
  coordinationHints: SessionCoordinationHint[];
  evidence: {
    workplanVerdict: PreflightVerdict;
    workplanSummary: string;
    qualityVerdict: QualityScorecardVerdict;
    qualitySummary: string;
    healthScore: number;
    mcpReady: boolean;
    riskSources: {
      currentWorktree: {
        kind: 'current-worktree';
        available: boolean;
        count: number;
        files: string[];
        baseRef: string | null;
        reason?: string;
      };
      sessionMemory: {
        kind: 'remembered-session';
        touchedFiles: string[];
        totalTouchedFiles: number;
        note: string;
        truncated?: boolean;
      };
    };
  };
  topRisks: StartRisk[];
  fixFirst?: FixFirstRecommendation;
  adoptionGaps: StartAdoptionGap[];
  adoptionLoop?: StartAdoptionLoop;
  nextActions: PreflightSuggestedAction[];
  handoff?: WorkplanHandoffPayload;
  truncated?: boolean;
}

export type DogfoodRepoStatus = 'pass' | 'warn' | 'fail';

export interface DogfoodFeedbackResponse {
  repo?: string;
  pr?: string;
  reviewer?: string;
  useful?: boolean;
  minutesSaved?: number;
  preventedBadEdit?: boolean;
  ownerRoutingClear?: boolean;
  nextCommandClear?: boolean;
  falsePositiveRules?: string[];
  missingSignals?: string[];
  noisyFindings?: string[];
  note?: string;
}

export interface DogfoodFeedbackInput {
  schemaVersion?: 1;
  questions?: string[];
  responses: DogfoodFeedbackResponse[];
}

export interface FeedbackTemplateResult extends DogfoodFeedbackInput {
  schemaVersion: 1;
  path: string;
  createdAt: string;
  instructions: string[];
}

export interface FeedbackSummaryReport {
  schemaVersion: 1;
  path: string;
  responses: number;
  usefulResponses: number;
  distinctRepos: number;
  distinctPrs: number;
  minutesSaved: {
    total: number;
    average: number;
    max: number;
  };
  preventedBadEdits: number;
  ownerRoutingClear: number;
  nextCommandClear: number;
  repeatUse: {
    distinctPrs: number;
    repeatedRepos: number;
    requiredDistinctPrs: number;
    requiredRepeatedRepos: number;
    ready: boolean;
  };
  falsePositive: {
    totalReports: number;
    noisyRules: Array<{ rule: string; count: number }>;
    missingSignals: Array<{ signal: string; count: number }>;
    noisyFindings: Array<{ finding: string; count: number }>;
  };
  nextDogfoodCommand: string;
}

export interface DogfoodRepoValidation {
  feedbackResponses: number;
  usefulResponses: number;
  prRefs: string[];
  minutesSaved: number;
  preventedBadEdits: number;
  ownerRoutingClear: number;
  nextCommandClear: number;
  falsePositiveRules: string[];
  missingSignals: string[];
  noisyFindings: string[];
}

export interface DogfoodWebsiteProof {
  headline: string;
  metrics: string[];
  bullets: string[];
  markdown: string;
}

export interface DogfoodMarketValidation {
  status: 'proven' | 'needs_feedback' | 'needs_more_repos' | 'needs_tuning';
  summary: string;
  proofGates: Array<{
    id: 'repo-coverage' | 'reviewer-feedback' | 'useful-feedback' | 'repeat-use' | 'measured-value' | 'false-positive-balance';
    status: 'pass' | 'fail';
    summary: string;
    command: string;
  }>;
  nextProofStep: string;
  repoCoverage: {
    target: number;
    evaluated: number;
    targetMet: boolean;
  };
  feedback: {
    responses: number;
    usefulResponses: number;
    usefulnessRate: number;
    preventedBadEdits: number;
    ownerRoutingClear: number;
    nextCommandClear: number;
    minutesSaved: {
      total: number;
      average: number;
      max: number;
    };
  };
  falsePositive: {
    totalReports: number;
    noisyRules: Array<{ rule: string; count: number }>;
    missingSignals: Array<{ signal: string; count: number }>;
    noisyFindings: Array<{ finding: string; count: number }>;
  };
  firstPr: {
    readyRepos: number;
    repeatUseReadyRepos: number;
    requiredFeedbackQuestions: string[];
  };
  value: {
    averageMinutesSaved: number;
    requiredAverageMinutesSaved: number;
    preventedBadEdits: number;
    ready: boolean;
  };
  repeatUse: {
    distinctPrs: number;
    repeatedRepos: number;
    requiredDistinctPrs: number;
    requiredRepeatedRepos: number;
    ready: boolean;
  };
  websiteProof: DogfoodWebsiteProof;
}

export interface DogfoodRepoResult {
  path: string;
  name: string;
  status: DogfoodRepoStatus;
  healthScore: number;
  mcpReady: boolean;
  prCommentReady: boolean;
  repeatUseReady: boolean;
  verdict: EvidencePackVerdict;
  gaps: string[];
  feedbackQuestions: string[];
  validation: DogfoodRepoValidation;
  nextCommands: string[];
}

export interface DogfoodReport {
  schemaVersion: 1;
  readOnly: true;
  rootPath: string;
  targetRepoCount: number;
  summary: string;
  repos: DogfoodRepoResult[];
  totals: {
    reposEvaluated: number;
    passingRepos: number;
    warningRepos: number;
    failingRepos: number;
    prCommentReady: number;
    repeatUseReady: number;
    mcpReady: number;
    usefulFeedback: number;
    minutesSaved: number;
    preventedBadEdits: number;
    falsePositiveReports: number;
  };
  marketValidation: DogfoodMarketValidation;
  suggestedNextActions: PreflightSuggestedAction[];
}

export type TrialVerdict = 'adopt' | 'pilot' | 'tune' | 'setup';

export interface TrialReport {
  schemaVersion: 1;
  readOnly: true;
  rootPath: string;
  verdict: TrialVerdict;
  summary: string;
  activation: {
    status: 'pass' | 'warn' | 'fail';
    setupOverall: 'pass' | 'warn' | 'fail';
    healthScore: number;
    mcpReady: boolean;
    adoptionLoopReady: boolean;
    firstPrCommand: string;
    feedbackCommand: string;
  };
  feedback?: FeedbackSummaryReport;
  dogfood: DogfoodReport;
  decision: {
    adoptable: boolean;
    reasons: string[];
  };
  websiteProof: DogfoodWebsiteProof;
  nextCommands: PreflightSuggestedAction[];
}

export interface GraphCorpusFixtureMetrics {
  name: string;
  fixture: string;
  files: number;
  functions: number;
  packages: number;
  symbols: number;
  importEdges: number;
  callEdges: number;
  dataflowRisks: number;
}

export interface GraphCorpusReport {
  schemaVersion: 1;
  fixtures: GraphCorpusFixtureMetrics[];
  totals: Omit<GraphCorpusFixtureMetrics, 'name' | 'fixture'>;
}

export type QualityScorecardVerdict = 'excellent' | 'healthy' | 'needs_attention' | 'blocked';
export type QualityScorecardStatus = 'pass' | 'watch' | 'fail';

export interface QualityScorecardDimension {
  id: 'health' | 'security' | 'tests' | 'maintainability' | 'coordination';
  label: string;
  status: QualityScorecardStatus;
  score: number;
  summary: string;
  evidence: string[];
  commands: string[];
}

export interface QualityScorecardRisk {
  id: string;
  priority: WorkplanPriority;
  title: string;
  files: string[];
  source: 'issue' | 'hotspot' | 'coordination';
  command: string;
}

export interface QualityScorecardReport {
  schemaVersion: 1;
  verdict: QualityScorecardVerdict;
  summary: string;
  health: HealthScore;
  dimensions: QualityScorecardDimension[];
  topRisks: QualityScorecardRisk[];
  fixFirst?: FixFirstRecommendation;
  commands: string[];
  suggestedNextActions: PreflightSuggestedAction[];
  truncated?: boolean;
}


// === Understand (3.4) ===

export type UnderstandView = 'map' | 'flow' | 'contracts' | 'change' | 'verify';

export interface UnderstandCitation {
  file: string;
  symbol?: string;
  line?: number;
  reason: string;
}

export interface UnderstandClaim {
  id: string;
  title: string;
  detail: string;
  confidence: 'low' | 'medium' | 'high';
  citations: UnderstandCitation[];
}

export interface UnderstandEntrypoint {
  file: string;
  kind: 'cli' | 'server' | 'route' | 'package-export' | 'test' | 'script' | 'module';
  symbols: string[];
  why: string;
  citations: UnderstandCitation[];
}

export interface UnderstandBoundary {
  name: string;
  files: number;
  publicExports: string[];
  dependsOn: string[];
  citations: UnderstandCitation[];
}

export interface UnderstandFlowSideEffect {
  kind: 'database' | 'filesystem' | 'network' | 'process' | 'env' | 'unknown';
  label: string;
  files: string[];
  citations: UnderstandCitation[];
}

export interface UnderstandFlow {
  id: string;
  label: string;
  entry: UnderstandEntrypoint;
  path: string[];
  sideEffects: UnderstandFlowSideEffect[];
  confidence: 'low' | 'medium' | 'high';
  citations: UnderstandCitation[];
}

export interface UnderstandPublicExport {
  name: string;
  file: string;
  kind: 'package' | 'symbol';
  citations: UnderstandCitation[];
}

export interface UnderstandConfigContract {
  name: string;
  file: string;
  kind: 'env' | 'package-script' | 'config-file';
  required: boolean;
  citations: UnderstandCitation[];
}

export interface UnderstandBreakingChangeRisk {
  id: string;
  title: string;
  files: string[];
  why: string;
  command: string;
}

export interface UnderstandContracts {
  publicExports: UnderstandPublicExport[];
  configContracts: UnderstandConfigContract[];
  breakingChangeRisks: UnderstandBreakingChangeRisk[];
}

export interface UnderstandChangeReadiness {
  intent: string;
  blastRadius: Array<{ label: string; files: string[]; why: string; command: string }>;
  safeEdit: { title: string; files: string[]; command: string; why: string };
  owners: Array<{ owner: string; files: string[]; reason: string }>;
  rollback: { command: string; why: string };
  verificationCommands: string[];
}

export interface UnderstandVerificationTier {
  id: 'minimal' | 'focused' | 'full';
  label: string;
  commands: string[];
  when: string;
}

export interface UnderstandDirectTest {
  file: string;
  tests: string[];
  confidence: 'none' | 'low' | 'medium' | 'high';
}

export interface UnderstandVerification {
  tiers: UnderstandVerificationTier[];
  directTests: UnderstandDirectTest[];
  gaps: Array<{ file: string; reason: string; command: string }>;
}

export interface UnderstandReadFirst {
  file: string;
  why: string;
  command: string;
  citations: UnderstandCitation[];
}

export interface UnderstandRisk {
  id: string;
  priority: WorkplanPriority;
  title: string;
  files: string[];
  why: string;
  command: string;
}

export interface UnderstandUnknown {
  id: string;
  question: string;
  whyUnknown: string;
  command: string;
}

export interface UnderstandReport {
  schemaVersion: 1;
  view: UnderstandView;
  rootPath: string;
  intent?: string;
  summary: string;
  claims: UnderstandClaim[];
  entrypoints: UnderstandEntrypoint[];
  boundaries: UnderstandBoundary[];
  flows: UnderstandFlow[];
  contracts: UnderstandContracts;
  changeReadiness: UnderstandChangeReadiness;
  verification: UnderstandVerification;
  readFirst: UnderstandReadFirst[];
  risks: UnderstandRisk[];
  unknowns: UnderstandUnknown[];
  commands: string[];
  truncated?: boolean;
}

export interface SessionCoordinationHint {
  id: 'current-worktree-check' | 'remembered-session-context' | 'resolve-conflicts' | 'swarm-coordination';
  label: string;
  message: string;
  command: string;
}

export interface SessionResourceSummary {
  schemaVersion: 1;
  sessionId: string;
  touchedFiles: string[];
  recentIssues: Issue[];
  highRiskTouchedFiles: Array<{ file: string; riskScore: number }>;
  staleSignals: string[];
  coordinationHints: SessionCoordinationHint[];
  truncated?: boolean;
}

export interface SessionConflict {
  kind: 'same-file' | 'import-related' | 'same-workspace' | 'taint-related' | 'hotspot-overlap';
  files: string[];
  message: string;
  severity: 'warning' | 'error';
}

export interface SessionHandoff {
  schemaVersion: 1;
  summary: SessionResourceSummary;
  remainingRisks: SessionConflict[];
  suggestedNextActions: PreflightSuggestedAction[];
  coordinationHints: SessionCoordinationHint[];
  avoidRepeating: string[];
}

export interface RiskNowResource {
  schemaVersion: 1;
  conflicts: SessionConflict[];
  touchedFiles: string[];
  coordinationHints: SessionCoordinationHint[];
  truncated?: boolean;
}

export interface PluginTestResult {
  schemaVersion: 1;
  manifestPath: string;
  ok: boolean;
  diagnostics: Array<{ code: string; severity: IssueSeverity; message: string }>;
  trust: {
    localOnly: true;
    previewFlag: 'PROJSCAN_PLUGINS_PREVIEW=1';
    reminder: string;
  };
  commands: {
    validate: string;
    test: string;
    execute: string;
    enable: string;
  };
  execution: {
    requested: boolean;
    executed: boolean;
    mode: 'static' | 'execute';
    note: string;
  };
  context: {
    requested: boolean;
    capabilities: Array<'semanticGraph' | 'dataflow'>;
    note: string;
  };
  analyzer?: { issues: Issue[] };
  reporter?: { outputs: Array<{ command: string; text: string }> };
}

export interface ReviewContractChange {
  kind:
    | 'export-added'
    | 'export-removed'
    | 'export-renamed'
    | 'entrypoint-changed'
    | 'public-export-changed'
    | 'signature-changed';
  file: string;
  symbol?: string;
  before?: string;
  after?: string;
  confidence: 'high' | 'medium' | 'low';
  why: string;
}

// === Baseline / Diff ===

export interface BaselineHotspot {
  relativePath: string;
  riskScore: number;
  churn: number;
}

export interface Baseline {
  score: number;
  grade: HealthScore['grade'];
  issues: { id: string; title: string; severity: IssueSeverity }[];
  hotspots?: BaselineHotspot[];
  issueRuleCounts?: Record<string, number>;
  timestamp: string;
}

export interface HotspotDelta {
  relativePath: string;
  beforeScore: number | null;
  afterScore: number | null;
  scoreDelta: number;
}

export interface HotspotDiffSummary {
  rose: HotspotDelta[];
  fell: HotspotDelta[];
  appeared: HotspotDelta[];
  resolved: HotspotDelta[];
}

export interface BaselineRecurringRule {
  id: string;
  before: number;
  after: number;
}

export interface BaselineTrend {
  scoreDirection: 'up' | 'down' | 'flat';
  scoreDelta: number;
  riskDirection?: 'up' | 'down' | 'flat';
  riskDelta?: number;
  qualityScoreBefore?: number;
  qualityScoreAfter?: number;
  newIssueCount?: number;
  resolvedIssueCount?: number;
  changedSinceBaseline?: string[];
  newHotspots: string[];
  recurringNoisyRules: BaselineRecurringRule[];
  summary: string;
}

export interface DiffResult {
  before: Baseline;
  after: Baseline;
  scoreDelta: number;
  newIssues: string[];
  resolvedIssues: string[];
  hotspotDiff?: HotspotDiffSummary;
  trend: BaselineTrend;
}

// === Reporter Interface ===

export type ReportFormat = 'console' | 'json' | 'markdown' | 'sarif' | 'html';

// === Dependency Health (0.4.0) ===

export type SemverDrift = 'patch' | 'minor' | 'major' | 'same' | 'unknown';

export interface OutdatedPackage {
  name: string;
  declared: string;
  installed: string | null;
  latest: string | null;
  drift: SemverDrift;
  scope: 'dependency' | 'devDependency';
  /** Workspace package this dep was declared in. Empty/undefined when not a monorepo. */
  workspace?: string;
}

export interface OutdatedReport {
  available: boolean;
  reason?: string;
  totalPackages: number;
  packages: OutdatedPackage[];
  /** Per-workspace breakdown when scanning a monorepo. Empty for single-package repos. */
  byWorkspace?: Array<{ workspace: string; relativePath: string; total: number }>;
}

export type AuditSeverity = 'critical' | 'high' | 'moderate' | 'low' | 'info';

export interface AuditFinding {
  name: string;
  severity: AuditSeverity;
  title: string;
  url?: string;
  cve?: string[];
  via: string[];
  range?: string;
  fixAvailable: boolean;
}

export interface AuditReport {
  available: boolean;
  reason?: string;
  summary: Record<AuditSeverity, number>;
  findings: AuditFinding[];
}

export interface UpgradePreview {
  available: boolean;
  reason?: string;
  name: string;
  declared: string | null;
  installed: string | null;
  latest: string | null;
  drift: SemverDrift;
  breakingMarkers: string[];
  changelogExcerpt?: string;
  importers: string[];
  /**
   * 1.3+ — set when `previewUpgrade` was called with `checkRegistry: true`.
   * "registry" if the latest came from npm; "installed" if we fell back to
   * the locally-installed version (either offline mode or a registry fetch
   * that failed). Absent when no registry attempt was made.
   */
  latestSource?: 'registry' | 'installed';
  /** 1.3+ — set when a registry fetch was attempted and failed. */
  registryError?: string;
}

// === Coverage (0.5.0) ===

export type CoverageSource = 'lcov' | 'coverage-final' | 'coverage-summary';

export interface FileCoverage {
  relativePath: string;
  lineCoverage: number;
  linesFound: number;
  linesHit: number;
}

export interface CoverageReport {
  available: boolean;
  reason?: string;
  source: CoverageSource | null;
  sourceFile: string | null;
  totalCoverage: number;
  files: FileCoverage[];
}

export interface CoverageJoinedHotspot {
  relativePath: string;
  riskScore: number;
  churn: number;
  lineCount: number;
  issueCount: number;
  coverage: number | null;
  priority: number;
  reasons: string[];
}

export interface CoverageJoinedReport {
  available: boolean;
  reason?: string;
  coverageSource: CoverageSource | null;
  coverageSourceFile: string | null;
  entries: CoverageJoinedHotspot[];
}

// === Config (.projscanrc) ===

export interface ProjscanConfig {
  minScore?: number;
  baseRef?: string;
  hotspots?: {
    limit?: number;
    since?: string;
  };
  ignore?: string[];
  scan?: {
    includeIgnored?: boolean;
    scanEnvValues?: boolean;
    offline?: boolean;
  };
  disableRules?: string[];
  severityOverrides?: Record<string, IssueSeverity>;
  /**
   * Monorepo-specific configuration (0.14.0+). Currently scopes the
   * cross-package import policy: each entry says "package P may only import
   * from these listed packages, or specifically may NOT import from these
   * listed packages." Edges that violate become `cross-package-violation-*`
   * issues in projscan_doctor.
   */
  monorepo?: {
    importPolicy?: ImportPolicyRule[];
  };
  /**
   * Taint analysis tuning (1.6.0+). Both lists merge ON TOP of the
   * built-in defaults — they don't replace them. Use this to add
   * project-specific source/sink names: `customSecretReader`, `query`,
   * `runRawSql`, etc. To suppress a default, list the rule id under
   * `disableRules` (e.g. `taint-flow-detected`).
   */
  taint?: {
    sources?: string[];
    sinks?: string[];
  };
}

/**
 * One cross-package import rule. `from` is the package name (matches
 * WorkspacePackage.name). Exactly one of `allow` / `deny` is required. Both
 * lists are package-name globs - a leading `!` negates a single entry, and a
 * single `*` is the wildcard. When both `allow` and `deny` are set, allow
 * is checked first and a hit short-circuits as ALLOWED; otherwise deny is
 * checked.
 */
export interface ImportPolicyRule {
  from: string;
  allow?: string[];
  deny?: string[];
}

export interface LoadedConfig {
  config: ProjscanConfig;
  source: string | null;
}

// === Hotspots ===

export interface AuthorShare {
  author: string;
  commits: number;
  share: number;
}

export interface FileHotspot {
  relativePath: string;
  churn: number;
  distinctAuthors: number;
  daysSinceLastChange: number | null;
  lineCount: number;
  /** AST-derived McCabe complexity. null when no language adapter parsed this file. */
  cyclomaticComplexity: number | null;
  sizeBytes: number;
  issueCount: number;
  issueIds: string[];
  riskScore: number;
  reasons: string[];
  primaryAuthor: string | null;
  primaryAuthorShare: number;
  busFactorOne: boolean;
  topAuthors: AuthorShare[];
  coverage?: number | null;
  /**
   * 1.5+ — true when Project Memory has marked this file as
   * "accepted load-bearing debt" (top-K hotspot for ≥ 5 runs over
   * ≥ 7 days without CC/churn improving). The reporter tags accepted
   * rows so users aren't repeatedly pestered about debt they've
   * implicitly opted into. Absent on older saves / fresh runs.
   */
  accepted?: boolean;
}

export interface HotspotReport {
  available: boolean;
  reason?: string;
  window: { since: string | null; commitsScanned: number };
  hotspots: FileHotspot[];
  totalFilesRanked: number;
}

// === Coupling + Cycles (0.11) ===

export interface FileCoupling {
  relativePath: string;
  /** Number of files that import this one. */
  fanIn: number;
  /** Number of locally-resolved imports this file makes. */
  fanOut: number;
  /** Bob Martin's instability: fanOut / (fanIn + fanOut). 0 when both are zero. */
  instability: number;
}

export interface ImportCycle {
  /** Member files of a strongly-connected component (size >= 2). */
  files: string[];
  size: number;
}

export interface CrossPackageEdge {
  /** Importing file + the workspace package it belongs to. */
  from: { file: string; package: string };
  /** Imported file + the workspace package it belongs to. */
  to: { file: string; package: string };
}

export interface CouplingReport {
  files: FileCoupling[];
  cycles: ImportCycle[];
  /**
   * Edges where importer and imported live in different workspace packages
   * (0.11). Empty when no workspace info was supplied or when all edges are
   * intra-package. Useful for spotting unauthorized deep imports across
   * package boundaries.
   */
  crossPackageEdges: CrossPackageEdge[];
  totalFiles: number;
  totalCycles: number;
  totalCrossPackageEdges: number;
}

// === Monorepo / Workspaces (0.13) ===

export type WorkspaceKind = 'npm' | 'yarn' | 'pnpm' | 'nx' | 'turbo' | 'lerna' | 'none';

export interface WorkspacePackage {
  /** package.json `name` field, or directory basename when missing. */
  name: string;
  /** Workspace-relative path of the package root (no leading `/`, no trailing `/`). */
  relativePath: string;
  /** package.json `version` if available. */
  version?: string;
  /** True when this is the workspace root itself. */
  isRoot: boolean;
}

export interface WorkspaceInfo {
  kind: WorkspaceKind;
  /** All packages, including the root if it has its own package.json. */
  packages: WorkspacePackage[];
  /** Source manifest used to discover packages, e.g. "package.json#workspaces" or "pnpm-workspace.yaml". */
  source?: string;
}

// === PR-Native AST Diff (0.12) ===

export interface ExportRename {
  from: string;
  to: string;
}

export interface FileAstDiff {
  relativePath: string;
  status: 'added' | 'removed' | 'modified';
  exportsAdded: string[];
  exportsRemoved: string[];
  /**
   * Heuristically-detected renames (0.11). When an export disappears from
   * base AND a similar new name appears in head AND no other export matches,
   * we report it here instead of as a +/- pair. Removed/added lists exclude
   * any names that ended up in renames.
   */
  exportsRenamed: ExportRename[];
  importsAdded: string[];
  importsRemoved: string[];
  callsAdded: string[];
  callsRemoved: string[];
  /** CC(head) - CC(base). null when either side wasn't AST-parsed. */
  cyclomaticDelta: number | null;
  /** fanIn(head) - fanIn(base). null when graph entry missing on either side. */
  fanInDelta: number | null;
}

export interface PrDiffReport {
  available: boolean;
  reason?: string;
  base: { ref: string; resolvedSha: string | null };
  head: { ref: string; resolvedSha: string | null };
  filesAdded: string[];
  filesRemoved: string[];
  filesModified: FileAstDiff[];
  totalFilesChanged: number;
}

// === Semantic Graph + Dataflow (3.0) ===

export type SemanticGraphNodeKind = 'file' | 'function' | 'package' | 'symbol';

export interface SemanticGraphNode {
  id: string;
  kind: SemanticGraphNodeKind;
  label: string;
  file?: string;
  line?: number;
  endLine?: number;
  adapterId?: string;
  metrics?: {
    lineCount?: number;
    cyclomaticComplexity?: number;
    fanIn?: number;
    fanOut?: number;
  };
}

export type SemanticGraphEdgeKind = 'defines' | 'imports' | 'imports_package' | 'exports' | 'calls';

export interface SemanticGraphEdge {
  from: string;
  to: string;
  kind: SemanticGraphEdgeKind;
  label?: string;
}

export interface SemanticGraphReport {
  schemaVersion: 3;
  nodes: SemanticGraphNode[];
  edges: SemanticGraphEdge[];
  metrics: {
    totalFiles: number;
    totalFunctions: number;
    totalPackages: number;
    totalSymbols: number;
    totalEdges: number;
  };
  truncated: boolean;
  limits: {
    maxNodes: number;
    maxEdges: number;
  };
}

export type DataflowRiskKind = 'direct' | 'propagated' | 'bridge';
export type DataflowRiskSeverity = 'warning' | 'error';
export type DataflowRiskConfidence = 'low' | 'medium' | 'high';

export interface DataflowRisk {
  key: string;
  kind: DataflowRiskKind;
  severity: DataflowRiskSeverity;
  confidence: DataflowRiskConfidence;
  sourceFn: string;
  sinkFn: string;
  bridgeFn?: string;
  source: string;
  sink: string;
  path: string[];
  sourcePath?: string[];
  sinkPath?: string[];
  pathLength: number;
  files: string[];
}

export interface DataflowReport {
  available: boolean;
  reason?: string;
  riskCount: number;
  risks: DataflowRisk[];
  effectiveSources: string[];
  effectiveSinks: string[];
  truncated?: boolean;
  truncatedSources?: string[];
  maxDepth?: number;
}

// === PR Review (0.13) ===

/**
 * One changed file enriched with risk signals. The agent calling
 * projscan_review uses these to decide which files need careful review.
 */
export interface ReviewFile {
  relativePath: string;
  status: 'added' | 'removed' | 'modified';
  /** Hotspot risk score for the head version. null when file isn't in the hotspot scope. */
  riskScore: number | null;
  /** Cyclomatic complexity at head. null when no AST adapter parsed it. */
  cyclomaticComplexity: number | null;
  /** Delta from the structural diff (mirrors FileAstDiff.cyclomaticDelta). null when file was added/removed. */
  cyclomaticDelta: number | null;
  /** Number of exports added in this PR. */
  exportsAdded: number;
  /** Number of exports removed in this PR. */
  exportsRemoved: number;
  /** Number of imports added. */
  importsAdded: number;
  /** Number of imports removed. */
  importsRemoved: number;
  /** 1.9+ — set when `projscan_review` was called with an `intent` arg. Absent otherwise. */
  intentAlignment?: 'expected' | 'unexpected' | 'out-of-scope' | 'unknown';
}

/**
 * A circular import that exists at head and either didn't exist at base or
 * grew. Surfaced separately from the file list so reviewers see at-a-glance
 * whether the PR introduces new architectural debt.
 */
export interface ReviewCycle {
  files: string[];
  size: number;
  /**
   * 'new' = no overlap with any base cycle; 'expanded' = at least one new
   * file added to an existing cycle.
   */
  classification: 'new' | 'expanded';
  /** 1.9+ — set when `projscan_review` was called with an `intent` arg. Absent otherwise. */
  intentAlignment?: 'expected' | 'unexpected' | 'out-of-scope' | 'unknown';
}

/**
 * A function whose CC newly crossed a worry threshold (>= 10) at head, or
 * was added with high CC, or jumped by 5+ since base.
 */
export interface ReviewFunction {
  file: string;
  name: string;
  line: number;
  endLine: number;
  cyclomaticComplexity: number;
  /** CC at base. null when the function did not exist at base. */
  baseCc: number | null;
  /** Why this function shows up. */
  reason: 'added' | 'jumped' | 'crossed-threshold';
  /** 1.9+ — set when `projscan_review` was called with an `intent` arg. Absent otherwise. */
  intentAlignment?: 'expected' | 'unexpected' | 'out-of-scope' | 'unknown';
}

/**
 * 1.6+ — A taint flow that is NEW at head (not present at base). Mirrors
 * the core TaintFlow shape but is intentionally light — review summaries
 * should be readable in a glance, so we drop the per-step file list and
 * keep only the source/sink, the function pair, and the path length.
 */
export interface ReviewTaintFlow {
  sourceFn: string;
  sinkFn: string;
  source: string;
  sink: string;
  /** Hop count from source function to sink function, inclusive of both ends. */
  pathLength: number;
  /** First and last files in the path; same value when length = 1. */
  files: string[];
  /** 1.9+ — set when `projscan_review` was called with an `intent` arg. Absent otherwise. */
  intentAlignment?: 'expected' | 'unexpected' | 'out-of-scope' | 'unknown';
}

/**
 * 3.0+ — Review-time dataflow risks that are not represented by legacy
 * taint reachability, especially bridge helpers that call both a source
 * wrapper and a sink wrapper.
 */
export interface ReviewDataflowRisk {
  kind: DataflowRiskKind;
  sourceFn: string;
  sinkFn: string;
  bridgeFn?: string;
  source: string;
  sink: string;
  pathLength: number;
  files: string[];
  severity: DataflowRiskSeverity;
  confidence: DataflowRiskConfidence;
  intentAlignment?: 'expected' | 'unexpected' | 'out-of-scope' | 'unknown';
}

/** Workspace-package-scoped dependency change. Aggregates root + workspaces. */
export interface ReviewDependencyChange {
  /** Workspace name; '' for the root manifest. */
  workspace: string;
  manifestFile: string;
  added: Array<{ name: string; version: string; kind: 'dep' | 'dev' }>;
  removed: Array<{ name: string; version: string; kind: 'dep' | 'dev' }>;
  bumped: Array<{ name: string; from: string; to: string; kind: 'dep' | 'dev' }>;
  /** 1.9+ — set when `projscan_review` was called with an `intent` arg. Absent otherwise. */
  intentAlignment?: 'expected' | 'unexpected' | 'out-of-scope' | 'unknown';
}

/**
 * 1.5+ — `projscan_review` can shape its response at three tiers based
 * on a `max_cost_tokens` budget passed by the caller: full (no budget
 * or large budget), summary (3K-7K tokens), verdict-only (<3K).
 * Selected by `selectReviewTier` and surfaced as the `tier` field on
 * the response.
 */
export type ReviewTier = 'full' | 'summary' | 'verdict-only';

export interface ReviewReport {
  available: boolean;
  reason?: string;
  base: { ref: string; resolvedSha: string | null };
  head: { ref: string; resolvedSha: string | null };
  /** The structural diff (same shape as projscan_pr_diff). */
  prDiff: PrDiffReport;
  /** Each changed file annotated with risk + CC + delta. Sorted by risk desc. */
  changedFiles: ReviewFile[];
  /** Cycles introduced or expanded by this PR. Empty when none. */
  newCycles: ReviewCycle[];
  /** Functions that meaningfully grew or were added with high CC. Sorted by CC desc. */
  riskyFunctions: ReviewFunction[];
  /** package.json deltas across root + workspaces. */
  dependencyChanges: ReviewDependencyChange[];
  /**
   * 2.1+ — additive public contract changes such as export and package
   * entrypoint changes. Empty or absent when no contract signal is available.
   */
  contractChanges?: ReviewContractChange[];
  /**
   * 1.6+ — NEW source-to-sink taint flows introduced by this PR. Each
   * entry is a flow that exists at head but didn't exist at base
   * (matched by sourceFn + sinkFn pair). Empty when taint is unavailable
   * (no per-function callSites at either side).
   */
  newTaintFlows: ReviewTaintFlow[];
  /**
   * 3.0+ — NEW dataflow risks introduced by this PR that are outside the
   * legacy source-to-sink taint flow list. Empty when unavailable or clean.
   */
  newDataflowRisks: ReviewDataflowRisk[];
  /** 3.5+ — compact graph/dataflow evidence for review consumers. */
  graphEvidence?: GraphEvidenceSummary;
  /** 'ok' = ship it; 'review' = needs careful look; 'block' = strongly suggests rework. */
  verdict: 'ok' | 'review' | 'block';
  /** One-line bullets explaining the verdict. */
  summary: string[];
  /**
   * 1.5+ — which tier this report was shaped at. Absent when the full
   * report is returned without budget shaping.
   */
  tier?: ReviewTier;
  /**
   * 1.9+ — the parsed intent the agent passed (if any). Echo of the
   * raw string + the parser's classified action + extracted scope
   * tokens. Absent when `intent` arg wasn't provided.
   */
  intent?: {
    raw: string;
    action: 'feature' | 'fix' | 'refactor' | 'perf' | 'test' | 'docs' | 'chore' | 'remove' | 'unknown';
    scopeTokens: string[];
  };
  /**
   * 1.9+ — per-alignment totals across all findings + a small sample
   * of "notable" (unexpected / out-of-scope) findings. Absent when
   * no intent was provided. Verdict is NOT affected by intent —
   * verdict stays structural.
   */
  intentAnalysis?: {
    totals: Record<'expected' | 'unexpected' | 'out-of-scope' | 'unknown', number>;
    notable: Array<{
      kind: 'file' | 'function' | 'cycle' | 'taint' | 'dataflow' | 'dependency';
      label: string;
      alignment: 'expected' | 'unexpected' | 'out-of-scope' | 'unknown';
      reason: string;
    }>;
  };
}

// === Impact / Reachability (0.15) ===

/**
 * One reachable file in an impact analysis. `distance` is BFS-hops from the
 * input target (1 = direct dependent, 2 = dependent-of-dependent, etc).
 * `target` itself is not included in the reachable list.
 */
export interface ImpactNode {
  file: string;
  distance: number;
  /**
   * 1.6+ — name of the registered repo that contains this file.
   * Present only when `cross_repo: true` was passed and the file
   * lives outside the source repo. Absent for in-repo entries.
   */
  repo?: string;
}

export interface ImpactBoundarySummary {
  repo: string;
  packageName: string;
  owner: string;
  files: string[];
  reachableFiles: number;
}

export interface ImpactReport {
  available: boolean;
  reason?: string;
  /** What was queried. */
  target: { kind: 'file' | 'symbol'; value: string };
  /**
   * For symbol mode: every file the graph claims defines the symbol. Empty
   * for file mode. Useful when an agent needs to know whether a name is
   * defined in multiple places before treating impact as authoritative.
   */
  definitionFiles: string[];
  /**
   * For symbol mode: files that directly call the symbol (their callSites
   * contains the name). The reachable set is computed from these as roots.
   * Empty for file mode.
   */
  directCallers: string[];
  /** Sorted by distance asc, then file asc. */
  reachable: ImpactNode[];
  /** Convenience count of reachable files (== reachable.length). */
  totalReachable: number;
  /**
   * 1.6+ — when cross-repo expansion ran, this is the per-repo
   * breakdown of reachable file counts. Absent when `cross_repo`
   * was false or the workspace had no siblings.
   */
  totalReachableByRepo?: Record<string, number>;
  /** 3.5+ — cross-repo package/ownership boundaries that mention the target. */
  boundarySummary?: ImpactBoundarySummary[];
  /**
   * True when traversal hit `maxDistance` before exhausting the graph.
   * Items beyond the limit are omitted from `reachable`.
   */
  truncated: boolean;
  /** The maxDistance value used for the traversal. */
  maxDistance: number;
}

// === Per-file Inspection ===

export interface FileInspection {
  relativePath: string;
  exists: boolean;
  reason?: string;
  purpose: string;
  lineCount: number;
  sizeBytes: number;
  imports: ImportInfo[];
  exports: ExportInfo[];
  potentialIssues: string[];
  hotspot: FileHotspot | null;
  issues: Issue[];
  /** AST-derived McCabe complexity. null when no language adapter parsed this file. */
  cyclomaticComplexity?: number | null;
  /** Number of files that import this one. null when graph unavailable. */
  fanIn?: number | null;
  /** Number of locally-resolved imports this file makes. null when graph unavailable. */
  fanOut?: number | null;
  /** Adapter id (e.g. 'javascript', 'python'). Set when the graph was available. */
  language?: string;
  /**
   * Per-function McCabe CC (0.13.0+). Sorted by cyclomaticComplexity desc.
   * Empty array when the file has no functions or the adapter doesn't yet
   * support per-function granularity.
   */
  functions?: FunctionDetail[];
}

/**
 * Per-function CC entry exposed via projscan_file. Mirrors the internal
 * `FunctionInfo` from `core/ast.ts` but is part of the stable API surface.
 */
export interface FunctionDetail {
  name: string;
  /** 1-based start line. */
  line: number;
  /** 1-based end line. */
  endLine: number;
  cyclomaticComplexity: number;
  /**
   * Approximate fan-in (0.15.0+): count of other files whose `callSites`
   * include this function's bare name. Name-based and approximate; absent
   * when the graph couldn't compute it.
   */
  fanIn?: number;
}

// === MCP ===

/**
 * A reversible deprecation marker (3.8 deprecation pass). Present on a tool
 * means "still works, but slated for removal in 4.0 — prefer `replacedBy`".
 */
export interface ToolDeprecation {
  /** Version the deprecation was announced in (e.g. "3.8.0"). */
  since: string;
  /** The recommended replacement (tool name for MCP, invocation for CLI). */
  replacedBy: string;
  /** Optional one-line rationale shown to humans/agents. */
  note?: string;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Set when the tool is deprecated and scheduled for removal in 4.0. */
  deprecated?: ToolDeprecation;
}

export interface McpPromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

export interface McpPromptDefinition {
  name: string;
  description: string;
  arguments?: McpPromptArgument[];
}

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}
