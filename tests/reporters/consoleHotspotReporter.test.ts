import { describe, it, expect } from 'vitest';
import { reportHotspots } from '../../src/reporters/consoleHotspotReporter.js';
import { reportHotspots as reportHotspotsFromConsoleReporter } from '../../src/reporters/consoleReporter.js';
import type { HotspotReport } from '../../src/types.js';
import { captureStdout, makeHotspotReport, stripAnsi } from './fixtures.js';

async function capturePlain(fn: () => void): Promise<string> {
  return stripAnsi(await captureStdout(fn));
}

function withHotspots(report: HotspotReport, hotspots: HotspotReport['hotspots']): HotspotReport {
  return { ...report, hotspots, totalFilesRanked: hotspots.length };
}

describe('consoleHotspotReporter', () => {
  it('renders unavailable hotspot reports with the provided reason', async () => {
    const out = await capturePlain(() =>
      reportHotspots({
        available: false,
        reason: 'no git history',
        window: { since: null, commitsScanned: 0 },
        hotspots: [],
        totalFilesRanked: 0,
      }),
    );

    expect(out).toContain('Project Hotspots');
    expect(out).toContain('no git history');
  });

  it('renders the empty hotspot state with scanned commit context', async () => {
    const out = await capturePlain(() =>
      reportHotspots({
        available: true,
        window: { since: '2026-01-01', commitsScanned: 1 },
        hotspots: [],
        totalFilesRanked: 0,
      }),
    );

    expect(out).toContain('No hotspots detected');
    expect(out).toContain('Scanned 1 commit since 2026-01-01.');
    expect(out).not.toContain('Tip: run');
  });

  it('renders ranked hotspots, fallback reasons, accepted tags, and the drill-down tip', async () => {
    const base = makeHotspotReport();
    const [first] = base.hotspots;
    const report = withHotspots(base, [
      {
        ...first,
        relativePath: 'src/accepted.ts',
        riskScore: 100,
        reasons: ['high churn'],
        accepted: true,
      },
      { ...first, relativePath: 'src/fallback.ts', riskScore: 50, reasons: [] },
    ]);

    const out = await capturePlain(() => reportHotspots(report));

    expect(out).toContain('100 commits since 2026-01-01');
    expect(out).toContain('2 files ranked');
    expect(out).toContain('1.');
    expect(out).toContain('100.0');
    expect(out).toContain('src/accepted.ts');
    expect(out).toContain('[accepted]');
    expect(out).toContain('high churn');
    expect(out).toContain('2.');
    expect(out).toContain('50.0');
    expect(out).toContain('src/fallback.ts');
    expect(out).toContain('ranked by risk');
    expect(out).toContain('[accepted] = top-5');
    expect(out).toContain('projscan file <file>');
  });

  it('preserves the consoleReporter re-export for existing callers', async () => {
    const out = await capturePlain(() => reportHotspotsFromConsoleReporter(makeHotspotReport()));

    expect(out).toContain('Project Hotspots');
    expect(out).toContain('src/big.ts');
  });
});
