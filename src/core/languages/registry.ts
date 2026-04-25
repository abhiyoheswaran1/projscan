import path from 'node:path';
import { javascriptAdapter } from './javascriptAdapter.js';
import { pythonAdapter } from './pythonAdapter.js';
import { goAdapter } from './goAdapter.js';
import { javaAdapter } from './javaAdapter.js';
import { rubyAdapter } from './rubyAdapter.js';
import type { LanguageAdapter } from './LanguageAdapter.js';

const adapters: LanguageAdapter[] = [javascriptAdapter, pythonAdapter, goAdapter, javaAdapter, rubyAdapter];
const byExtension = new Map<string, LanguageAdapter>();

function rebuildIndex(): void {
  byExtension.clear();
  for (const adapter of adapters) {
    for (const ext of adapter.extensions) {
      byExtension.set(ext, adapter);
    }
  }
}
rebuildIndex();

export function registerAdapter(adapter: LanguageAdapter): void {
  if (!adapters.includes(adapter)) {
    adapters.push(adapter);
    rebuildIndex();
  }
}

export function getAdapterFor(filePath: string): LanguageAdapter | undefined {
  return byExtension.get(path.extname(filePath).toLowerCase());
}

export function isAdapterParseable(filePath: string): boolean {
  return byExtension.has(path.extname(filePath).toLowerCase());
}

export function listAdapters(): readonly LanguageAdapter[] {
  return adapters;
}
