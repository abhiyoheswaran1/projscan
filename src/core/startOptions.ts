import { resolveStartMode, type StartModeResolution } from './startMode.js';
import type { WorkplanMode } from '../types.js';

export interface ComputeStartOptions {
  mode?: WorkplanMode;
  intent?: string;
  missionDir?: string;
  maxTasks?: number;
  maxRisks?: number;
  includeHandoff?: boolean;
}

export interface NormalizedStartOptions {
  intent?: string;
  modeResolution: StartModeResolution;
  mode: WorkplanMode;
  maxTasks: number;
  maxRisks: number;
}

const DEFAULT_MAX_TASKS = 5;
const DEFAULT_MAX_RISKS = 5;
const MAX_START_ITEMS = 12;

export function normalizeStartOptions(options: ComputeStartOptions = {}): NormalizedStartOptions {
  const intent = normalizeIntent(options.intent);
  const modeResolution = resolveStartMode(options.mode, intent);
  return {
    intent,
    modeResolution,
    mode: modeResolution.mode,
    maxTasks: normalizeLimit(options.maxTasks, DEFAULT_MAX_TASKS, MAX_START_ITEMS),
    maxRisks: normalizeLimit(options.maxRisks, DEFAULT_MAX_RISKS, MAX_START_ITEMS),
  };
}

function normalizeIntent(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) return undefined;
  return trimmed.slice(0, 240);
}

function normalizeLimit(value: number | undefined, fallback: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(value)));
}
