import fs from 'node:fs';
import { expect, test } from 'vitest';

test('docs describe executable Proof Contracts without release automation claims', () => {
  const readme = fs.readFileSync('README.md', 'utf8');
  const guide = fs.readFileSync('docs/GUIDE.md', 'utf8');
  const stability = fs.readFileSync('docs/STABILITY.md', 'utf8');
  const decisions = fs.readFileSync('DECISIONS.md', 'utf8');
  const websitePrompt = fs.readFileSync('docs/WEBSITE-UPDATE-PROMPT.md', 'utf8');

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
    expect(doc).toContain('start -> prove -> run -> changed');
    expect(doc).toContain('allowed files');
    expect(doc).toContain('forbidden files');
    expect(doc).toContain('classifies changed files');
  }

  expect(readme).toContain('| `projscan prove`');
  expect(readme).toContain('allowed production');
  expect(readme).toContain('unexpected production');
  expect(guide).toContain('**`projscan_prove` / `projscan prove`**');
  expect(guide).toContain('reviewer checklist');
  expect(stability).toContain('projscan_prove');
  expect(stability).toContain('--run-timeout-ms');
  expect(decisions).toContain('Add executable Proof Contracts as the closed loop above Proof Cards');
  expect(decisions).toContain('Trust Memory confidence adjustment');
  expect(websitePrompt).toContain('Next Release Prompt: Verified Change Workflow and Executed Proof Runner');
  expect(websitePrompt).toContain('Proof Ledger');
  expect(websitePrompt).toContain('projscan prove --run');
  expect(websitePrompt).toContain('Proof Receipts separate allowed production');
  expect(websitePrompt).toContain('48 MCP tools');
});
