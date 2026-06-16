import { expect, test } from 'vitest';
import '../../src/types/pluginDx.js';
import type { Issue, IssueSeverity } from '../../src/types/common.js';
import type { PluginTestResult } from '../../src/types/pluginDx.js';
import type { PluginTestResult as BarrelPluginTestResult } from '../../src/types.js';

const diagnosticSeverity: IssueSeverity = 'warning';

const analyzerIssue: Issue = {
  id: 'plugin-dx-public-types',
  title: 'Plugin DX public type fixture',
  description: 'PluginTestResult should compile from the focused module and the legacy barrel.',
  severity: diagnosticSeverity,
  category: 'public-api',
  fixAvailable: false,
};

const result: PluginTestResult = {
  schemaVersion: 1,
  manifestPath: '.projscan-plugins/policy.projscan-plugin.json',
  ok: true,
  diagnostics: [
    {
      code: 'plugin-static-validation',
      severity: diagnosticSeverity,
      message: 'Static validation completed without executing plugin code.',
    },
  ],
  trust: {
    localOnly: true,
    previewFlag: 'PROJSCAN_PLUGINS_PREVIEW=1',
    reminder: 'Local plugins execute code only when explicitly trusted.',
  },
  commands: {
    validate: 'projscan plugin validate .projscan-plugins/policy.projscan-plugin.json',
    test: 'projscan plugin test .projscan-plugins/policy.projscan-plugin.json',
    execute: 'projscan plugin test .projscan-plugins/policy.projscan-plugin.json --execute',
    enable: 'PROJSCAN_PLUGINS_PREVIEW=1',
  },
  execution: {
    requested: true,
    executed: false,
    mode: 'static',
    note: 'Static validation completed without importing plugin modules.',
  },
  context: {
    requested: true,
    capabilities: ['semanticGraph', 'dataflow'],
    note: 'Fixture requested semantic graph and dataflow context.',
  },
  analyzer: {
    issues: [analyzerIssue],
  },
  reporter: {
    outputs: [
      {
        command: 'doctor',
        text: 'Plugin reporter rendered doctor output.',
      },
    ],
  },
};

const executeMode: PluginTestResult['execution']['mode'] = 'execute';
const staticMode: PluginTestResult['execution']['mode'] = result.execution.mode;
const capability: PluginTestResult['context']['capabilities'][number] = 'semanticGraph';
const barrelResult: BarrelPluginTestResult = result;
const moduleResult: PluginTestResult = barrelResult;

void [executeMode, staticMode, capability];

test('plugin DX public type compiles from the module and legacy barrel', () => {
  expect(moduleResult.schemaVersion).toBe(1);
  expect(moduleResult.trust.previewFlag).toBe('PROJSCAN_PLUGINS_PREVIEW=1');
  expect(moduleResult.commands.execute).toContain('--execute');
  expect(moduleResult.execution.mode).toBe('static');
  expect(moduleResult.context.capabilities).toEqual(['semanticGraph', 'dataflow']);
  expect(moduleResult.diagnostics[0].severity).toBe('warning');
  expect(moduleResult.analyzer?.issues[0].id).toBe('plugin-dx-public-types');
  expect(moduleResult.reporter?.outputs[0].command).toBe('doctor');
});
