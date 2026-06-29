import fs from 'node:fs';
import { expect, test } from 'vitest';

test('docs describe executable Proof Contracts without release automation claims', () => {
  const readme = fs.readFileSync('README.md', 'utf8');
  const guide = fs.readFileSync('docs/GUIDE.md', 'utf8');
  const stability = fs.readFileSync('docs/STABILITY.md', 'utf8');
  const decisions = fs.readFileSync('DECISIONS.md', 'utf8');
  const websitePrompt = fs.readFileSync('docs/WEBSITE-UPDATE-PROMPT.md', 'utf8');
  const reviewPacket = fs.readFileSync('docs/REVIEW-PACKET.md', 'utf8');
  const manifest = JSON.parse(fs.readFileSync('dist/tool-manifest.json', 'utf8')) as {
    tools: { name: string }[];
  };

  for (const doc of [readme, guide]) {
    expect(doc).toContain('projscan prove --intent "is my agent allowed to change billing retry logic?"');
    expect(doc).toContain('projscan prove --run --');
    expect(doc).toContain('projscan prove --record-command');
    expect(doc).toContain('projscan prove --changed --contract .projscan/proof-contract.json --format markdown');
    expect(doc).toContain('Proof Contract');
    expect(doc).toContain('Proof Ledger');
    expect(doc).toContain('Proof Receipt');
    expect(doc).toContain('Verified Workflow');
    expect(doc).toContain('verifiedWorkflow');
    expect(doc).toContain('Proof Sufficiency');
    expect(doc).toContain('proofRequirements');
    expect(doc).toContain('proofSufficiency');
    expect(doc).toContain('Proof Replay');
    expect(doc).toContain('proofReplay');
    expect(doc).toContain('changedAfterProof');
    expect(doc).toContain('receipt fingerprint');
    expect(doc).toContain('Team Proof Recipes');
    expect(doc).toContain('proofRecipes');
    expect(doc).toContain('when a matching recipe is configured');
    expect(doc).toContain('does not run proof commands by itself');
    expect(doc).toContain('projscan proof-broker');
    expect(doc).toContain('PR Passport');
    expect(doc).toContain('required proof');
    expect(doc).toContain('required reviewers');
    expect(doc).toContain('projscan evidence-pack --pr-comment');
    expect(doc).toContain('start -> prove -> run -> changed');
    expect(doc).toContain('Make the bounded edit');
    expect(doc).toContain('allowed files');
    expect(doc).toContain('forbidden files');
    expect(doc).toContain('classifies changed files');
  }

  expect(readme).toContain('| `projscan prove`');
  expect(readme).toContain('| `projscan proof-broker`');
  expect(readme).toContain('allowed production');
  expect(readme).toContain('unexpected production');
  expect(readme).toContain('Proof Sufficiency estimates whether the local ledger covers each changed surface');
  expect(readme).toContain('.projscan/proof-contract.json');
  expect(readme).toContain('.projscan/proof-ledger.jsonl');
  expect(readme).toContain('.projscan/proof-logs/');
  expect(readme).toContain('TypeScript, JavaScript, Python, Go, Java, Ruby, Rust, PHP, C#, Kotlin, Swift, and C++');
  expect(readme).not.toContain('Swift, C, and C++');
  expect(readme).not.toContain('current 47-tool MCP');
  expect(readme).toContain('review evidence with risks, owners, proof receipts, and next commands');
  expect(readme).not.toContain('PR-ready proof');
  expect(readme).not.toContain('trusted next actions');
  expect(guide).toContain('**`projscan_prove` / `projscan prove`**');
  expect(guide).toContain('reviewer checklist');
  expect(guide).toContain('| `proofRecipes`');
  expect(guide).toContain('requiredCommands: string[]');
  expect(guide).not.toContain('requiredCommands?: string[]');
  expect(guide).toContain('only the CLI `prove --run` executes local commands');
  expect(guide).toContain('MCP records and replays imported proof; only CLI `prove --run` executes commands.');
  expect(guide).toContain('### assess');
  expect(guide).toContain('### simulate');
  expect(guide).toContain('### prove');
  expect(guide).toContain('### evidence-pack');
  expect(guide).toContain('### proof-broker');
  expect(guide).toContain('### privacy-check');
  expect(guide).toContain('### mission-proof');
  expect(guide).toContain('AST-aware adapters cover TypeScript, JavaScript, Python, Go, Rust, Java, C#, C++, Ruby, PHP, Swift, and Kotlin');
  expect(guide).toContain('The `explain-issue` command performs regex-based static analysis around one issue');
  expect(guide).not.toContain('The `explain` command');
  expect(stability).toContain('projscan_prove');
  expect(stability).toContain('projscan_proof_broker');
  expect(stability).toContain('proof-broker');
  expect(stability).toContain('--output-passport');
  expect(stability).toContain('--pr-comment');
  expect(stability).toContain('--run-timeout-ms');
  expect(stability).toContain('proofRecipes');
  expect(stability).toContain('requiredCommands');
  expect(stability).toContain('Team Proof Recipe');
  const stableCommandLine = stability.match(/- \*\*Command names\*\*: ([\s\S]*?) New commands/)?.[1] ?? '';
  for (const command of [
    'collisions',
    'claim',
    'coordinate',
    'dogfood',
    'feedback',
    'merge-risk',
    'mission-proof',
    'privacy-check',
    'route',
    'start',
    'telemetry',
    'trial',
  ]) {
    expect(stableCommandLine).toContain(`\`${command}\``);
  }
  expect(stableCommandLine).not.toContain('`explain`');
  expect(stability).toContain('command-specific validation failure');
  for (const tool of manifest.tools) {
    expect(stability).toContain(`\`${tool.name}\``);
  }
  expect(stability).not.toContain('`projscan_graph`');
  expect(stability).not.toContain('`projscan_explain`,');
  expect(decisions).toContain('Add executable Proof Contracts as the closed loop above Proof Cards');
  expect(decisions).toContain('Add Proof Broker and PR Passport');
  expect(decisions).toContain('Add Team Proof Recipes to proof receipts');
  expect(decisions).toContain('Trust Memory confidence adjustment');
  expect(websitePrompt).toContain('4.18.0: Review Gate for AI code handoffs');
  expect(websitePrompt).toContain('projscan review-gate --intent');
  expect(websitePrompt).toContain('projscan review-gate --contract');
  expect(websitePrompt).toContain('projscan review-gate --ci');
  expect(websitePrompt).toContain('projscan proof-broker --contract');
  expect(websitePrompt).toContain('Agent Change Passport');
  expect(websitePrompt).toContain('projscan passport --intent');
  expect(websitePrompt).toContain('projscan guard --contract');
  expect(websitePrompt).toContain('Baseframe Suite Integration v1');
  expect(websitePrompt).toContain('.baseframe/evidence/<task-id>/projscan-assessment.json');
  expect(websitePrompt).toContain('Proof Ledger');
  expect(websitePrompt).toContain('projscan prove --run');
  expect(websitePrompt).toContain('Proof Replay');
  expect(websitePrompt).toContain('Proof Sufficiency');
  expect(websitePrompt).toContain('Team Proof Recipes');
  expect(websitePrompt).toContain('51 MCP tools');
  expect(websitePrompt).toContain('projscan_review_gate');
  expect(websitePrompt).toContain('changed-after-proof files');
  expect(websitePrompt).toContain('CLI `prove --run` executes local commands');
  expect(websitePrompt).not.toContain('Know whether the agent stayed inside the contract.');
  expect(reviewPacket).toContain('Historical review packet');
  expect(reviewPacket).toContain('4.6.0 historical release candidate');
});
