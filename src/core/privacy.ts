import type { ProjscanConfig, ScanResult } from '../types.js';
import { discoverPluginManifests, PLUGIN_PREVIEW_FLAG, pluginsEnabled } from './plugins.js';
import { DEFAULT_TELEMETRY_ENDPOINT, getTelemetryStatus } from './telemetry.js';

export const OFFLINE_ENV = 'PROJSCAN_OFFLINE';
const SCAN_ENV_VALUES_ENV = 'PROJSCAN_SCAN_ENV_VALUES';

export interface NetworkEndpointInfo {
  name: string;
  endpoint: string;
  trigger: string;
  blockedByOffline: boolean;
}

export interface LocalWriteSurfaceInfo {
  name: string;
  path: string;
  trigger: string;
  containsUserData: boolean;
}

export interface PrivacyCheckReport {
  telemetry: {
    enabled: boolean;
    anonymousId: string | null;
    queueLength: number;
  };
  offline: {
    enabled: boolean;
    env: typeof OFFLINE_ENV;
  };
  scan: {
    rootPath: string;
    source: 'git' | 'glob';
    gitignoreRespected: boolean;
    includeIgnored: boolean;
    ignoredFileCount: number;
    totalFiles: number;
  };
  envContentScanning: boolean;
  plugins: {
    executionEnabled: boolean;
    envFlag: typeof PLUGIN_PREVIEW_FLAG;
    discoveredManifestCount: number;
    localCodeExecution: boolean;
    note: string;
  };
  localWrites: {
    surfaces: LocalWriteSurfaceInfo[];
  };
  reportExports: {
    userControlled: boolean;
    mayContainPaths: boolean;
    mayContainFindings: boolean;
    note: string;
  };
  network: {
    endpoints: NetworkEndpointInfo[];
  };
}

export function isOfflineMode(config?: ProjscanConfig): boolean {
  if (config?.scan?.offline === true) return true;
  const value = process.env[OFFLINE_ENV];
  return value === '1' || value === 'true' || value === 'yes';
}

export function enableOfflineMode(): void {
  process.env[OFFLINE_ENV] = '1';
}

export function knownNetworkEndpoints(offline = isOfflineMode()): NetworkEndpointInfo[] {
  return [
    {
      name: 'telemetry',
      endpoint: DEFAULT_TELEMETRY_ENDPOINT,
      trigger: 'explicit telemetry opt-in',
      blockedByOffline: offline,
    },
    {
      name: 'npm registry',
      endpoint: 'https://registry.npmjs.org',
      trigger: 'projscan upgrade --check-registry',
      blockedByOffline: offline,
    },
    {
      name: 'npm audit',
      endpoint: 'configured npm registry',
      trigger: 'projscan audit',
      blockedByOffline: offline,
    },
    {
      name: 'semantic model download',
      endpoint: 'Xenova model host used by @xenova/transformers',
      trigger: 'semantic or hybrid search with optional embeddings peer installed',
      blockedByOffline: offline,
    },
  ];
}

export function knownLocalWriteSurfaces(): LocalWriteSurfaceInfo[] {
  return [
    {
      name: 'graph cache',
      path: '.projscan-cache/graph.json',
      trigger: 'analysis, MCP tools, watch, and graph-backed commands',
      containsUserData: true,
    },
    {
      name: 'session memory',
      path: '.projscan-cache/session.json',
      trigger: 'MCP tool results, explicit session commands, and file-watch events',
      containsUserData: true,
    },
    {
      name: 'cross-repo workspace registration',
      path: '.projscan-cache/workspace.json',
      trigger: 'projscan workspace add for locally trusted sibling repo registration',
      containsUserData: true,
    },
    {
      name: 'project memory',
      path: '.projscan-memory/memory.json',
      trigger: 'project memory and severity/confidence drift features',
      containsUserData: true,
    },
    {
      name: 'baseline',
      path: '.projscan-baseline.json',
      trigger: 'projscan diff --save-baseline and team bootstrap',
      containsUserData: true,
    },
    {
      name: 'feedback artifact',
      path: '.projscan-feedback.json',
      trigger: 'projscan feedback init/add when the user chooses that output path',
      containsUserData: true,
    },
    {
      name: 'generated setup files',
      path: '.projscanrc.json, .github/workflows/projscan.yml, .github/CODEOWNERS',
      trigger: 'projscan init policy, init github-action, or init team',
      containsUserData: false,
    },
  ];
}

export async function buildPrivacyCheckReport(
  rootPath: string,
  scan: ScanResult,
  config: ProjscanConfig = {},
): Promise<PrivacyCheckReport> {
  const offline = isOfflineMode(config);
  const telemetry = await getTelemetryStatus();
  const pluginManifests = await discoverPluginManifests(rootPath);
  const pluginExecutionEnabled = pluginsEnabled();
  return {
    telemetry: {
      enabled: telemetry.enabled,
      anonymousId: telemetry.anonymousId,
      queueLength: telemetry.queueLength,
    },
    offline: {
      enabled: offline,
      env: OFFLINE_ENV,
    },
    scan: {
      rootPath,
      source: scan.scanBoundary.source,
      gitignoreRespected: scan.scanBoundary.gitignoreRespected,
      includeIgnored: scan.scanBoundary.includeIgnored,
      ignoredFileCount: scan.scanBoundary.ignoredFileCount,
      totalFiles: scan.totalFiles,
    },
    envContentScanning:
      config.scan?.scanEnvValues === true || process.env[SCAN_ENV_VALUES_ENV] === '1',
    plugins: {
      executionEnabled: pluginExecutionEnabled,
      envFlag: PLUGIN_PREVIEW_FLAG,
      discoveredManifestCount: pluginManifests.length,
      localCodeExecution: pluginExecutionEnabled,
      note: pluginExecutionEnabled
        ? 'Local plugin execution is enabled, but each plugin module additionally requires explicit trust-on-first-use approval (`projscan plugin trust <name>`) before it runs.'
        : `Local plugins are disabled unless ${PLUGIN_PREVIEW_FLAG}=1 is set, and each module must then be approved with \`projscan plugin trust\`.`,
    },
    localWrites: {
      surfaces: knownLocalWriteSurfaces(),
    },
    reportExports: {
      userControlled: true,
      mayContainPaths: true,
      mayContainFindings: true,
      note: 'Console, JSON, Markdown, SARIF, HTML, PR comments, and handoff artifacts can contain paths and findings when the user prints, saves, copies, or publishes them.',
    },
    network: {
      endpoints: knownNetworkEndpoints(offline),
    },
  };
}
