import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../types.js';

export interface RubyProjectInfo {
  /** Absolute paths to source roots - directories under which require_relative paths resolve. */
  sourceRoots: string[];
  /** What kind of Ruby project this looks like. Informational only. */
  projectKind: 'gem' | 'rails' | 'plain' | 'unknown';
}

/**
 * Detect a Ruby project layout.
 *
 * - **Gem**: presence of `*.gemspec` or `Gemfile`. Source root is `lib/`.
 * - **Rails**: presence of `config/application.rb`. Source roots include
 *   `app/`, `lib/`, `config/`.
 * - **Plain**: any directory with `.rb` files but no manifest. Source root is
 *   the repo root.
 *
 * Returns `null` only when no `.rb` files exist and no manifest is present  - 
 * i.e. this is not a Ruby project.
 */
export async function detectRubyProject(
  rootPath: string,
  files: FileEntry[],
): Promise<RubyProjectInfo | null> {
  const rbFiles = files.filter((f) => f.relativePath.endsWith('.rb'));
  const hasGemfile = await fileExists(path.join(rootPath, 'Gemfile'));
  const hasGemspec = files.some((f) => f.relativePath.endsWith('.gemspec'));
  const hasRailsConfig = await fileExists(path.join(rootPath, 'config/application.rb'));

  if (!hasGemfile && !hasGemspec && !hasRailsConfig && rbFiles.length === 0) return null;

  let projectKind: RubyProjectInfo['projectKind'];
  const roots = new Set<string>();

  if (hasRailsConfig) {
    projectKind = 'rails';
    for (const r of ['app', 'lib', 'config']) {
      if (await fileExists(path.join(rootPath, r))) roots.add(r);
    }
  } else if (hasGemfile || hasGemspec) {
    projectKind = 'gem';
    if (await fileExists(path.join(rootPath, 'lib'))) roots.add('lib');
  } else {
    projectKind = 'plain';
  }

  if (roots.size === 0) roots.add('.');

  return {
    sourceRoots: [...roots].map((r) => path.join(rootPath, r)),
    projectKind,
  };
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
