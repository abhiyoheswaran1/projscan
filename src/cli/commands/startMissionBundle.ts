import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

import type { StartMissionToolCall, StartReport } from '../../types/start.js';

export interface MissionBundleContext {
  nextToolCall?: StartMissionToolCall;
  readyToolCalls: StartMissionToolCall[];
  proofCommands: string[];
  reviewReplies: string[];
  shortcutIndex: unknown;
}

interface MissionBundleFile {
  name: string;
  path: string;
  description: string;
}

interface MissionBundleQuickCommand {
  id: 'run' | 'status' | 'review';
  command: './mission.sh' | './status.sh' | './review.sh';
  description: string;
}

export interface MissionBundleManifest {
  schemaVersion: 1;
  kind: 'projscan.mission-bundle';
  directory: string;
  intent?: string;
  mode: StartReport['mode'];
  status: StartReport['missionControl']['status'];
  currentStep?: {
    phaseId: string;
    stepId: string;
    command?: string;
    toolCall?: StartMissionToolCall;
  };
  quickCommands: MissionBundleQuickCommand[];
  files: MissionBundleFile[];
}

export async function writeMissionBundle(
  rootPath: string,
  bundleDir: string,
  report: StartReport,
  context: MissionBundleContext,
): Promise<MissionBundleManifest> {
  const targetDir = path.resolve(rootPath, bundleDir);
  const files = missionBundleFiles(targetDir);
  const manifest: MissionBundleManifest = {
    schemaVersion: 1,
    kind: 'projscan.mission-bundle',
    directory: targetDir,
    ...(report.missionControl.intent ? { intent: report.missionControl.intent } : {}),
    mode: report.mode,
    status: report.missionControl.status,
    currentStep: missionBundleCurrentStep(report),
    quickCommands: missionBundleQuickCommands(),
    files,
  };

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(
    path.join(targetDir, 'README.md'),
    missionBundleReadme(report, files, context),
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'next-command.txt'),
    missionBundleNextCommand(report),
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'next-tool-call.json'),
    JSON.stringify(context.nextToolCall ?? null) + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'handoff-prompt.txt'),
    report.missionControl.handoffPrompt.trimEnd() + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'resume-prompt.txt'),
    report.missionControl.resume.prompt.trimEnd() + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'task-card.md'),
    report.missionControl.taskCard.markdown,
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'review-gate.md'),
    report.missionControl.reviewGate.markdown,
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'review-gate.json'),
    JSON.stringify(report.missionControl.reviewGate, null, 2) + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'review-policy.json'),
    JSON.stringify(report.missionControl.reviewGate.policy, null, 2) + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'review-replies.txt'),
    context.reviewReplies.join('\n') + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'runbook.md'),
    report.missionControl.runbook.markdown.trimEnd() + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'handoff.json'),
    JSON.stringify(report.missionControl.handoff, null, 2) + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'resume.json'),
    JSON.stringify(report.missionControl.resume, null, 2) + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'ready-tool-calls.json'),
    JSON.stringify(context.readyToolCalls, null, 2) + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'shortcuts.json'),
    JSON.stringify(context.shortcutIndex, null, 2) + '\n',
    'utf-8',
  );
  await fs.mkdir(path.join(targetDir, 'proof-logs'), { recursive: true });
  await fs.writeFile(
    path.join(targetDir, 'proof-logs', 'README.md'),
    missionProofLogsReadme(report, context.proofCommands),
    'utf-8',
  );
  await fs.writeFile(path.join(targetDir, 'proof-logs', 'status.jsonl'), '', 'utf-8');
  await fs.writeFile(
    path.join(targetDir, 'proof-logs', 'run-report.md'),
    missionInitialRunReport(),
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'proof-logs', 'summary.json'),
    JSON.stringify(missionInitialRunSummary(), null, 2) + '\n',
    'utf-8',
  );
  const missionScriptPath = path.join(targetDir, 'mission.sh');
  await fs.writeFile(
    missionScriptPath,
    buildMissionScript(report, context.proofCommands, { proofLogs: true }),
    'utf-8',
  );
  await fs.chmod(missionScriptPath, 0o755).catch(() => undefined);
  const statusScriptPath = path.join(targetDir, 'status.sh');
  await fs.writeFile(statusScriptPath, buildMissionStatusScript(), 'utf-8');
  await fs.chmod(statusScriptPath, 0o755).catch(() => undefined);
  const reviewScriptPath = path.join(targetDir, 'review.sh');
  await fs.writeFile(reviewScriptPath, buildMissionReviewScript(report), 'utf-8');
  await fs.chmod(reviewScriptPath, 0o755).catch(() => undefined);
  await fs.writeFile(
    path.join(targetDir, 'proof-commands.txt'),
    context.proofCommands.join('\n') + '\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(targetDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf-8',
  );

  return manifest;
}

