import { expect, test } from 'vitest';
import '../../src/types/understand.js';
import type {
  UnderstandBoundary,
  UnderstandBreakingChangeRisk,
  UnderstandChangeReadiness,
  UnderstandCitation,
  UnderstandClaim,
  UnderstandConfigContract,
  UnderstandContracts,
  UnderstandDirectTest,
  UnderstandEntrypoint,
  UnderstandFlow,
  UnderstandFlowSideEffect,
  UnderstandPublicExport,
  UnderstandReadFirst,
  UnderstandReport,
  UnderstandRisk,
  UnderstandUnknown,
  UnderstandVerification,
  UnderstandVerificationTier,
  UnderstandView,
} from '../../src/types/understand.js';
import type {
  UnderstandReport as BarrelUnderstandReport,
  UnderstandRisk as BarrelUnderstandRisk,
  UnderstandView as BarrelUnderstandView,
} from '../../src/types.js';
import type {
  UnderstandReport as EntryUnderstandReport,
  UnderstandView as EntryUnderstandView,
} from '../../src/index.js';

const view: UnderstandView = 'map';

const citation: UnderstandCitation = {
  file: 'src/index.ts',
  symbol: 'computeUnderstandReport',
  line: 12,
  reason: 'Package entrypoint exposes understand contracts.',
};

const claim: UnderstandClaim = {
  id: 'public-type-surface',
  title: 'Understand types compile from a focused module',
  detail: 'The focused module keeps the legacy barrel compatible.',
  confidence: 'high',
  citations: [citation],
};

const entrypoint: UnderstandEntrypoint = {
  file: 'src/cli/commands/understand.ts',
  kind: 'cli',
  symbols: ['registerUnderstand'],
  why: 'The CLI calls the understand report builder.',
  citations: [citation],
};

const boundary: UnderstandBoundary = {
  name: 'understand',
  files: 2,
  publicExports: ['UnderstandReport'],
  dependsOn: ['types'],
  citations: [citation],
};

const sideEffect: UnderstandFlowSideEffect = {
  kind: 'filesystem',
  label: 'Read repository files',
  files: ['src/core/understand.ts'],
  citations: [citation],
};

const flow: UnderstandFlow = {
  id: 'understand-flow',
  label: 'Build understand report',
  entry: entrypoint,
  path: ['src/cli/commands/understand.ts', 'src/core/understand.ts'],
  sideEffects: [sideEffect],
  confidence: 'high',
  citations: [citation],
};

const publicExport: UnderstandPublicExport = {
  name: 'UnderstandReport',
  file: 'src/index.ts',
  kind: 'package',
  citations: [citation],
};

const configContract: UnderstandConfigContract = {
  name: 'package.json',
  file: 'package.json',
  kind: 'package-script',
  required: true,
  citations: [citation],
};

const breakingChangeRisk: UnderstandBreakingChangeRisk = {
  id: 'public-understand-type-import',
  title: 'Preserve UnderstandReport public imports',
  files: ['src/types.ts', 'src/types/understand.ts'],
  why: 'Downstream TypeScript users may import understand contracts from the package entrypoint.',
  command: 'npm run typecheck:public-types',
};

const contracts: UnderstandContracts = {
  publicExports: [publicExport],
  configContracts: [configContract],
  breakingChangeRisks: [breakingChangeRisk],
};

const changeReadiness: UnderstandChangeReadiness = {
  intent: 'Extract understand public types',
  blastRadius: [
    {
      label: 'Public type surface',
      files: breakingChangeRisk.files,
      why: breakingChangeRisk.why,
      command: breakingChangeRisk.command,
    },
  ],
  safeEdit: {
    title: 'Move type declarations only',
    files: breakingChangeRisk.files,
    command: breakingChangeRisk.command,
    why: 'The public barrel keeps the same exported names.',
  },
  owners: [
    {
      owner: '@platform-team',
      files: breakingChangeRisk.files,
      reason: 'Public API compatibility review.',
    },
  ],
  rollback: {
    command:
      'git restore src/types.ts src/types/understand.ts tests/types/public-understand-types.test.ts',
    why: 'Restores the inline public type declarations.',
  },
  verificationCommands: [breakingChangeRisk.command],
};

const tier: UnderstandVerificationTier = {
  id: 'focused',
  label: 'Focused public type compatibility',
  commands: [breakingChangeRisk.command],
  when: 'After moving public understand contracts.',
};

const directTest: UnderstandDirectTest = {
  file: 'src/types/understand.ts',
  tests: ['tests/types/public-understand-types.test.ts'],
  confidence: 'high',
};

const verification: UnderstandVerification = {
  tiers: [tier],
  directTests: [directTest],
  gaps: [],
};

const readFirst: UnderstandReadFirst = {
  file: 'src/types/understand.ts',
  why: 'Focused understand public contracts live here.',
  command: 'projscan file src/types/understand.ts --format json',
  citations: [citation],
};

const risk: UnderstandRisk = {
  id: 'public-type-compatibility',
  priority: 'p1',
  title: 'Preserve legacy understand imports',
  files: breakingChangeRisk.files,
  why: breakingChangeRisk.why,
  command: breakingChangeRisk.command,
};

const unknown: UnderstandUnknown = {
  id: 'consumer-import-paths',
  question: 'Which downstream users import UnderstandReport directly?',
  whyUnknown: 'Local compile tests cover package surfaces, not external code.',
  command: 'npm run typecheck:public-types',
};

const report: UnderstandReport = {
  schemaVersion: 1,
  view,
  rootPath: '/repos/projscan',
  intent: changeReadiness.intent,
  summary: 'Understand public contracts compile from module and barrel imports.',
  claims: [claim],
  entrypoints: [entrypoint],
  boundaries: [boundary],
  flows: [flow],
  contracts,
  changeReadiness,
  verification,
  readFirst: [readFirst],
  risks: [risk],
  unknowns: [unknown],
  commands: [breakingChangeRisk.command],
};

const barrelView: BarrelUnderstandView = view;
const barrelRisk: BarrelUnderstandRisk = risk;
const barrelReport: BarrelUnderstandReport = report;
const entryView: EntryUnderstandView = view;
const entryReport: EntryUnderstandReport = report;

void [barrelView, barrelRisk, barrelReport, entryView];

test('understand public types compile from module, barrel, and package entrypoint', () => {
  expect(entryReport.contracts.publicExports[0]).toBe(publicExport);
});
