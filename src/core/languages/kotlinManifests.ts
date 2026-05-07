import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../types.js';

export interface KotlinProjectInfo {
  /**
   * Detected package roots — directories under which Kotlin source files
   * live. For Gradle / Maven projects this is typically `src/main/kotlin`
   * and / or `src/test/kotlin`. Imports like `import com.foo.Bar` resolve
   * against each root.
   */
  packageRoots: string[];
  /** Did we see a Gradle build file? Used for diagnostics only. */
  hasGradle: boolean;
}

const COMMON_KOTLIN_ROOTS = [
  'src/main/kotlin',
  'src/test/kotlin',
  'src/main/java', // Kotlin / Java mixed projects
  'src/test/java',
  'src',
];

/**
 * Detect Kotlin source roots. We don't parse Gradle / Maven manifests; we
 * just check for the conventional `src/main/kotlin` layout and fall back
 * to surveying the .kt file paths to find any prefix that looks like a
 * package root (a directory whose first .kt file's `package` declaration
 * matches its sub-path).
 */
export async function detectKotlinProject(
  rootPath: string,
  files: FileEntry[],
): Promise<KotlinProjectInfo | null> {
  const ktFiles = files.filter(
    (f) => f.relativePath.endsWith('.kt') || f.relativePath.endsWith('.kts'),
  );
  if (ktFiles.length === 0) return null;

  const hasGradle = await hasGradleManifest(rootPath);
  const packageRoots: string[] = [];
  for (const candidate of COMMON_KOTLIN_ROOTS) {
    if (ktFiles.some((f) => f.relativePath.startsWith(candidate + '/'))) {
      packageRoots.push(candidate);
    }
  }
  // Fallback: bare repo with .kt files at the root.
  if (packageRoots.length === 0) packageRoots.push('.');
  return { packageRoots, hasGradle };
}

async function hasGradleManifest(rootPath: string): Promise<boolean> {
  const candidates = ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts', 'pom.xml'];
  for (const c of candidates) {
    try {
      await fs.access(path.join(rootPath, c));
      return true;
    } catch {
      // try next
    }
  }
  return false;
}