export function printMissionBundle(manifest: MissionBundleManifest): void {
  console.log(chalk.green(`Wrote Mission Control bundle to ${manifest.directory}`));
  for (const file of manifest.files) {
    console.log(`- ${file.name}`);
  }
}

export function buildMissionScript(
  report: StartReport,
  proofCommands: string[],
  options: MissionScriptOptions = {},
): string {
  const mission = report.missionControl;
  const cursor = mission.executionPlan.cursor;
  const unsafeCommand = findMissionUnsafeCommand(cursor.command, proofCommands);
  const proofLogs = shouldWriteProofLogs(options, unsafeCommand, cursor.command);
  const lines = missionScriptHeader(report, unsafeCommand);

  if (unsafeCommand) {
    return missionScript(lines, missionUnsafeCommandBlock());
  }

  if (proofLogs) {
    lines.push(...missionProofLogSetup(report));
  }

  if (!cursor.command) {
    return missionScript(lines, missionMissingCommandBlock(cursor));
  }

  lines.push(
    ...scriptCommandBlock(
      'Run current command',
      cursor.command,
      proofLogs
        ? { id: `current-${cursor.stepId}`, logName: `current-${cursor.stepId}.log` }
        : undefined,
    ),
  );
  lines.push(...missionProofCommandBlocks(proofCommands, proofLogs));
  if (proofLogs) {
    lines.push(...missionSuccessfulProofLogLines(report, proofCommands));
  }
  lines.push(...missionReviewGateLines(mission.reviewGate));
  return lines.join('\n') + '\n';
}

function missionScript(lines: string[], tail: string[]): string {
  return [...lines, ...tail].join('\n') + '\n';
}

function findMissionUnsafeCommand(
  cursorCommand: string | undefined,
  proofCommands: string[],
): string | undefined {
  return [cursorCommand, ...proofCommands]
    .filter((command): command is string => typeof command === 'string')
    .find(commandHasShellExpansionSyntax);
}

function shouldWriteProofLogs(
  options: MissionScriptOptions,
  unsafeCommand: string | undefined,
  cursorCommand: string | undefined,
): boolean {
  return options.proofLogs === true && !unsafeCommand && typeof cursorCommand === 'string';
}

function missionScriptHeader(report: StartReport, unsafeCommand: string | undefined): string[] {
  const mission = report.missionControl;
  const cursor = mission.executionPlan.cursor;
  return [
    '#!/usr/bin/env sh',
    'set -eu',
    '',
    scriptPrint('projscan Mission Control'),
    ...(mission.intent && !unsafeCommand ? [scriptPrint(`Intent: ${mission.intent}`)] : []),
    scriptPrint(`Mode: ${report.mode}`),
    scriptPrint(`Status: ${mission.status}`),
    scriptPrint(`Current step: ${cursor.stepId} in ${cursor.phaseId}`),
    scriptPrint(''),
  ];
}

function missionUnsafeCommandBlock(): string[] {
  return [
    scriptPrintError(
      'Blocked: mission command contains shell control syntax; inspect --next-command before running it.',
    ),
    'exit 2',
  ];
}

