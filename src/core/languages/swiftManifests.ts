import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../types.js';

export interface SwiftProjectInfo {
  /**
   * Detected Swift source roots. For SwiftPM projects this is typically
   * `Sources/<Module>` per declared target; we fall back to the conventional
   * `Sources/` and the repo root when no Package.swift exists.
   */
  packageRoots: string[];
  /** Did we see a Package.swift / .xcodeproj manifest? Used for diagnostics only. */
  hasManifest: boolean;
}

const COMMON_SWIFT_ROOTS = ['Sources', 'Tests', '.'];

/**
 * Detect Swift source roots. We don't parse Package.swift; instead we
 * survey the .swift file paths and pick whichever conventional roots
 * actually contain Swift sources.
 */
export async function detectSwiftProject(
  rootPath: string,
  files: FileEntry[],
): Promise<SwiftProjectInfo | null> {
  const swiftFiles = files.filter((f) => f.relativePath.endsWith('.swift'));
  if (swiftFiles.length === 0) return null;

  const hasManifest = await hasSwiftManifest(rootPath);
  const packageRoots: string[] = [];
  for (const candidate of COMMON_SWIFT_ROOTS) {
    if (candidate === '.') {
      if (swiftFiles.some((f) => !f.relativePath.includes('/'))) packageRoots.push('.');
    } else if (swiftFiles.some((f) => f.relativePath.startsWith(candidate + '/'))) {
      packageRoots.push(candidate);
    }
  }
  if (packageRoots.length === 0) packageRoots.push('.');
  return { packageRoots, hasManifest };
}

async function hasSwiftManifest(rootPath: string): Promise<boolean> {
  const candidates = ['Package.swift', 'Package.resolved'];
  for (const c of candidates) {
    try {
      await fs.access(path.join(rootPath, c));
      return true;
    } catch {
      // try next
    }
  }
  try {
    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    if (entries.some((e) => e.isDirectory() && e.name.endsWith('.xcodeproj'))) return true;
  } catch {
    // ignore
  }
  return false;
}
