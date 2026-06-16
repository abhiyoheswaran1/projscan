import { describe, it, expect } from 'vitest';
import { reportUpgrade } from '../../src/reporters/consoleUpgradeReporter.js';
import { reportUpgrade as reportUpgradeFromConsoleReporter } from '../../src/reporters/consoleReporter.js';
import type { UpgradePreview } from '../../src/types.js';
import { captureStdout, makeUpgradePreview, stripAnsi } from './fixtures.js';

async function capturePlain(fn: () => void): Promise<string> {
  return stripAnsi(await captureStdout(fn));
}

function preview(overrides: Partial<UpgradePreview> = {}): UpgradePreview {
  return { ...makeUpgradePreview(), ...overrides };
}

describe('consoleUpgradeReporter', () => {
  it('renders unavailable upgrade previews with the provided reason', async () => {
    const out = await capturePlain(() =>
      reportUpgrade(
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

    expect(out).toContain('Invalid package name');
    expect(out).not.toContain('Upgrade Preview');
  });

  it('renders drift metadata, breaking markers, importer rows, and no-changelog output', async () => {
    const out = await capturePlain(() => reportUpgrade(makeUpgradePreview()));

    expect(out).toContain('Upgrade Preview - react');
    expect(out).toContain('Declared:');
    expect(out).toContain('^17.0.0');
    expect(out).toContain('Installed:');
    expect(out).toContain('17.0.2');
    expect(out).toContain('Drift:');
    expect(out).toContain('MAJOR');
    expect(out).toContain('Breaking-change markers detected');
    expect(out).toContain('BREAKING CHANGE: removed x');
    expect(out).toContain('Importers (1):');
    expect(out).toContain('src/App.tsx');
    expect(out).toContain('No local CHANGELOG found');
  });

  it('renders clean breaking-marker and no-importer messages', async () => {
    const out = await capturePlain(() =>
      reportUpgrade(
        preview({
          breakingMarkers: [],
          importers: [],
        }),
      ),
    );

    expect(out).toContain('No obvious breaking-change markers detected.');
    expect(out).toContain('No direct importers found in source.');
  });

  it('truncates importer rows after 15 entries', async () => {
    const importers = Array.from({ length: 17 }, (_, index) => `src/file-${index + 1}.ts`);
    const out = await capturePlain(() => reportUpgrade(preview({ importers })));

    expect(out).toContain('Importers (17):');
    expect(out).toContain('src/file-1.ts');
    expect(out).toContain('src/file-15.ts');
    expect(out).not.toContain('src/file-16.ts');
    expect(out).toContain('… and 2 more');
  });

  it('truncates changelog excerpts after 40 lines', async () => {
    const changelogExcerpt = Array.from({ length: 42 }, (_, index) => `line ${index + 1}`).join(
      '\n',
    );
    const out = await capturePlain(() => reportUpgrade(preview({ changelogExcerpt })));

    expect(out).toContain('CHANGELOG excerpt:');
    expect(out).toContain('line 1');
    expect(out).toContain('line 40');
    expect(out).not.toContain('line 41');
  });

  it('preserves the consoleReporter re-export for existing callers', async () => {
    const out = await capturePlain(() => reportUpgradeFromConsoleReporter(makeUpgradePreview()));

    expect(out).toContain('Upgrade Preview - react');
    expect(out).toContain('MAJOR');
  });
});
