import { describe, expect, it } from 'vitest';
import { reportUpgradeMarkdown } from '../../src/reporters/markdownUpgradeReporter.js';
import { reportUpgradeMarkdown as reportUpgradeMarkdownFromMarkdownReporter } from '../../src/reporters/markdownReporter.js';
import type { UpgradePreview } from '../../src/types.js';
import { captureStdout, makeUpgradePreview } from './fixtures.js';

describe('markdownUpgradeReporter', () => {
  it('is re-exported from markdownReporter to preserve the public reporter API', () => {
    expect(reportUpgradeMarkdownFromMarkdownReporter).toBe(reportUpgradeMarkdown);
  });

  it('renders unavailable upgrade previews with the provided reason', async () => {
    const out = await captureStdout(() =>
      reportUpgradeMarkdown(
        preview({
          available: false,
          reason: 'Invalid package name',
          declared: null,
          installed: null,
          latest: null,
          drift: 'unknown',
          breakingMarkers: [],
          importers: [],
        }),
      ),
    );

    expect(out).toContain('# Upgrade Preview - `react`');
    expect(out).toContain('_Invalid package name_');
  });

  it('renders version metadata, breaking markers, importers, and changelog excerpts', async () => {
    const out = await captureStdout(() =>
      reportUpgradeMarkdown(
        preview({
          changelogExcerpt: '## 18.0.0\n\nBREAKING CHANGE: new renderer behavior',
        }),
      ),
    );

    expect(out).toBe(
      [
        '# Upgrade Preview - `react`',
        '',
        '- Declared: `^17.0.0`',
        '- Installed: `17.0.2`',
        '- Drift: **major**',
        '',
        '## ⚠ Breaking-change markers',
        '- BREAKING CHANGE: removed x',
        '',
        '## Importers (1)',
        '- `src/App.tsx`',
        '',
        '## CHANGELOG excerpt',
        '',
        '```',
        '## 18.0.0\n\nBREAKING CHANGE: new renderer behavior',
        '```',
      ].join('\n'),
    );
  });

  it('omits optional sections when no markers, importers, or changelog exist', async () => {
    const out = await captureStdout(() =>
      reportUpgradeMarkdown(
        preview({
          breakingMarkers: [],
          importers: [],
          changelogExcerpt: undefined,
        }),
      ),
    );

    expect(out).toContain('# Upgrade Preview - `react`');
    expect(out).not.toContain('## ⚠ Breaking-change markers');
    expect(out).not.toContain('## Importers');
    expect(out).not.toContain('## CHANGELOG excerpt');
  });

  it('renders installed source when Python lockfile evidence is present', async () => {
    const out = await captureStdout(() =>
      reportUpgradeMarkdown(
        preview({
          ecosystem: 'python',
          installed: '2.31.0',
          latest: '2.31.0',
          installedSource: 'requirements.txt',
          installedLine: 1,
        }),
      ),
    );

    expect(out).toContain('- Installed: `2.31.0`');
    expect(out).toContain('- Installed source: `requirements.txt:1`');
  });
});

function preview(overrides: Partial<UpgradePreview> = {}): UpgradePreview {
  return { ...makeUpgradePreview(), ...overrides };
}