function missionProofLogSetup(report: StartReport): string[] {
  return [
    'MISSION_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)',
    'PROJSCAN_ROOT=$(git -C "$MISSION_DIR" rev-parse --show-toplevel 2>/dev/null || pwd)',
    `PROJSCAN_NODE=${shellQuote(process.execPath)}`,
    `PROJSCAN_CLI=${shellQuote(currentProjscanCliPath())}`,
    'PROOF_LOG_DIR="${MISSION_DIR}/proof-logs"',
    'PROOF_STATUS_FILE="${PROOF_LOG_DIR}/status.jsonl"',
    'PROOF_REPORT_FILE="${PROOF_LOG_DIR}/run-report.md"',
    'PROOF_SUMMARY_FILE="${PROOF_LOG_DIR}/summary.json"',
    'mkdir -p "$PROOF_LOG_DIR"',
    ': > "$PROOF_STATUS_FILE"',
    ': > "$PROOF_REPORT_FILE"',
    ...scriptAppendProofLedgerFunction(),
    ...scriptInitRunReport(report),
    scriptWriteSummaryJson('running'),
    scriptPrintExpanded('Proof logs: ${PROOF_LOG_DIR}'),
    scriptPrintExpanded('Run report: ${PROOF_REPORT_FILE}'),
    scriptPrintExpanded('Summary: ${PROOF_SUMMARY_FILE}'),
    scriptPrint(''),
  ];
}

function missionMissingCommandBlock(
  cursor: StartReport['missionControl']['executionPlan']['cursor'],
): string[] {
  return [scriptPrintError(`Blocked: ${cursor.instruction ?? cursor.label}`), 'exit 2'];
}

function missionProofCommandBlocks(proofCommands: string[], proofLogs: boolean): string[] {
  if (proofCommands.length === 0) return [];
  const lines = [scriptPrint(''), scriptPrint('Run remaining proof')];
  for (const [index, command] of proofCommands.entries()) {
    lines.push(
      ...scriptCommandBlock(
        `Proof ${index + 1}`,
        command,
        proofLogs ? { id: `proof-${index + 1}`, logName: `proof-${index + 1}.log` } : undefined,
      ),
    );
  }
  return lines;
}

function missionSuccessfulProofLogLines(report: StartReport, proofCommands: string[]): string[] {
  const cursor = report.missionControl.executionPlan.cursor;
  const totalLoggedCommands =
    typeof cursor.command === 'string' ? 1 + proofCommands.length : proofCommands.length;
  const reviewGate = report.missionControl.reviewGate;
  return [
    ...scriptAppendRunReportResult('passed'),
    scriptWriteSummaryJson('passed', { totalCommands: totalLoggedCommands }),
    ...scriptAppendRunReportReviewGate(reviewGate.stopCondition, reviewGate.commands),
  ];
}

function missionReviewGateLines(reviewGate: StartReport['missionControl']['reviewGate']): string[] {
  return [
    scriptPrint(''),
    scriptPrint('Review gate'),
    scriptPrint(reviewGate.stopCondition),
    ...reviewGate.commands.map((command) => scriptPrint(`Capture: ${command}`)),
  ];
}

function missionBundleQuickCommands(): MissionBundleQuickCommand[] {
  return [
    {
      id: 'run',
      command: './mission.sh',
      description: 'Run the current command and remaining proof.',
    },
    {
      id: 'status',
      command: './status.sh',
      description: 'Print the latest mission state and next action.',
    },
    {
      id: 'review',
      command: './review.sh',
      description: 'Print the review packet for approval.',
    },
  ];
}

