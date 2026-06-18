import { expect, test } from 'vitest';
import '../../src/types/evidencePack.js';
import type {
  EvidencePackArtifact,
  EvidencePackArtifactStatus,
  EvidencePackPrCommentValidation,
  EvidencePackPrCommentValidationCheck,
  EvidencePackPrSummary,
  EvidencePackReport,
  EvidencePackTeamRoute,
  EvidencePackTopRisk,
  EvidencePackTrustCalibration,
  EvidencePackVerdict,
} from '../../src/types/evidencePack.js';
import type {
  EvidencePackArtifact as BarrelEvidencePackArtifact,
  EvidencePackArtifactStatus as BarrelEvidencePackArtifactStatus,
  EvidencePackPrCommentValidation as BarrelEvidencePackPrCommentValidation,
  EvidencePackPrCommentValidationCheck as BarrelEvidencePackPrCommentValidationCheck,
  EvidencePackPrSummary as BarrelEvidencePackPrSummary,
  EvidencePackReport as BarrelEvidencePackReport,
  EvidencePackTeamRoute as BarrelEvidencePackTeamRoute,
  EvidencePackTopRisk as BarrelEvidencePackTopRisk,
  EvidencePackTrustCalibration as BarrelEvidencePackTrustCalibration,
  EvidencePackVerdict as BarrelEvidencePackVerdict,
} from '../../src/types.js';

const verdict: EvidencePackVerdict = 'caution';
const artifactStatus: EvidencePackArtifactStatus = 'ready';

const artifact: EvidencePackArtifact = {
  id: 'ep-type-surface',
  title: 'Public type surface',
  status: artifactStatus,
  summary: 'EvidencePack public types compile from a focused module.',
  evidence: ['module import', 'legacy barrel import'],
  commands: ['npm run typecheck'],
};

const topRisk: EvidencePackTopRisk = {
  priority: 'p1',
  title: 'Preserve EvidencePack public type exports',
  files: ['src/types.ts', 'src/types/evidencePack.ts'],
  owner: '@platform-team',
  command: 'npm run typecheck',
};

const teamRoute: EvidencePackTeamRoute = {
  owner: '@platform-team',
  files: topRisk.files,
  reason: 'Public API compatibility review.',
};

const trust: EvidencePackTrustCalibration = {
  verdict: 'manual_review',
  summary: 'Public type extraction needs compatibility evidence.',
  concreteBlockers: [],
  manualReviewSignals: ['type surface moved into a focused module'],
  watchSignals: ['legacy barrel compatibility'],
};

const prSummary: EvidencePackPrSummary = {
  verdictLabel: 'Manual review',
  decision: 'Review public type compatibility before release.',
  trust,
  topRisks: [topRisk],
  teamRoutes: [teamRoute],
  ownershipSuggestion: '@platform-team',
  fixFirst: {
    id: 'evidence-pack-types',
    title: topRisk.title,
    source: 'quality-scorecard',
    priority: topRisk.priority,
    whyFirst: 'Public API drift would break downstream TypeScript users.',
    files: topRisk.files,
    owner: topRisk.owner,
    commands: [topRisk.command],
    expected: 'EvidencePack types compile from module and barrel imports.',
  },
  nextCommands: [topRisk.command],
  baselineTrend: {
    scoreDirection: 'flat',
    scoreDelta: 0,
    riskDirection: 'flat',
    riskDelta: 0,
    qualityScoreBefore: 100,
    qualityScoreAfter: 100,
    newIssueCount: 0,
    resolvedIssueCount: 0,
    changedSinceBaseline: ['src/types/evidencePack.ts'],
    newHotspots: [],
    recurringNoisyRules: [],
    summary: 'Public type extraction preserved the EvidencePack baseline trend shape.',
  },
};

const validationCheck: EvidencePackPrCommentValidationCheck = {
  id: 'required-sections',
  status: 'pass',
  summary: 'The generated PR comment includes required sections.',
};

const validation: EvidencePackPrCommentValidation = {
  status: 'pass',
  checks: [validationCheck],
};

const report: EvidencePackReport = {
  schemaVersion: 1,
  currentVersion: '4.4.0',
  readOnly: true,
  verdict,
  summary: 'EvidencePack public contracts compile from module and barrel imports.',
  train: {
    lines: ['4.4.x'],
    readiness: {
      verdict: 'caution',
      blockers: 0,
      cautions: 1,
      summary: 'Public type compatibility review.',
      action: {
        kind: 'review-cautions',
        label: 'Review readiness cautions',
        command: 'projscan preflight --mode before_merge --format json',
        detail: '1 caution(s) need review before approval.',
      },
    },
  },
  approval: {
    required: true,
    recommendation: 'Review type compatibility evidence before approving.',
    blockingReasons: [],
  },
  artifacts: [artifact],
  changelogEntries: ['Extract EvidencePack public types into a focused module.'],
  websitePrompt: 'projscan_evidence_pack',
  prComment: '### Reviewer Decision',
  prCommentValidation: validation,
  prSummary,
  suggestedNextActions: [
    {
      label: 'Typecheck EvidencePack public types',
      command: topRisk.command,
      tool: 'typecheck',
    },
  ],
};

const barrelVerdict: BarrelEvidencePackVerdict = verdict;
const barrelArtifactStatus: BarrelEvidencePackArtifactStatus = artifactStatus;
const barrelArtifact: BarrelEvidencePackArtifact = artifact;
const barrelTopRisk: BarrelEvidencePackTopRisk = topRisk;
const barrelTeamRoute: BarrelEvidencePackTeamRoute = teamRoute;
const barrelTrust: BarrelEvidencePackTrustCalibration = trust;
const barrelPrSummary: BarrelEvidencePackPrSummary = prSummary;
const barrelValidationCheck: BarrelEvidencePackPrCommentValidationCheck = validationCheck;
const barrelValidation: BarrelEvidencePackPrCommentValidation = validation;
const barrelReport: BarrelEvidencePackReport = report;

void [
  barrelVerdict,
  barrelArtifactStatus,
  barrelArtifact,
  barrelTopRisk,
  barrelTeamRoute,
  barrelTrust,
  barrelPrSummary,
  barrelValidationCheck,
  barrelValidation,
];

test('evidence pack public types compile from the module and legacy barrel', () => {
  expect(barrelReport).toBe(report);
});
