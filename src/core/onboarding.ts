import type { StartFirstTenMinutes, WorkplanMode } from '../types.js';

export function buildFirstTenMinutes(mode: WorkplanMode = 'before_edit'): StartFirstTenMinutes {
  const preflightMode = firstTenMinutesPreflightMode(mode);
  return {
    title: 'First 10 minutes with projscan',
    outcome: 'Verify the local trust boundary, orient the workflow, gate the first edit, then produce reviewer-facing PR evidence.',
    commands: [
      {
        id: 'trust-boundary',
        label: 'Verify trust boundary',
        why: 'Shows offline mode, telemetry, ignored-file handling, env scanning, plugin execution, local writes, and network-capable endpoints before broader analysis.',
        command: 'projscan privacy-check --offline',
      },
      {
        id: 'orient',
        label: 'Orient the repo',
        why: 'Combines setup diagnostics, recommended workflow, top risks, adoption gaps, and next commands.',
        command: `projscan start --mode ${mode}`,
      },
      {
        id: 'preflight',
        label: preflightLabel(preflightMode),
        why: preflightWhy(preflightMode),
        command: `projscan preflight --mode ${preflightMode} --format json`,
      },
      {
        id: 'mcp-setup',
        label: 'Verify MCP setup',
        why: 'Returns ready-to-paste MCP config for the active coding client.',
        command: 'projscan mcp doctor --client codex --format json',
      },
      {
        id: 'first-pr-evidence',
        label: 'Generate first PR evidence',
        why: 'Creates the reviewer-facing verdict, first fix, owner routing, verification, and feedback prompt.',
        command: 'projscan evidence-pack --pr-comment',
      },
      {
        id: 'feedback-capture',
        label: 'Capture reviewer feedback',
        why: 'Records whether the PR comment saved time, prevented a bad edit, or produced noise.',
        command: 'projscan feedback add --file .projscan-feedback.json --repo <repo> --pr <url> --reviewer <handle> --useful true --minutes-saved 10',
      },
      {
        id: 'adoption-proof',
        label: 'Run adoption proof',
        why: 'Rolls repo coverage and reviewer feedback into measured adoption proof.',
        command: 'projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json',
      },
    ],
  };
}

function firstTenMinutesPreflightMode(mode: WorkplanMode): 'before_edit' | 'before_commit' | 'before_merge' {
  if (mode === 'before_commit') return 'before_commit';
  if (mode === 'hardening') return 'before_commit';
  if (mode === 'before_merge' || mode === 'release') return 'before_merge';
  return 'before_edit';
}

function preflightLabel(mode: 'before_edit' | 'before_commit' | 'before_merge'): string {
  if (mode === 'before_commit') return 'Gate the commit';
  if (mode === 'before_merge') return 'Gate the merge';
  return 'Gate the first edit';
}

function preflightWhy(mode: 'before_edit' | 'before_commit' | 'before_merge'): string {
  if (mode === 'before_commit') return 'Returns proceed, caution, or block before a developer commits the change.';
  if (mode === 'before_merge') return 'Returns proceed, caution, or block before a branch is merged or released.';
  return 'Returns proceed, caution, or block before an agent changes code.';
}
