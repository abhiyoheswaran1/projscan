import { describe, expect, it } from 'vitest';
import { CLI_COMMAND_REGISTRARS, registerCliCommands } from '../../src/cli/registerCommands.js';

const expectedRegistrarOrder = [
  'registerAnalyze',
  'registerDoctor',
  'registerCi',
  'registerDiff',
  'registerFix',
  'registerFile',
  'registerDiagram',
  'registerStructure',
  'registerDependencies',
  'registerHotspots',
  'registerCoupling',
  'registerPrDiff',
  'registerReview',
  'registerFixSuggest',
  'registerExplainIssue',
  'registerImpact',
  'registerCollision',
  'registerClaim',
  'registerMergeRisk',
  'registerRoute',
  'registerCoordinate',
  'registerWatch',
  'registerWorkspaces',
  'registerOutdated',
  'registerAudit',
  'registerUpgrade',
  'registerSearch',
  'registerCoverage',
  'registerSemanticGraph',
  'registerMcp',
  'registerSession',
  'registerMemory',
  'registerWorkspace',
  'registerApplyFix',
  'registerInit',
  'registerInstallHook',
  'registerTaint',
  'registerDataflow',
  'registerBadge',
  'registerPlugin',
  'registerPreflight',
  'registerWorkplan',
  'registerReleaseTrain',
  'registerBugHunt',
  'registerEvidencePack',
  'registerDogfood',
  'registerFeedback',
  'registerRegressionPlan',
  'registerAgentBrief',
  'registerQualityScorecard',
  'registerAssess',
  'registerSimulate',
  'registerProve',
  'registerPassport',
  'registerGuard',
  'registerStart',
  'registerTrial',
  'registerTelemetry',
  'registerPrivacyCheck',
  'registerUnderstand',
  'registerMissionProof',
  'registerRecipes',
  'registerFirstRun',
  'registerHelp',
];

describe('CLI command registration', () => {
  it('keeps the startup registrar order explicit', () => {
    expect(CLI_COMMAND_REGISTRARS.map((registrar) => registrar.name)).toEqual(
      expectedRegistrarOrder,
    );
  });

  it('runs command registrars in order', () => {
    const calls: string[] = [];
    const registrars = [
      () => calls.push('first'),
      () => calls.push('second'),
      () => calls.push('third'),
    ];

    registerCliCommands(registrars);

    expect(calls).toEqual(['first', 'second', 'third']);
  });
});