function missionBundleFiles(targetDir: string): MissionBundleFile[] {
  return [
    {
      name: 'README.md',
      path: path.join(targetDir, 'README.md'),
      description: 'Quickstart for humans opening the bundle.',
    },
    {
      name: 'next-command.txt',
      path: path.join(targetDir, 'next-command.txt'),
      description: 'Current shell command or resume instruction.',
    },
    {
      name: 'next-tool-call.json',
      path: path.join(targetDir, 'next-tool-call.json'),
      description: 'Current MCP tool call, or null when no mapped call exists.',
    },
    {
      name: 'handoff-prompt.txt',
      path: path.join(targetDir, 'handoff-prompt.txt'),
      description: 'Copyable prompt for handing this mission to another agent.',
    },
    {
      name: 'resume-prompt.txt',
      path: path.join(targetDir, 'resume-prompt.txt'),
      description: 'Focused prompt for resuming the current cursor.',
    },
    {
      name: 'task-card.md',
      path: path.join(targetDir, 'task-card.md'),
      description: 'Paste-ready Markdown task card for PRs, issues, and handoffs.',
    },
    {
      name: 'review-gate.md',
      path: path.join(targetDir, 'review-gate.md'),
      description: 'Stop-and-review gate for approving another slice, release, publish, or deploy.',
    },
    {
      name: 'review-gate.json',
      path: path.join(targetDir, 'review-gate.json'),
      description:
        'Machine-readable review gate with policy, proof, decisions, and worktree evidence.',
    },
    {
      name: 'review-policy.json',
      path: path.join(targetDir, 'review-policy.json'),
      description: 'Machine-readable review approval boundary and blocked actions.',
    },
    {
      name: 'review-replies.txt',
      path: path.join(targetDir, 'review-replies.txt'),
      description:
        'Copy-only reviewer reply choices for approving or redirecting the stopped mission.',
    },
    {
      name: 'runbook.md',
      path: path.join(targetDir, 'runbook.md'),
      description: 'Human-readable Mission Control runbook.',
    },
    {
      name: 'handoff.json',
      path: path.join(targetDir, 'handoff.json'),
      description: 'Structured Mission Control handoff object.',
    },
    {
      name: 'resume.json',
      path: path.join(targetDir, 'resume.json'),
      description: 'Focused resume object for the current cursor.',
    },
    {
      name: 'ready-tool-calls.json',
      path: path.join(targetDir, 'ready-tool-calls.json'),
      description: 'Current cursor MCP call followed by remaining MCP-callable proof.',
    },
    {
      name: 'shortcuts.json',
      path: path.join(targetDir, 'shortcuts.json'),
      description: 'Machine-readable Mission Control shortcut command index.',
    },
    {
      name: 'mission.sh',
      path: path.join(targetDir, 'mission.sh'),
      description: 'Shell script that runs the current cursor command and remaining proof queue.',
    },
    {
      name: 'status.sh',
      path: path.join(targetDir, 'status.sh'),
      description: 'Shell script that prints the latest mission run state from summary.json.',
    },
    {
      name: 'review.sh',
      path: path.join(targetDir, 'review.sh'),
      description:
        'Shell script that prints status, review evidence, run report, and reviewer replies.',
    },
    {
      name: 'proof-logs/README.md',
      path: path.join(targetDir, 'proof-logs', 'README.md'),
      description: 'Proof-log index for output written by mission.sh.',
    },
    {
      name: 'proof-logs/status.jsonl',
      path: path.join(targetDir, 'proof-logs', 'status.jsonl'),
      description: 'Runtime status rows written by mission.sh.',
    },
    {
      name: 'proof-logs/run-report.md',
      path: path.join(targetDir, 'proof-logs', 'run-report.md'),
      description: 'Human-readable run report refreshed by mission.sh.',
    },
    {
      name: 'proof-logs/summary.json',
      path: path.join(targetDir, 'proof-logs', 'summary.json'),
      description: 'Machine-readable mission run state refreshed by mission.sh.',
    },
    {
      name: 'proof-commands.txt',
      path: path.join(targetDir, 'proof-commands.txt'),
      description: 'Remaining ready proof commands, one per line.',
    },
    {
      name: 'manifest.json',
      path: path.join(targetDir, 'manifest.json'),
      description: 'Bundle index with mode, status, current step, and file paths.',
    },
  ];
}

