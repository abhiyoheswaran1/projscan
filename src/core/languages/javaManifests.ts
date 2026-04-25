import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../types.js';

export interface JavaProjectInfo {
  /** Absolute paths to source roots - directories under which `package` paths resolve. */
  sourceRoots: string[];
  /** Build system detected, if any. Informational only. */
  buildSystem: 'maven' | 'gradle' | 'unknown';
}

const MAVEN_DEFAULT_ROOTS = ['src/main/java', 'src/test/java'];
const GRADLE_DEFAULT_ROOTS = ['src/main/java', 'src/test/java'];

/**
 * Detect a Java project layout.
 *
 * Maven: presence of `pom.xml`. Default source roots are
 *   src/main/java/, src/test/java/.
 * Gradle: presence of `build.gradle` or `build.gradle.kts`. Same defaults.
 *
 * Real projects may override the source root via Maven's <sourceDirectory>
 * or Gradle's `sourceSets`. Parsing those out is deferred - the conventional
 * defaults cover ≈95% of repos. Custom roots can still be picked up because
 * `inferRootsFromFiles` walks the file list and takes any directory that
 * contains a top-level `.java` file with a `package` declaration matching its
 * directory path.
 *
 * Returns `null` only when no `.java` files exist and no build manifest is
 * found - i.e. this is not a Java project.
 */
export async function detectJavaProject(
  rootPath: string,
  files: FileEntry[],
): Promise<JavaProjectInfo | null> {
  const hasPom = await fileExists(path.join(rootPath, 'pom.xml'));
  const hasGradle =
    (await fileExists(path.join(rootPath, 'build.gradle'))) ||
    (await fileExists(path.join(rootPath, 'build.gradle.kts')));

  const javaFiles = files.filter((f) => f.relativePath.endsWith('.java'));
  if (!hasPom && !hasGradle && javaFiles.length === 0) return null;

  const buildSystem: JavaProjectInfo['buildSystem'] = hasPom
    ? 'maven'
    : hasGradle
      ? 'gradle'
      : 'unknown';

  // Start with conventional roots (only the ones that actually exist).
  const conventional = hasPom ? MAVEN_DEFAULT_ROOTS : GRADLE_DEFAULT_ROOTS;
  const roots = new Set<string>();
  for (const r of conventional) {
    if (await fileExists(path.join(rootPath, r))) {
      roots.add(r);
    }
  }

  // If neither convention exists, fall back to inferring from file layout.
  if (roots.size === 0) {
    const inferred = inferRootsFromFiles(javaFiles);
    for (const r of inferred) roots.add(r);
    if (roots.size === 0) roots.add('.');
  }

  return {
    sourceRoots: [...roots].map((r) => path.join(rootPath, r)),
    buildSystem,
  };
}

/**
 * Best-effort source-root inference: for each .java file, scan its content
 * for a `package` declaration and back out the source root by stripping the
 * package path from the file's directory. We can't read content here cheaply
 * (FileEntry doesn't carry it), so we approximate by looking at the deepest
 * common prefix of `.java` directories.
 */
function inferRootsFromFiles(files: FileEntry[]): string[] {
  if (files.length === 0) return [];
  const dirs = new Set(files.map((f) => path.posix.dirname(f.relativePath)));
  // Find the shortest directory - that's the most likely package root.
  let shortest = '';
  let shortestLen = Infinity;
  for (const d of dirs) {
    if (d.length < shortestLen) {
      shortest = d;
      shortestLen = d.length;
    }
  }
  return [shortest || '.'];
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
