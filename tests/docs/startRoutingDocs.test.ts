import fs from 'node:fs';
import { expect, test } from 'vitest';

test('start routing docs separate generic build-next prompts from explicit roadmap planning', () => {
  const readme = fs.readFileSync('README.md', 'utf8');
  const guide = fs.readFileSync('docs/GUIDE.md', 'utf8');

  expect(readme).toContain(
    'projscan start --intent "what should we build next?" # Routes to a before-edit implementation workplan',
  );
  expect(readme).not.toContain('Routes to release-train roadmap planning');

  expect(guide).toContain('projscan_release_train');
  expect(guide).toContain('projscan release-train');
  expect(guide).toContain('roadmapPreview');
  expect(guide).toContain(
    'For generic build-next questions, such as `projscan start --intent "what should we build next?"`, it routes to `projscan_workplan --mode before_edit`',
  );
  expect(guide).toContain(
    'For explicit product-roadmap questions, such as `projscan start --intent "plan the product roadmap"`',
  );
  expect(guide).not.toContain('routes to `projscan_workplan --mode bug_hunt`');

  expect(guide).toContain(
    'For broad improvement-planning questions, such as `projscan start --intent "what should we improve next?"`, it routes to `projscan_bug_hunt`',
  );
  expect(guide).toContain(
    'For quick-win and low-risk improvement wording, such as `projscan start --intent "find a quick win"`',
  );
});
