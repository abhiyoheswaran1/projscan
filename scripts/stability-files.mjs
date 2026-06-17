import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

export function resolveStabilityPaths(options = {}, defaultRoot) {
  const root = path.resolve(options.root ?? defaultRoot);
  return {
    root,
    manifestPath: options.manifestPath ?? path.join(root, 'dist', 'tool-manifest.json'),
    baselinePath: options.baselinePath ?? path.join(root, 'stability-baseline.json'),
  };
}

export function relativeBaselinePath(root, baselinePath) {
  return path.relative(root, baselinePath);
}

export async function readManifest(manifestPath) {
  try {
    await stat(manifestPath);
  } catch {
    throw new Error(`tool-manifest.json missing at ${manifestPath}. Run \`npm run build\` first.`);
  }
  try {
    return JSON.parse(await readFile(manifestPath, 'utf-8'));
  } catch (err) {
    throw new Error(`Could not parse ${manifestPath}: ${err.message}`);
  }
}

export async function readBaseline(baselinePath, root) {
  try {
    return JSON.parse(await readFile(baselinePath, 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        `No baseline file at ${relativeBaselinePath(root, baselinePath)}. Run\n` +
          `  node scripts/check-stability.mjs --update\n` +
          `to bootstrap one (only on a deliberate major bump).`,
      );
    }
    throw new Error(`Could not parse baseline: ${err.message}`);
  }
}

export async function writeBaseline(baselinePath, liveSurface) {
  await writeFile(baselinePath, JSON.stringify(liveSurface, null, 2) + '\n', 'utf-8');
}
