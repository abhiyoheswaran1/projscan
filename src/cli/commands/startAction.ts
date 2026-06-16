import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  setupLogLevel,
} from '../_shared.js';
import { computeStartReport, type ComputeStartOptions } from '../../core/start.js';
import { isWorkplanMode } from '../../core/workplan.js';
import { handleStartOutput, type StartOutputOptions } from './startOutput.js';
import type { ReportFormat } from '../../types.js';
import type { StartReport } from '../../types/start.js';
import type { WorkplanMode } from '../../types/workplan.js';

export interface StartCommandOptions extends StartOutputOptions {
  mode?: unknown;
  intent?: unknown;
  mission?: unknown;
  maxTasks?: number;
  maxRisks?: number;
  includeHandoff?: boolean;
}

interface StartExitDependencies {
  logError(message: string): void;
  exit(code: number): never;
}

export interface StartActionDependencies extends StartExitDependencies {
  setupLogLevel(): void;
  maybeCompactBanner(): void;
  assertFormatSupported(commandName: string): ReportFormat;
  getRootPath(): string;
  computeStartReport(rootPath: string, options: ComputeStartOptions): Promise<StartReport>;
  handleStartOutput(
    report: StartReport,
    context: {
      rootPath: string;
      format: ReportFormat;
      mode?: WorkplanMode;
      intent?: string;
      options: StartOutputOptions;
    },
  ): Promise<void>;
}

const defaultExitDependencies: StartExitDependencies = {
  logError: (message) => console.error(message),
  exit: (code) => process.exit(code),
};

const defaultStartActionDependencies: StartActionDependencies = {
  ...defaultExitDependencies,
  setupLogLevel,
  maybeCompactBanner,
  assertFormatSupported,
  getRootPath,
  computeStartReport,
  handleStartOutput,
};

export async function runStartCommandAction(cmdOpts: StartCommandOptions): Promise<void> {
  await runStartAction(cmdOpts);
}

export async function runStartAction(
  cmdOpts: StartCommandOptions,
  deps: StartActionDependencies = defaultStartActionDependencies,
): Promise<void> {
  deps.setupLogLevel();
  deps.maybeCompactBanner();
  const format = deps.assertFormatSupported('start');
  const mode = parseStartMode(cmdOpts.mode, deps);
  const rootPath = deps.getRootPath();
  const intent = stringOption(cmdOpts.intent);

  try {
    const report = await deps.computeStartReport(rootPath, {
      mode,
      intent,
      missionDir: stringOption(cmdOpts.mission),
      maxTasks: cmdOpts.maxTasks,
      maxRisks: cmdOpts.maxRisks,
      includeHandoff: cmdOpts.includeHandoff === true,
    });

    await deps.handleStartOutput(report, {
      rootPath,
      format,
      mode,
      intent,
      options: cmdOpts,
    });
  } catch (err) {
    deps.logError(chalk.red(err instanceof Error ? err.message : String(err)));
    deps.exit(1);
  }
}

export function parseStartMode(
  value: unknown,
  deps: StartExitDependencies = defaultExitDependencies,
): WorkplanMode | undefined {
  if (typeof value === 'undefined') return undefined;
  if (typeof value === 'string' && isWorkplanMode(value)) return value;
  deps.logError(chalk.red(`Unsupported --mode ${String(value)}.`));
  deps.logError(
    chalk.dim(
      'Supported modes: before_edit, before_commit, before_merge, refactor, release, bug_hunt, hardening',
    ),
  );
  deps.exit(1);
}

export function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}

function stringOption(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