function missionBundleReadme(
  report: StartReport,
  files: MissionBundleFile[],
  context: MissionBundleContext,
): string {
  const mission = report.missionControl;
  const cursor = mission.executionPlan.cursor;
  const lines = [
    '# Mission Bundle',
    '',
    ...(mission.intent ? [`Intent: ${mission.intent}`] : []),
    `Mode: ${report.mode}`,
    `Status: ${mission.status}`,
    `Current step: ${cursor.stepId} in ${cursor.phaseId}`,
    '',
    '## Quick Commands',
    '',
    '```sh',
    './mission.sh',
    './status.sh',
    './review.sh',
    '```',
    '',
    '- `./mission.sh` runs the current command and remaining proof.',
    '- `./status.sh` prints the latest mission state and next action.',
    '- `./review.sh` prints the review packet for approval.',
    '',
    '## Run Next',
    '',
  ];

  if (cursor.command) {
    lines.push('```sh', cursor.command, '```');
  } else {
    lines.push(mission.resume.instruction);
  }

  if (context.nextToolCall) {
    lines.push(
      '',
      `MCP call: \`${context.nextToolCall.tool} ${JSON.stringify(context.nextToolCall.args ?? {})}\``,
    );
  }

  if (context.reviewReplies.length > 0) {
    lines.push('', '## Reviewer Replies', '', ...context.reviewReplies);
  }

  lines.push('', '## Files');
  for (const file of files) {
    lines.push(`- \`${file.name}\`: ${file.description}`);
  }

  return lines.join('\n').trimEnd() + '\n';
}

function missionBundleNextCommand(report: StartReport): string {
  return `${report.missionControl.executionPlan.cursor.command ?? report.missionControl.resume.instruction}\n`;
}

function missionBundleCurrentStep(report: StartReport): MissionBundleManifest['currentStep'] {
  const cursor = report.missionControl.executionPlan.cursor;
  return {
    phaseId: cursor.phaseId,
    stepId: cursor.stepId,
    ...(cursor.command ? { command: cursor.command } : {}),
    ...(cursor.tool
      ? {
          toolCall: {
            tool: cursor.tool,
            ...(typeof cursor.args !== 'undefined' ? { args: cursor.args } : {}),
          },
        }
      : {}),
  };
}

function buildMissionStatusScript(): string {
  return [
    '#!/usr/bin/env sh',
    'set -eu',
    '',
    'MISSION_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)',
    'SUMMARY_FILE="${MISSION_DIR}/proof-logs/summary.json"',
    '',
    'if ! command -v node >/dev/null 2>&1; then',
    `  ${scriptPrintError('Node.js is required to read proof-logs/summary.json.')}`,
    '  exit 2',
    'fi',
    '',
    'node - "$SUMMARY_FILE" <<\'NODE\'',
    'const fs = require("node:fs");',
    'const summaryPath = process.argv[2];',
    'let summary;',
    'try {',
    '  summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));',
    '} catch (error) {',
    '  console.error(`Unable to read ${summaryPath}: ${error.message}`);',
    '  process.exit(2);',
    '}',
    'const status = typeof summary.status === "string" ? summary.status : "unknown";',
    'console.log(`Mission status: ${status}`);',
    'if (summary.report) console.log(`Report: ${summary.report}`);',
    'if (summary.statusRows) console.log(`Status rows: ${summary.statusRows}`);',
    'if (summary.totalCommands !== undefined) console.log(`Total commands: ${summary.totalCommands}`);',
    'if (summary.failedStep) console.log(`Failed step: ${summary.failedStep}`);',
    'if (summary.exitCode !== undefined) console.log(`Exit code: ${summary.exitCode}`);',
    'if (summary.log) console.log(`Log: ${summary.log}`);',
    `const nextActions = ${JSON.stringify(missionRunNextActions)};`,
    'const nextAction = typeof summary.nextAction === "string" ? summary.nextAction : nextActions[status] ?? "inspect proof-logs/summary.json.";',
    'console.log(`Next action: ${nextAction}`);',
    'process.exitCode = status === "passed" ? 0 : status === "failed" ? 1 : 2;',
    'NODE',
    '',
  ].join('\n');
}

