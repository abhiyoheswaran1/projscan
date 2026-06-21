import fs from 'node:fs';
import { expect, test } from 'vitest';

test('docs describe the risk delta simulator workflow', () => {
  const readme = fs.readFileSync('README.md', 'utf8');
  const guide = fs.readFileSync('docs/GUIDE.md', 'utf8');
  const stability = fs.readFileSync('docs/STABILITY.md', 'utf8');

  expect(readme).toContain('projscan simulate --plan "split bugHunt.ts into ranking, evidence, and output modules"');
  expect(readme).toContain('risk delta simulator');
  expect(guide).toContain('projscan_simulate');
  expect(guide).toContain('projscan simulate --plan');
  expect(stability).toContain('projscan_simulate');
  expect(stability).toContain('simulate');
});

