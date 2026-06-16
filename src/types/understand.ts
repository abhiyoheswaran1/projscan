import type { WorkplanPriority } from './workplan.js';

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