function buildMissionReviewScript(report: StartReport): string {
  const evidenceCommands = report.missionControl.reviewGate.commands;
  return [
    '#!/usr/bin/env sh',
    'set -eu',
    '',
    'MISSION_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)',
    'status_code=2',
    '',
    scriptPrint('Mission Review'),
    scriptPrint(''),
    'if [ -x "${MISSION_DIR}/status.sh" ]; then',
    '  set +e',
    '  "${MISSION_DIR}/status.sh"',
    '  status_code=$?',
    '  set -e',
    'else',
    `  ${scriptPrintError('Missing status.sh; run projscan start --save-mission again.')}`,
    'fi',
    '',
    scriptPrint(''),
    scriptPrint('Review gate: review-gate.md'),
    'if [ -f "${MISSION_DIR}/review-gate.md" ]; then',
    '  sed -n \'1,220p\' "${MISSION_DIR}/review-gate.md"',
    'else',
    `  ${scriptPrintError('Missing review-gate.md.')}`,
    'fi',
    '',
    scriptPrint(''),
    scriptPrint('Run report: proof-logs/run-report.md'),
    'if [ -f "${MISSION_DIR}/proof-logs/run-report.md" ]; then',
    '  sed -n \'1,220p\' "${MISSION_DIR}/proof-logs/run-report.md"',
    'else',
    `  ${scriptPrintError('Missing proof-logs/run-report.md. Run ./mission.sh to create proof output.')}`,
    'fi',
    '',
    scriptPrint(''),
    scriptPrint('Evidence commands'),
    ...evidenceCommands.map((command) => scriptPrint(`- ${command}`)),
    '',
    scriptPrint(''),
    scriptPrint('Reviewer replies:'),
    'if [ -f "${MISSION_DIR}/review-replies.txt" ]; then',
    '  cat "${MISSION_DIR}/review-replies.txt"',
    'else',
    `  ${scriptPrintError('Missing review-replies.txt.')}`,
    'fi',
    '',
    'exit "$status_code"',
    '',
  ].join('\n');
}

interface MissionScriptOptions {
  proofLogs?: boolean;
}

function missionProofLogsReadme(report: StartReport, proofCommands: string[]): string {
  const entries = missionProofLogEntries(report, proofCommands);
  const lines = [
    '# Mission Proof Logs',
    '',
    'Run `./mission.sh` from this bundle to write command output here.',
    'Read `run-report.md` first for pass/fail proof after `mission.sh` runs.',
    'Read `summary.json` for the latest not_run, running, passed, or failed state.',
    'Read `status.jsonl` for command exit codes after `mission.sh` runs.',
    '',
    '## Expected Logs',
    '',
  ];
  if (entries.length === 0) {
    lines.push('No runnable proof logs are planned for this mission.');
  } else {
    for (const entry of entries) {
      lines.push(`- \`${entry.name}\`: \`${entry.command}\``);
    }
  }
  return lines.join('\n').trimEnd() + '\n';
}

function missionInitialRunReport(): string {
  return [
    '# Mission Run Report',
    '',
    'Run `./mission.sh` to refresh this report with command exit codes and log links.',
    'Review `status.jsonl` for machine-readable status rows.',
    '',
  ].join('\n');
}

function missionInitialRunSummary(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    status: 'not_run',
    nextAction: missionRunNextActions.not_run,
    report: 'proof-logs/run-report.md',
    statusRows: 'proof-logs/status.jsonl',
  };
}

function missionProofLogEntries(
  report: StartReport,
  proofCommands: string[],
): Array<{ name: string; command: string }> {
  const cursor = report.missionControl.executionPlan.cursor;
  const unsafeCommand = [cursor.command, ...proofCommands]
    .filter((command): command is string => typeof command === 'string')
    .find(commandHasShellExpansionSyntax);
  if (unsafeCommand || !cursor.command) return [];
  return [
    { name: `current-${cursor.stepId}.log`, command: cursor.command },
    ...proofCommands.map((command, index) => ({ name: `proof-${index + 1}.log`, command })),
  ];
}

