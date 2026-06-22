import fs from 'node:fs';
import { expect, test } from 'vitest';

test('docs introduce proof-first assess without release automation claims', () => {
  const readme = fs.readFileSync('README.md', 'utf8');
  const guide = fs.readFileSync('docs/GUIDE.md', 'utf8');
  const decisions = fs.readFileSync('DECISIONS.md', 'utf8');

  for (const doc of [readme, guide]) {
    expect(doc).toContain('projscan assess --goal "make this repo safer to ship this week"');
    expect(doc).toContain('Proof Cards');
    expect(doc).toContain('projscan assess --mode fix-first --format markdown');
    expect(doc).toContain('risk delta');
    expect(doc).toContain('evidence strength');
    expect(doc).toContain('trust memory');
    expect(doc).toContain('AgentLoopKit handoff');
    expect(doc).toContain('does not release, tag, publish, or deploy');
  }

  expect(readme).toContain('Your agent / engineer');
  expect(readme).toContain('runs locally, source stays on this machine');
  expect(readme).toContain('projscan start --intent "is this safe to commit?"');
  expect(readme).toContain('| `projscan assess`');
  expect(guide).toContain('**`projscan_assess` / `projscan assess`**');
  expect(decisions).toContain('Add proof-first assessment as a read-only command');
  expect(decisions).toContain('Proof Cards V2 trust loop and simulator alternatives');
});
