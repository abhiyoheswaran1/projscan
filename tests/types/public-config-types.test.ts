import { expect, test } from 'vitest';
import '../../src/types/config.js';
import type {
  ImportPolicyRule,
  LoadedConfig,
  ProjscanConfig,
  ReportPolicyPreset,
  ReportFormat,
  CiFailOnSeverity,
  ProofRecipeConfig,
} from '../../src/types/config.js';
import type {
  ImportPolicyRule as BarrelImportPolicyRule,
  LoadedConfig as BarrelLoadedConfig,
  ProjscanConfig as BarrelProjscanConfig,
  ReportPolicyPreset as BarrelReportPolicyPreset,
  ReportFormat as BarrelReportFormat,
  CiFailOnSeverity as BarrelCiFailOnSeverity,
  ProofRecipeConfig as BarrelProofRecipeConfig,
} from '../../src/types.js';

const formats: ReportFormat[] = ['console', 'json', 'markdown', 'sarif', 'html'];
const failOn: CiFailOnSeverity = 'warning';

const importPolicy: ImportPolicyRule = {
  from: '@acme/app',
  allow: ['@acme/core', '@acme/shared'],
  deny: ['@acme/legacy'],
};

const reportPolicy: ReportPolicyPreset = {
  reportScope: ['src/api'],
  redactPaths: true,
};

const proofRecipe: ProofRecipeConfig = {
  id: 'billing-critical',
  matches: ['src/billing/**'],
  requiredCommands: ['npm test -- tests/billing/retry.test.ts'],
  requiredReviewers: ['@payments'],
  forbiddenFiles: ['src/auth/**'],
  riskSurface: 'billing',
  reason: 'Billing retry changes need focused payments proof.',
};

const config: ProjscanConfig = {
  minScore: 85,
  failOn,
  baseRef: 'origin/main',
  hotspots: {
    limit: 10,
    since: '30 days ago',
  },
  ignore: ['dist/**'],
  scan: {
    includeIgnored: false,
    scanEnvValues: false,
    offline: true,
  },
  disableRules: ['taint-*'],
  suppress: {
    'hardcoded-secret': ['src/firebase.ts'],
  },
  severityOverrides: {
    'demo-warning': 'warning',
  },
  reportPolicies: {
    apiEvidence: reportPolicy,
  },
  proofRecipes: [proofRecipe],
  monorepo: {
    importPolicy: [importPolicy],
  },
  taint: {
    sources: ['readSecret'],
    sinks: ['sendNetwork'],
  },
};

const loaded: LoadedConfig = {
  config,
  source: '.projscanrc.json',
};

const barrelFormat: BarrelReportFormat = 'json';
const barrelFailOn: BarrelCiFailOnSeverity = failOn;
const barrelPolicy: BarrelImportPolicyRule = importPolicy;
const barrelReportPolicy: BarrelReportPolicyPreset = reportPolicy;
const barrelProofRecipe: BarrelProofRecipeConfig = proofRecipe;
const barrelConfig: BarrelProjscanConfig = config;
const barrelLoaded: BarrelLoadedConfig = loaded;
const moduleLoaded: LoadedConfig = barrelLoaded;

test('config public types compile from the module and legacy barrel', () => {
  expect(formats).toEqual(['console', 'json', 'markdown', 'sarif', 'html']);
  expect(barrelFormat).toBe('json');
  expect(barrelFailOn).toBe('warning');
  expect(barrelPolicy.from).toBe('@acme/app');
  expect(barrelReportPolicy.redactPaths).toBe(true);
  expect(barrelProofRecipe.requiredReviewers).toEqual(['@payments']);
  expect(barrelConfig.scan?.offline).toBe(true);
  expect(barrelConfig.proofRecipes?.[0]?.id).toBe('billing-critical');
  expect(barrelConfig.suppress?.['hardcoded-secret']).toEqual(['src/firebase.ts']);
  expect(barrelConfig.reportPolicies?.apiEvidence.reportScope).toEqual(['src/api']);
  expect(moduleLoaded.source).toBe('.projscanrc.json');
  expect(moduleLoaded.config.monorepo?.importPolicy?.[0]?.allow).toEqual([
    '@acme/core',
    '@acme/shared',
  ]);
});
