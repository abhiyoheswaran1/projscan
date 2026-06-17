import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  TELEMETRY_SCHEMA_VERSION,
  toIso,
  type StoredTelemetryConfig,
} from './telemetryConfig.js';

export type TelemetryCommandCategory =
  | 'doctor'
  | 'review'
  | 'preflight'
  | 'dogfood'
  | 'feedback'
  | 'trial'
  | 'init'
  | 'mcp'
  | 'evidence'
  | 'start'
  | 'other';

const TELEMETRY_COMMAND_CATEGORY_BY_COMMAND: Readonly<
  Partial<Record<string, TelemetryCommandCategory>>
> = {
  doctor: 'doctor',
  review: 'review',
  preflight: 'preflight',
  dogfood: 'dogfood',
  feedback: 'feedback',
  trial: 'trial',
  init: 'init',
  mcp: 'mcp',
  'evidence-pack': 'evidence',
  start: 'start',
  'first-run': 'start',
  recipes: 'start',
};

export type TelemetryEventStatus = 'success' | 'failure';
export type DurationBucket = '<1s' | '1-5s' | '5-30s' | '30s-2m' | '2m+';
export type CountBucket = '0' | '1' | '2-5' | '6-20' | '21-100' | '100+';
export type MinutesSavedBucket = '0' | '1-5' | '6-10' | '10-20' | '20+';

export interface TelemetryFeedbackInput {
  repo?: unknown;
  pr?: unknown;
  reviewer?: unknown;
  useful?: boolean;
  minutesSaved?: number;
  preventedBadEdit?: boolean;
  falsePositiveRules?: unknown[];
  falsePositiveReported?: boolean;
}

export interface TelemetryFeedbackSummary {
  useful?: boolean;
  minutesSavedBucket?: MinutesSavedBucket;
  preventedBadEdit?: boolean;
  falsePositiveReported?: boolean;
}

export interface CommandTelemetryInput {
  commandName: string;
  status: TelemetryEventStatus;
  durationMs: number;
  rootPath?: string;
  version?: string;
  feedback?: TelemetryFeedbackSummary;
}

export interface TelemetryEvent {
  schemaVersion: 1;
  eventId: string;
  eventType: 'command_run' | 'feedback_outcome';
  anonymousId: string;
  occurredAt: string;
  commandCategory: TelemetryCommandCategory;
  commandName: string;
  status: TelemetryEventStatus;
  durationBucket: DurationBucket;
  version: string;
  nodeMajor: number;
  platform: NodeJS.Platform;
  ci: boolean;
  setup: {
    githubActionConfigured: boolean;
    mcpConfigured: boolean;
    teamInitConfigured: boolean;
  };
  repeatUse: {
    runCountBucket: CountBucket;
    activeDaysBucket: CountBucket;
  };
  feedback?: TelemetryFeedbackSummary;
}

export function buildFeedbackTelemetry(input: TelemetryFeedbackInput): TelemetryFeedbackSummary {
  const result: TelemetryFeedbackSummary = {};
  if (typeof input.useful === 'boolean') result.useful = input.useful;
  if (typeof input.minutesSaved === 'number' && Number.isFinite(input.minutesSaved)) {
    result.minutesSavedBucket = bucketTelemetryMinutes(input.minutesSaved);
  }
  if (typeof input.preventedBadEdit === 'boolean') result.preventedBadEdit = input.preventedBadEdit;
  const ruleCount = Array.isArray(input.falsePositiveRules) ? input.falsePositiveRules.length : 0;
  if (typeof input.falsePositiveReported === 'boolean' || ruleCount > 0) {
    result.falsePositiveReported = input.falsePositiveReported === true || ruleCount > 0;
  }
  return result;
}

export async function buildTelemetryCommandEvent(
  input: CommandTelemetryInput,
  config: StoredTelemetryConfig,
  nowValue: Date | undefined,
): Promise<TelemetryEvent> {
  const now = nowValue ?? new Date();
  const rootPath = input.rootPath ?? process.cwd();
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    eventId: 'evt_' + crypto.randomUUID(),
    eventType: input.feedback ? 'feedback_outcome' : 'command_run',
    anonymousId: config.anonymousId ?? generateTelemetryAnonymousId(),
    occurredAt: toIso(now),
    commandCategory: categorizeTelemetryCommand(input.commandName),
    commandName: sanitizeTelemetryCommandName(input.commandName),
    status: input.status,
    durationBucket: bucketTelemetryDuration(input.durationMs),
    version: sanitizeTelemetryVersion(input.version),
    nodeMajor: Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10) || 0,
    platform: process.platform,
    ci: process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true',
    setup: await detectTelemetrySetup(rootPath),
    repeatUse: {
      runCountBucket: bucketTelemetryCount(config.usage.runCount),
      activeDaysBucket: bucketTelemetryCount(config.usage.activeDays.length),
    },
    ...(input.feedback ? { feedback: input.feedback } : {}),
  };
}

function categorizeTelemetryCommand(commandName: string): TelemetryCommandCategory {
  const name = sanitizeTelemetryCommandName(commandName);
  const first = name.split(' ')[0] ?? 'other';
  return TELEMETRY_COMMAND_CATEGORY_BY_COMMAND[first] ?? 'other';
}

function sanitizeTelemetryCommandName(commandName: string): string {
  return (
    commandName
      .toLowerCase()
      .replace(/[^a-z0-9:_-]+/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .join(' ') || 'unknown'
  );
}

function sanitizeTelemetryVersion(value: string | undefined): string {
  if (!value) return 'unknown';
  return /^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(value) ? value : 'unknown';
}

function bucketTelemetryDuration(durationMs: number): DurationBucket {
  if (!Number.isFinite(durationMs) || durationMs < 1000) return '<1s';
  if (durationMs < 5000) return '1-5s';
  if (durationMs < 30000) return '5-30s';
  if (durationMs < 120000) return '30s-2m';
  return '2m+';
}

function bucketTelemetryMinutes(value: number): MinutesSavedBucket {
  if (value <= 0) return '0';
  if (value <= 5) return '1-5';
  if (value <= 10) return '6-10';
  if (value <= 20) return '10-20';
  return '20+';
}

function bucketTelemetryCount(value: number): CountBucket {
  if (value <= 0) return '0';
  if (value === 1) return '1';
  if (value <= 5) return '2-5';
  if (value <= 20) return '6-20';
  if (value <= 100) return '21-100';
  return '100+';
}

async function detectTelemetrySetup(rootPath: string): Promise<TelemetryEvent['setup']> {
  const githubActionConfigured = await telemetryFileExists(
    path.join(rootPath, '.github', 'workflows', 'projscan.yml'),
  );
  const teamInitConfigured =
    (await telemetryFileExists(path.join(rootPath, '.projscan-baseline.json'))) ||
    (await telemetryFileExists(path.join(rootPath, '.github', 'CODEOWNERS')));
  const mcpConfigured = await anyTelemetryFileExists([
    path.join(rootPath, '.codex', 'config.toml'),
    path.join(rootPath, '.cursor', 'mcp.json'),
    path.join(rootPath, '.continue', 'config.json'),
  ]);
  return { githubActionConfigured, mcpConfigured, teamInitConfigured };
}

async function anyTelemetryFileExists(paths: string[]): Promise<boolean> {
  for (const candidate of paths) {
    if (await telemetryFileExists(candidate)) return true;
  }
  return false;
}

async function telemetryFileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function generateTelemetryAnonymousId(): string {
  return 'psn_' + crypto.randomUUID();
}