interface MissionScriptLogTarget {
  id: string;
  logName: string;
}

function scriptCommandBlock(
  label: string,
  command: string,
  logTarget: MissionScriptLogTarget | undefined,
): string[] {
  if (!logTarget) return [scriptPrint(label), command];
  return [
    scriptPrint(label),
    scriptPrint(`Writing proof-logs/${logTarget.logName}`),
    'set +e',
    '{',
    `  ${command}`,
    `} > "$PROOF_LOG_DIR/${logTarget.logName}" 2>&1`,
    'status=$?',
    'set -e',
    scriptAppendStatusJsonl(logTarget.id, label, logTarget.logName, command),
    scriptAppendProofLedgerJsonl(logTarget.id, label, logTarget.logName, command),
    scriptAppendReportRow(logTarget.id, label, logTarget.logName),
    'if [ "$status" -ne 0 ]; then',
    `  ${scriptPrintError(`Command failed. See proof-logs/${logTarget.logName}.`)}`,
    ...scriptAppendReportFailure(logTarget.id, logTarget.logName),
    `  ${scriptWriteSummaryJson('failed', { failedStep: logTarget.id, logName: logTarget.logName })}`,
    `  ${scriptPrintExpanded('Run report: ${PROOF_REPORT_FILE}')}`,
    `  ${scriptPrintExpanded('Summary: ${PROOF_SUMMARY_FILE}')}`,
    '  exit "$status"',
    'fi',
  ];
}

function scriptPrint(value: string): string {
  return `printf '%s\\n' ${shellQuote(value)}`;
}

function scriptPrintExpanded(value: string): string {
  return `printf '%s\\n' "${value.replace(/(["\\])/g, '\\$1')}"`;
}

function scriptAppendStatusJsonl(
  id: string,
  label: string,
  logName: string,
  command: string,
): string {
  const prefix = JSON.stringify({
    id,
    label,
    log: logName,
    command,
  }).replace(/}$/, ',"exitCode":');
  return `printf '%s%s%s\\n' ${shellQuote(prefix)} "$status" '}' >> "$PROOF_STATUS_FILE"`;
}

function scriptAppendProofLedgerFunction(): string[] {
  return [
    'append_proof_ledger_row() {',
    '  label=$2',
    '  command=$4',
    '  exit_code=$5',
    '  summary="Mission proof ${label} exited ${exit_code}."',
    '  if ! (CDPATH= cd "$PROJSCAN_ROOT" && "$PROJSCAN_NODE" "$PROJSCAN_CLI" prove --record-command "$command" --record-source mission --exit-code "$exit_code" --duration-ms 0 --summary "$summary" --format json >/dev/null); then',
    '    printf \'%s\\n\' "Failed to record mission proof ledger row for ${label}." >&2',
    '    exit 1',
    '  fi',
    '}',
    '',
  ];
}

function scriptAppendProofLedgerJsonl(
  id: string,
  label: string,
  logName: string,
  command: string,
): string {
  return `append_proof_ledger_row ${shellQuote(id)} ${shellQuote(label)} ${shellQuote(logName)} ${shellQuote(command)} "$status"`;
}

function scriptInitRunReport(report: StartReport): string[] {
  const mission = report.missionControl;
  return [
    '{',
    `  ${scriptPrint('# Mission Run Report')}`,
    `  ${scriptPrint('')}`,
    ...(mission.intent ? [`  ${scriptPrint(`Intent: ${mission.intent}`)}`] : []),
    `  ${scriptPrint(`Mode: ${report.mode}`)}`,
    `  ${scriptPrint(`Status: ${mission.status}`)}`,
    `  ${scriptPrint(`Current step: ${mission.executionPlan.cursor.stepId} in ${mission.executionPlan.cursor.phaseId}`)}`,
    `  ${scriptPrint('')}`,
    `  ${scriptPrint('| Step | Label | Exit | Log |')}`,
    `  ${scriptPrint('| --- | --- | ---: | --- |')}`,
    '} >> "$PROOF_REPORT_FILE"',
  ];
}

