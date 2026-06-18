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

test('docs show multi-scope shareable evidence routing', () => {
  const readme = fs.readFileSync('README.md', 'utf8');
  const guide = fs.readFileSync('docs/GUIDE.md', 'utf8');
  const adoption = fs.readFileSync('docs/examples/adoption-workflows.md', 'utf8');

  const multiScopeIntent =
    'projscan start --intent "share redacted evidence for src/api and packages/backend with a partner"';
  const multiScopeAnalyze =
    'projscan analyze --report-scope "src/api,packages/backend" --redact-paths --format json';

  expect(readme).toContain(multiScopeAnalyze);
  expect(guide).toContain(multiScopeIntent);
  expect(guide).toContain(multiScopeAnalyze);
  expect(adoption).toContain(multiScopeIntent);
  expect(adoption).toContain(multiScopeAnalyze);
});

test('docs lead with demonstrated daily workflows instead of inflated breadth', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { description: string };
  const readme = fs.readFileSync('README.md', 'utf8');
  const guide = fs.readFileSync('docs/GUIDE.md', 'utf8');
  const adoption = fs.readFileSync('docs/examples/adoption-workflows.md', 'utf8');
  const roadmap = fs.readFileSync('docs/ROADMAP.md', 'utf8');

  expect(pkg.description.length).toBeLessThanOrEqual(360);
  expect(pkg.description).toContain('Local code intelligence for agent-assisted engineering');
  expect(pkg.description).toContain('repo orientation before edits');
  expect(pkg.description).toContain('proof before handoff or commit');
  expect(pkg.description).toContain('release-candidate review');
  expect(pkg.description).not.toContain('projscan_');
  expect(pkg.description).not.toContain('stable v3 semantic graph');
  expect(pkg.description).not.toContain('mechanical apply layer');
  expect(pkg.description).not.toContain('CLI on the side');

  expect(readme).toContain('## Daily workflows engineers can trust');
  expect(readme).toContain('Use these three workflows before scanning the full command catalog.');
  expect(readme).toContain('Before editing a feature');
  expect(readme).toContain('Before handoff or commit');
  expect(readme).toContain('Before release-candidate review');
  expect(readme).toContain('Success criteria:');
  expect(readme).not.toContain('five-command path above');

  expect(guide).toContain(
    'This guide starts with demonstrated workflows before the command reference.',
  );
  expect(guide).not.toContain('A deep dive into everything ProjScan can do.');

  expect(adoption).toContain('## Daily workflows engineers can trust');
  expect(adoption).toContain('Success criteria:');

  expect(roadmap).toContain(
    'projscan is useful when engineers can repeat three daily workflows with local proof: before editing, before handoff or commit, and before release-candidate review.',
  );
  expect(roadmap).toContain(
    'The next work is validation from real PRs and multi-agent sessions, not broader positioning.',
  );
  expect(roadmap).not.toContain('shared code-intelligence substrate');
  expect(roadmap).not.toContain('The protocol war is over');
  expect(roadmap).not.toContain('dominant 2026 pattern');
  expect(roadmap).not.toContain('What we beat them on');
  expect(roadmap).not.toContain('Become the operator, not the advisor');
});

test('start guide matches focused console handoff behavior', () => {
  const guide = fs.readFileSync('docs/GUIDE.md', 'utf8');

  expect(guide).toContain(
    'The normal console keeps linear missions focused on Daily Workflows, Mission Control, Resume Checklist, Ready Proof, first-ten commands, Adoption Follow-Up, and a Watch List when healthy p2-only evidence is visible.',
  );
  expect(guide).toContain(
    'Inline `Handoff Prompt` and `Review Gate` sections appear when the mission has unresolved inputs or the caller explicitly requests handoff output.',
  );
  expect(guide).toContain(
    'Use `--handoff-prompt`, `--review-gate`, `--review-replies`, `--handoff-json`, the Markdown runbook, or saved mission bundles when detailed handoff/review policy text is needed.',
  );
  expect(guide).not.toContain('The default console review gate');
  expect(guide).not.toContain(
    'the normal console prints that same value as `Handoff Prompt` without requiring JSON or `--include-handoff`',
  );
});
