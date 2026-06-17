import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

test('start report turns public contract questions into the contracts understanding view', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what are the public contracts',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['contracts', 'public'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Public exports, config contracts, and likely breaking-change risks are reviewed before touching API surfaces.',
      'The developer knows which exported files or symbols need compatibility checks.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan understand --view contracts --format json',
  );
});

test('start report turns API deprecation questions into the contracts understanding view', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'how do I safely deprecate this API',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['api', 'deprecate']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_impact'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: expect.arrayContaining(['api', 'deprecate']),
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Public exports, config contracts, and likely breaking-change risks are reviewed before touching API surfaces.',
      'The developer knows which exported files or symbols need compatibility checks.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan understand --view contracts --format json',
  );
});

test('start report searches for an exact target before API breakage impact', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what will this API change break',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Impact',
      tool: 'projscan_impact',
      cli: 'projscan impact',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['api', 'change', 'break']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      label: 'Find exact target for impact analysis',
      command: 'projscan search "what will this API change break" --format json',
      tool: 'projscan_search',
      args: { query: 'what will this API change break' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_understand'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: expect.arrayContaining(['api', 'change']),
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'An exact symbol or file path is selected from search results before impact analysis continues.',
      'The impact report is reviewed for direct and transitive dependents before editing starts.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan search "what will this API change break" --format json',
  );
});

test('start report turns env-var requirement questions into the contracts understanding view', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what env vars does this repo need',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['env', 'vars'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_privacy_check'),
  ).toBeUndefined();
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Required environment variables and config contracts are identified before setup or runtime troubleshooting continues.',
      'The developer knows which env names, defaults, or config files need local values before running the app.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan understand --view contracts --format json',
  );
});

test('start report turns missing environment variables into contracts', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'environment variables missing',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['environment', 'variables', 'missing']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Required environment variables and config contracts are identified before setup or runtime troubleshooting continues.',
      'The developer knows which env names, defaults, or config files need local values before running the app.',
    ]),
  );
});

test('start report turns local database setup commands into the contracts understanding view', async () => {
  const root = await makeTempProject();

  const seedDatabase = await computeStartReport(root, {
    intent: 'how do I seed the database',
  });
  expect(seedDatabase.mode).toBe('before_edit');
  expect(seedDatabase.modeSource).toBe('default');
  expect(seedDatabase.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['seed', 'database']),
    }),
  );
  expect(seedDatabase.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(seedDatabase.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Package scripts and config contracts identify the seed, reset, or migration command before shell commands are guessed.',
      'The developer knows database setup preconditions, required env vars, and the safest local command to run.',
    ]),
  );

  const resetDatabase = await computeStartReport(root, {
    intent: 'what command resets the database',
  });
  expect(resetDatabase.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['command', 'resets', 'database']),
    }),
  );
  expect(resetDatabase.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );

  const runMigrations = await computeStartReport(root, {
    intent: 'what command runs migrations',
  });
  expect(runMigrations.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['command', 'runs', 'migrations']),
    }),
  );
  expect(runMigrations.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
});

test('start report turns local services setup commands into the contracts understanding view', async () => {
  const root = await makeTempProject();

  const localServices = await computeStartReport(root, {
    intent: 'how do I start local services',
  });

  expect(localServices.mode).toBe('before_edit');
  expect(localServices.modeSource).toBe('default');
  expect(localServices.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['start', 'local', 'services']),
    }),
  );
  expect(localServices.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(
    localServices.missionControl.alternatives?.find((route) => route.tool === 'projscan_hotspots'),
  ).toBeUndefined();
  expect(localServices.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Local service startup scripts, container commands, and required config are reviewed before running dev services.',
      'The developer knows the safest command to start local services plus any env, port, or dependency preconditions.',
    ]),
  );

  const dockerCompose = await computeStartReport(root, {
    intent: 'what command starts docker compose',
  });
  expect(dockerCompose.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['command', 'docker', 'compose']),
    }),
  );
  expect(dockerCompose.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
});

