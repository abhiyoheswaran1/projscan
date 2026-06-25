import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, applyConfigToIssues } from '../../src/utils/config.js';
import type { Issue } from '../../src/types.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-config-'));
}

function issue(id: string, severity: Issue['severity'] = 'warning'): Issue {
  return {
    id,
    title: `issue ${id}`,
    description: 'desc',
    severity,
    category: 'test',
    fixAvailable: false,
  };
}

function locatedIssue(
  id: string,
  file: string,
  line: number,
  severity: Issue['severity'] = 'warning',
): Issue {
  return {
    ...issue(id, severity),
    locations: [{ file, line }],
  };
}

describe('loadConfig', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns empty config when no file exists', async () => {
    const result = await loadConfig(tmp);
    expect(result.config).toEqual({});
    expect(result.source).toBeNull();
  });

  it('loads .projscanrc.json', async () => {
    await fs.writeFile(
      path.join(tmp, '.projscanrc.json'),
      JSON.stringify({ minScore: 80, disableRules: ['missing-prettier'] }),
    );
    const result = await loadConfig(tmp);
    expect(result.config.minScore).toBe(80);
    expect(result.config.disableRules).toEqual(['missing-prettier']);
    expect(result.source).toContain('.projscanrc.json');
  });

  it('loads from package.json "projscan" key when no .projscanrc exists', async () => {
    await fs.writeFile(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 'x', projscan: { minScore: 90, ignore: ['**/fixtures/**'] } }),
    );
    const result = await loadConfig(tmp);
    expect(result.config.minScore).toBe(90);
    expect(result.config.ignore).toEqual(['**/fixtures/**']);
    expect(result.source).toContain('package.json');
  });

  it('keeps basic scalar and list normalization out of the main config loader', () => {
    const configSource = readFileSync(path.join(process.cwd(), 'src/utils/config.ts'), 'utf8');
    expect(configSource).not.toContain('function applyMinScore');
    expect(configSource).not.toContain('function applyFailOn');
    expect(configSource).not.toContain('function applyBaseRef');
    expect(configSource).not.toContain('function applyIgnore');
    expect(configSource).not.toContain('function applyDisableRules');

    const basicsSource = readFileSync(path.join(process.cwd(), 'src/utils/configBasics.ts'), 'utf8');
    expect(basicsSource).not.toContain("from './config.js'");
  });

  it('keeps config source discovery out of the main config loader', () => {
    const configSource = readFileSync(path.join(process.cwd(), 'src/utils/config.ts'), 'utf8');
    expect(configSource).not.toContain('CONFIG_CANDIDATES');
    expect(configSource).not.toContain('function safeParse');
    expect(configSource).not.toContain('package.json');

    const sourcesSource = readFileSync(
      path.join(process.cwd(), 'src/utils/configSources.ts'),
      'utf8',
    );
    expect(sourcesSource).not.toContain("from './config.js'");
  });

  it('clamps minScore to 0..100', async () => {
    await fs.writeFile(path.join(tmp, '.projscanrc.json'), JSON.stringify({ minScore: 250 }));
    const result = await loadConfig(tmp);
    expect(result.config.minScore).toBe(100);
  });

  it('normalizes failOn severity floor', async () => {
    await fs.writeFile(path.join(tmp, '.projscanrc.json'), JSON.stringify({ failOn: 'warning' }));
    const result = await loadConfig(tmp);
    expect(result.config.failOn).toBe('warning');
  });

  it('drops invalid failOn severity floors', async () => {
    await fs.writeFile(path.join(tmp, '.projscanrc.json'), JSON.stringify({ failOn: 'critical' }));
    const result = await loadConfig(tmp);
    expect(result.config.failOn).toBeUndefined();
  });

  it('normalizes scan privacy options', async () => {
    await fs.writeFile(
      path.join(tmp, '.projscanrc.json'),
      JSON.stringify({ scan: { includeIgnored: true, scanEnvValues: true, offline: true } }),
    );
    const result = await loadConfig(tmp);
    expect(result.config.scan).toEqual({
      includeIgnored: true,
      scanEnvValues: true,
      offline: true,
    });
  });

  it('normalizes hotspots options', async () => {
    await fs.writeFile(
      path.join(tmp, '.projscanrc.json'),
      JSON.stringify({ hotspots: { limit: 15, since: '3 months ago' } }),
    );
    const result = await loadConfig(tmp);
    expect(result.config.hotspots?.limit).toBe(15);
    expect(result.config.hotspots?.since).toBe('3 months ago');
  });

  it('keeps hotspot option normalization out of the main config loader', () => {
    const configSource = readFileSync(path.join(process.cwd(), 'src/utils/config.ts'), 'utf8');
    expect(configSource).not.toContain('function applyHotspots');

    const hotspotsSource = readFileSync(
      path.join(process.cwd(), 'src/utils/configHotspots.ts'),
      'utf8',
    );
    expect(hotspotsSource).not.toContain("from './config.js'");
  });

  it('normalizes report policy presets', async () => {
    await fs.writeFile(
      path.join(tmp, '.projscanrc.json'),
      JSON.stringify({
        reportPolicies: {
          apiEvidence: {
            reportScope: ['src/api', '', './packages/backend/'],
            redactPaths: true,
          },
          invalidPreset: {
            reportScope: [''],
            redactPaths: 'yes',
          },
          notAnObject: true,
        },
      }),
    );
    const result = await loadConfig(tmp);
    expect(result.config.reportPolicies).toEqual({
      apiEvidence: {
        reportScope: ['src/api', './packages/backend/'],
        redactPaths: true,
      },
    });
  });

  it('normalizes team proof recipes', async () => {
    await fs.writeFile(
      path.join(tmp, '.projscanrc.json'),
      JSON.stringify({
        proofRecipes: [
          {
            id: ' billing-critical ',
            matches: ['src/billing/**', '', 42],
            requiredCommands: [' npm test -- tests/billing/retry.test.ts ', 'bad\0command', 'line\nbreak'],
            requiredReviewers: [' @payments ', '', null],
            forbiddenFiles: ['src/auth/**', '', 7],
            riskSurface: ' billing ',
            reason: ' Billing retry changes need focused payments proof. ',
          },
          {
            id: '',
            matches: ['src/ignored/**'],
            requiredCommands: ['npm test -- ignored'],
          },
          {
            id: 'billing-critical',
            matches: ['src/duplicate/**'],
            requiredCommands: ['npm test -- duplicate'],
          },
          {
            id: '<!--',
            matches: ['src/injected/**'],
            requiredCommands: ['npm test -- injected'],
            requiredReviewers: ['<!--'],
          },
          true,
        ],
      }),
    );

    const result = await loadConfig(tmp);

    expect(result.config.proofRecipes).toEqual([
      {
        id: 'billing-critical',
        matches: ['src/billing/**'],
        requiredCommands: ['npm test -- tests/billing/retry.test.ts'],
        requiredReviewers: ['@payments'],
        forbiddenFiles: ['src/auth/**'],
        riskSurface: 'billing',
        reason: 'Billing retry changes need focused payments proof.',
      },
    ]);
  });

  it('keeps proof recipe normalization out of the main config loader', () => {
    const configSource = readFileSync(path.join(process.cwd(), 'src/utils/config.ts'), 'utf8');
    expect(configSource).not.toContain('function applyProofRecipes');
    expect(configSource).not.toContain('function normalizeProofRecipe');

    const proofRecipesSource = readFileSync(
      path.join(process.cwd(), 'src/utils/configProofRecipes.ts'),
      'utf8',
    );
    expect(proofRecipesSource).not.toContain("from './config.js'");
  });

  it('keeps report policy preset normalization out of the main config loader', () => {
    const configSource = readFileSync(path.join(process.cwd(), 'src/utils/config.ts'), 'utf8');
    expect(configSource).not.toContain('function applyReportPolicies');
    expect(configSource).not.toContain('function normalizeReportPolicy');

    const reportPoliciesSource = readFileSync(
      path.join(process.cwd(), 'src/utils/configReportPolicies.ts'),
      'utf8',
    );
    expect(reportPoliciesSource).not.toContain("from './config.js'");
  });

  it('keeps monorepo import policy normalization out of the main config loader', () => {
    const configSource = readFileSync(path.join(process.cwd(), 'src/utils/config.ts'), 'utf8');
    expect(configSource).not.toContain('function applyMonorepo');
    expect(configSource).not.toContain('function parseImportPolicyRules');

    const monorepoSource = readFileSync(
      path.join(process.cwd(), 'src/utils/configMonorepo.ts'),
      'utf8',
    );
    expect(monorepoSource).not.toContain("from './config.js'");
  });

  it('keeps monorepo import policy rule parsing split into small helpers', () => {
    const monorepoSource = readFileSync(
      path.join(process.cwd(), 'src/utils/configMonorepo.ts'),
      'utf8',
    );
    expect(monorepoSource).not.toContain('for (const entry of raw)');
  });

  it('keeps scan privacy option normalization out of the main config loader', () => {
    const configSource = readFileSync(path.join(process.cwd(), 'src/utils/config.ts'), 'utf8');
    expect(configSource).not.toContain('function applyScan');

    const scanSource = readFileSync(path.join(process.cwd(), 'src/utils/configScan.ts'), 'utf8');
    expect(scanSource).not.toContain("from './config.js'");
  });

  it('keeps taint option normalization out of the main config loader', () => {
    const configSource = readFileSync(path.join(process.cwd(), 'src/utils/config.ts'), 'utf8');
    expect(configSource).not.toContain('function applyTaint');

    const taintSource = readFileSync(path.join(process.cwd(), 'src/utils/configTaint.ts'), 'utf8');
    expect(taintSource).not.toContain("from './config.js'");
  });

  it('drops invalid severity overrides', async () => {
    await fs.writeFile(
      path.join(tmp, '.projscanrc.json'),
      JSON.stringify({
        severityOverrides: { 'missing-prettier': 'info', 'missing-readme': 'bogus' },
      }),
    );
    const result = await loadConfig(tmp);
    expect(result.config.severityOverrides).toEqual({ 'missing-prettier': 'info' });
  });

  it('normalizes per-rule suppressions', async () => {
    await fs.writeFile(
      path.join(tmp, '.projscanrc.json'),
      JSON.stringify({
        suppress: {
          'hardcoded-secret': ['src/firebase.ts', '', 42],
          'unused-exports-*': ['src/generated/**'],
          invalid: 'src/nope.ts',
        },
      }),
    );
    const result = await loadConfig(tmp);
    expect(result.config.suppress).toEqual({
      'hardcoded-secret': ['src/firebase.ts'],
      'unused-exports-*': ['src/generated/**'],
    });
  });

  it('keeps severity override normalization out of the main config loader', () => {
    const configSource = readFileSync(path.join(process.cwd(), 'src/utils/config.ts'), 'utf8');
    expect(configSource).not.toContain('function applySeverityOverrides');
    expect(configSource).not.toContain('VALID_SEVERITIES');

    const severitySource = readFileSync(
      path.join(process.cwd(), 'src/utils/configSeverity.ts'),
      'utf8',
    );
    expect(severitySource).not.toContain("from './config.js'");
  });

  it('throws with a helpful message on malformed JSON', async () => {
    await fs.writeFile(path.join(tmp, '.projscanrc.json'), '{ not valid }');
    await expect(loadConfig(tmp)).rejects.toThrow(/Invalid JSON/);
  });

  it('respects explicit config path', async () => {
    const custom = path.join(tmp, 'custom.json');
    await fs.writeFile(custom, JSON.stringify({ minScore: 55 }));
    const result = await loadConfig(tmp, custom);
    expect(result.config.minScore).toBe(55);
    expect(result.source).toBe(custom);
  });
});

