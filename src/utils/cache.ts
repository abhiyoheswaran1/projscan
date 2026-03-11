import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const CACHE_DIR = path.join(os.tmpdir(), 'devlens-cache');
const DEFAULT_TTL_MS = 60_000; // 1 minute

async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function getCacheFilePath(key: string): string {
  const hash = crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
  return path.join(CACHE_DIR, `${hash}.json`);
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const filePath = getCacheFilePath(key);
    const raw = await fs.readFile(filePath, 'utf-8');
    const entry: CacheEntry<T> = JSON.parse(raw);

    if (Date.now() > entry.expiresAt) {
      await fs.unlink(filePath).catch(() => {});
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): Promise<void> {
  try {
    await ensureCacheDir();
    const filePath = getCacheFilePath(key);
    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + ttlMs,
    };
    await fs.writeFile(filePath, JSON.stringify(entry), 'utf-8');
  } catch {
    // Cache write failure is non-critical
  }
}

export async function cacheInvalidate(key: string): Promise<void> {
  try {
    await fs.unlink(getCacheFilePath(key));
  } catch {
    // Ignore
  }
}
