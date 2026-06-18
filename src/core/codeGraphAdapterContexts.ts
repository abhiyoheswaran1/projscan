import type { FileEntry } from '../types.js';
import type { LanguageAdapter, LanguageResolveContext } from './languages/LanguageAdapter.js';
import { listAdapters } from './languages/registry.js';

/**
 * Per-adapter setup (e.g. Python package-root detection from
 * pyproject.toml, Rust workspace detection from Cargo.toml). Run once
 * per graph build; cheap relative to parsing.
 */
export async function prepareAdapterContexts(
  rootPath: string,
  files: FileEntry[],
): Promise<Map<LanguageAdapter, LanguageResolveContext>> {
  const contextByAdapter = new Map<LanguageAdapter, LanguageResolveContext>();
  for (const adapter of listAdapters()) {
    contextByAdapter.set(adapter, await adapter.preparePackageRoots(rootPath, files));
  }
  return contextByAdapter;
}
