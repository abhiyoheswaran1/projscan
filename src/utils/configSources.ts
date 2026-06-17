import fs from 'node:fs/promises';
import path from 'node:path';

const CONFIG_CANDIDATES = ['.projscanrc.json', '.projscanrc'];
const PKG_KEY = 'projscan';

export interface ConfigSource {
  value: unknown;
  source: string;
}

export async function loadConfigSource(
  rootPath: string,
  explicitPath?: string,
): Promise<ConfigSource | null> {
  if (explicitPath) return await loadExplicitConfigSource(rootPath, explicitPath);

  const candidateSource = await loadCandidateConfigSource(rootPath);
  if (candidateSource) return candidateSource;

  return await loadPackageConfigSource(rootPath);
}

async function loadExplicitConfigSource(
  rootPath: string,
  explicitPath: string,
): Promise<ConfigSource> {
  const resolved = path.isAbsolute(explicitPath) ? explicitPath : path.join(rootPath, explicitPath);
  return { value: safeParse(await fs.readFile(resolved, 'utf-8'), resolved), source: resolved };
}

async function loadCandidateConfigSource(rootPath: string): Promise<ConfigSource | null> {
  for (const name of CONFIG_CANDIDATES) {
    const candidate = path.join(rootPath, name);
    let raw: string;
    try {
      raw = await fs.readFile(candidate, 'utf-8');
    } catch {
      continue;
    }
    return { value: safeParse(raw, candidate), source: candidate };
  }
  return null;
}

async function loadPackageConfigSource(rootPath: string): Promise<ConfigSource | null> {
  const pkgPath = path.join(rootPath, 'package.json');
  try {
    const raw = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    const embedded = pkg[PKG_KEY];
    if (embedded && typeof embedded === 'object') {
      return { value: embedded, source: `${pkgPath}#${PKG_KEY}` };
    }
  } catch {
    return null;
  }
  return null;
}

function safeParse(raw: string, filePath: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON in ${filePath}: ${msg}`, { cause: err });
  }
}
