import { expect, test } from 'vitest';
import '../../src/types/config.js';
import type {
  ImportPolicyRule,
  LoadedConfig,
  ProjscanConfig,
  ReportFormat,
} from '../../src/types/config.js';
import type {
  ImportPolicyRule as BarrelImportPolicyRule,
  LoadedConfig as BarrelLoadedConfig,
  ProjscanConfig as BarrelProjscanConfig,
  ReportFormat as BarrelReportFormat,
} from '../../src/types.js';

const formats: ReportFormat[] = ['console', 'json', 'markdown', 'sarif', 'html'];

const importPolicy: ImportPolicyRule = {
  from: '@acme/app',
  allow: ['@acme/core', '@acme/shared'],
  deny: ['@acme/legacy'],
};

const config: ProjscanConfig = {
  minScore: 85,
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
  severityOverrides: {
    'demo-warning': 'warning',
  },
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
const barrelPolicy: BarrelImportPolicyRule = importPolicy;
const barrelConfig: BarrelProjscanConfig = config;
const barrelLoaded: BarrelLoadedConfig = loaded;
const moduleLoaded: LoadedConfig = barrelLoaded;

test('config public types compile from the module and legacy barrel', () => {
  expect(formats).toEqual(['console', 'json', 'markdown', 'sarif', 'html']);
  expect(barrelFormat).toBe('json');
  expect(barrelPolicy.from).toBe('@acme/app');
  expect(barrelConfig.scan?.offline).toBe(true);
  expect(moduleLoaded.source).toBe('.projscanrc.json');
  expect(moduleLoaded.config.monorepo?.importPolicy?.[0]?.allow).toEqual([
    '@acme/core',
    '@acme/shared',
  ]);
});
