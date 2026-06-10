import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoPath = path.join(repoRoot, 'docs', 'demos', 'projscan-4-1-demo.html');

if (!existsSync(demoPath)) {
  console.error(`Missing capture source: ${path.relative(repoRoot, demoPath)}`);
  process.exit(1);
}

const captures = [
  {
    name: 'Mission Control hero',
    url: pathToFileURL(demoPath).href,
    output: path.join(repoRoot, 'docs', 'projscan-mission-control.png'),
    viewport: '1440,1120',
  },
  {
    name: 'Intent and proof workflow',
    url: `${pathToFileURL(demoPath).href}#proof`,
    output: path.join(repoRoot, 'docs', 'projscan-proof-router.png'),
    viewport: '1440,760',
  },
];

for (const capture of captures) {
  console.log(`Capturing ${capture.name} -> ${path.relative(repoRoot, capture.output)}`);
  const result = spawnSync(
    'npx',
    [
      '--yes',
      'playwright',
      'screenshot',
      '--browser',
      'chromium',
      '--viewport-size',
      capture.viewport,
      '--wait-for-selector',
      '[data-ready="true"]',
      capture.url,
      capture.output,
    ],
    {
      cwd: repoRoot,
      stdio: 'inherit',
    },
  );

  if (result.status !== 0) {
    console.error(
      'Playwright screenshot capture failed. If Chromium is missing locally, run: npx --yes playwright install chromium',
    );
    process.exit(result.status ?? 1);
  }
}

console.log('README screenshots captured.');