function scriptAppendReportRow(id: string, label: string, logName: string): string {
  return `printf '| %s | %s | %s | %s |\\n' ${shellQuote(id)} ${shellQuote(label)} "$status" ${shellQuote(`proof-logs/${logName}`)} >> "$PROOF_REPORT_FILE"`;
}

function scriptAppendReportFailure(id: string, logName: string): string[] {
  return [
    ...scriptAppendRunReportResult('failed'),
    '  {',
    `    ${scriptPrint(`Failed step: ${id}`)}`,
    `    ${scriptPrint(`Log: proof-logs/${logName}`)}`,
    '  } >> "$PROOF_REPORT_FILE"',
  ];
}

type MissionRunSummaryStatus = 'running' | 'passed' | 'failed';

const missionRunNextActions = {
  not_run: 'run ./mission.sh to generate proof.',
  running: 'wait for ./mission.sh to finish, or inspect proof-logs/status.jsonl.',
  failed: 'inspect the failed log, fix the issue, then rerun ./mission.sh.',
  passed: 'run ./review.sh and choose a reviewer reply.',
} as const;

interface MissionRunSummaryOptions {
  totalCommands?: number;
  failedStep?: string;
  logName?: string;
}

function scriptWriteSummaryJson(
  status: MissionRunSummaryStatus,
  options: MissionRunSummaryOptions = {},
): string {
  const base = {
    schemaVersion: 1,
    status,
    nextAction: missionRunNextActions[status],
    report: 'proof-logs/run-report.md',
    statusRows: 'proof-logs/status.jsonl',
    ...(typeof options.totalCommands === 'number' ? { totalCommands: options.totalCommands } : {}),
    ...(options.failedStep ? { failedStep: options.failedStep } : {}),
    ...(options.logName ? { log: `proof-logs/${options.logName}` } : {}),
  };
  if (status !== 'failed') {
    return `printf '%s\\n' ${shellQuote(JSON.stringify(base))} > "$PROOF_SUMMARY_FILE"`;
  }
  const prefix = JSON.stringify(base).replace(/}$/, ',"exitCode":');
  return `printf '%s%s%s\\n' ${shellQuote(prefix)} "$status" '}' > "$PROOF_SUMMARY_FILE"`;
}

function scriptAppendRunReportResult(status: 'passed' | 'failed'): string[] {
  const message =
    status === 'passed'
      ? 'All current and proof commands exited 0.'
      : 'Mission stopped before completion.';
  return [
    '{',
    `  ${scriptPrint('')}`,
    `  ${scriptPrint('## Result')}`,
    `  ${scriptPrint(message)}`,
    '} >> "$PROOF_REPORT_FILE"',
  ];
}

function scriptAppendRunReportReviewGate(stopCondition: string, commands: string[]): string[] {
  return [
    '{',
    `  ${scriptPrint('')}`,
    `  ${scriptPrint('## Review Gate')}`,
    `  ${scriptPrint(stopCondition)}`,
    ...commands.map((command) => `  ${scriptPrint(`- ${command}`)}`),
    '} >> "$PROOF_REPORT_FILE"',
  ];
}

function scriptPrintError(value: string): string {
  return `${scriptPrint(value)} >&2`;
}

function commandHasShellExpansionSyntax(command: string): boolean {
  let backslashCount = 0;
  for (const char of command) {
    if (char === '\\') {
      backslashCount += 1;
      continue;
    }
    const escaped = backslashCount % 2 === 1;
    if (isUnsafeShellControlChar(char) && !escaped) return true;
    backslashCount = 0;
  }
  return false;
}

function isUnsafeShellControlChar(char: string): boolean {
  return (
    char === '$' ||
    char === '`' ||
    char === ';' ||
    char === '|' ||
    char === '&' ||
    char === '\n' ||
    char === '\r'
  );
}

function currentProjscanCliPath(): string {
  return path.resolve(process.argv[1] ?? 'dist/cli/index.js');
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
