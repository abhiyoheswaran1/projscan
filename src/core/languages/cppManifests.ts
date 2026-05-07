import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../types.js';

export interface CppProjectInfo {
  /**
   * Detected C++ source / include roots. We use these to resolve quoted
   * `#include "foo.h"` directives — quoted includes start their search
   * from the same directory as the including file, then fall back to
   * project-wide include directories.
   */
  includeRoots: string[];
  hasCMake: boolean;
  hasMakefile: boolean;
}

const COMMON_CPP_ROOTS = ['include', 'src', 'lib', '.'];

/**
 * Detect C++ source roots. We don't parse CMakeLists / Make files; we
 * survey .cpp/.cc/.cxx/.h/.hpp file paths and pick whichever conventional
 * roots actually contain sources.
 */
export async function detectCppProject(
  rootPath: string,
  files: FileEntry[],
): Promise<CppProjectInfo | null> {
  const cppFiles = files.filter((f) => isCppExtension(f.relativePath));
  if (cppFiles.length === 0) return null;

  const hasCMake = await fileExists(path.join(rootPath, 'CMakeLists.txt'));
  const hasMakefile = await fileExists(path.join(rootPath, 'Makefile'));
  const includeRoots: string[] = [];
  for (const candidate of COMMON_CPP_ROOTS) {
    if (candidate === '.') {
      if (cppFiles.some((f) => !f.relativePath.includes('/'))) includeRoots.push('.');
    } else if (cppFiles.some((f) => f.relativePath.startsWith(candidate + '/'))) {
      includeRoots.push(candidate);
    }
  }
  if (includeRoots.length === 0) includeRoots.push('.');
  return { includeRoots, hasCMake, hasMakefile };
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function isCppExtension(p: string): boolean {
  return /\.(cpp|cc|cxx|c\+\+|c|h|hpp|hxx|h\+\+)$/.test(p);
}
