import fs from 'node:fs/promises';
import path from 'node:path';

import { analyzeHotspots } from './hotspotAnalyzer.js';
import { collectIssues } from './issueEngine.js';
import { scanRepository } from './repositoryScanner.js';
import { computeDiff, loadBaseline } from '../utils/baseline.js';
import { applyConfigToIssues, loadConfig } from '../utils/config.js';
import type { BaselineTrend } from '../types.js';

export async function safeBaselineTrend(rootPath: string): Promise<BaselineTrend | undefined> {
  const baselinePath = path.join(rootPath, '.projscan-baseline.json');
  try {
    await fs.access(baselinePath);
  } catch {
    return undefined;
  }
  try {
    const configResult = await loadConfig(rootPath).catch(() => ({ config: { ignore: [] } }));
    const scan = await scanRepository(rootPath, {
      ignore: configResult.config.ignore,
      countIgnoredFiles: false,
    });
    const issues = applyConfigToIssues(
      await collectIssues(rootPath, scan.files),
      configResult.config,
    );
    const hotspots = await analyzeHotspots(rootPath, scan.files, issues, { limit: 20 });
    const baseline = await loadBaseline(baselinePath, rootPath);
    return computeDiff(baseline, issues, hotspots).trend;
  } catch {
    return undefined;
  }
}