describe('applyConfigToIssues', () => {
  it('keeps issue rule application out of the main config loader', () => {
    const configSource = readFileSync(path.join(process.cwd(), 'src/utils/config.ts'), 'utf8');
    expect(configSource).not.toContain('function applyConfigToIssues');
    expect(configSource).not.toContain('function isRuleDisabled');

    const issueRulesSource = readFileSync(
      path.join(process.cwd(), 'src/utils/configIssueRules.ts'),
      'utf8',
    );
    expect(issueRulesSource).not.toContain("from './config.js'");
  });

  it('drops issues matching disableRules exactly', () => {
    const issues = [issue('missing-prettier'), issue('missing-readme')];
    const out = applyConfigToIssues(issues, { disableRules: ['missing-prettier'] });
    expect(out.map((i) => i.id)).toEqual(['missing-readme']);
  });

  it('drops issues matching wildcard prefix in disableRules', () => {
    const issues = [issue('large-utils-dir'), issue('large-helpers-dir'), issue('missing-readme')];
    const out = applyConfigToIssues(issues, { disableRules: ['large-*'] });
    expect(out.map((i) => i.id)).toEqual(['missing-readme']);
  });

  it('remaps severity via severityOverrides', () => {
    const issues = [issue('missing-prettier', 'warning')];
    const out = applyConfigToIssues(issues, { severityOverrides: { 'missing-prettier': 'info' } });
    expect(out[0].severity).toBe('info');
  });

  it('drops only the matching rule and path from suppress config', () => {
    const issues = [
      locatedIssue('hardcoded-secret', 'src/firebase.ts', 1, 'error'),
      locatedIssue('gitignore-missing-env', 'src/firebase.ts', 1),
      locatedIssue('hardcoded-secret', 'src/real-secret.ts', 1, 'error'),
    ];
    const out = applyConfigToIssues(issues, {
      suppress: { 'hardcoded-secret': ['src/firebase.ts'] },
    });

    expect(out.map((i) => `${i.id}:${i.locations?.[0]?.file}`)).toEqual([
      'gitignore-missing-env:src/firebase.ts',
      'hardcoded-secret:src/real-secret.ts',
    ]);
  });

  it('drops only matching inline ignore-line findings', () => {
    const issues = [
      locatedIssue('hardcoded-secret', 'src/firebase.ts', 3, 'error'),
      locatedIssue('gitignore-missing-env', 'src/firebase.ts', 3),
      locatedIssue('hardcoded-secret', 'src/firebase.ts', 4, 'error'),
    ];
    const out = applyConfigToIssues(issues, {
      inlineSuppressions: {
        'src/firebase.ts': [{ line: 3, rules: ['hardcoded-secret'], reason: 'Firebase key is public' }],
      },
    });

    expect(out.map((i) => `${i.id}:${i.locations?.[0]?.line}`)).toEqual([
      'gitignore-missing-env:3',
      'hardcoded-secret:4',
    ]);
  });

  it('leaves non-matching issues untouched', () => {
    const issues = [issue('missing-prettier', 'warning')];
    const out = applyConfigToIssues(issues, {});
    expect(out).toEqual(issues);
  });
});
