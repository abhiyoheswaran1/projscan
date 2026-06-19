import { statSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

import type { GraphFileLike } from './LanguageAdapter.js';

export const JS_RESOLUTION_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];

export interface JavaScriptPathAlias {
  pattern: string;
  targets: string[];
  targetBaseAbs: string;
}

export interface JavaScriptProjectConfig {
  configPath: string;
  configDir: string;
  configDirAbs: string;
  aliases: JavaScriptPathAlias[];
  baseUrlAbs?: string;
}

interface ConfigLayer {
  configPath: string;
  configDirAbs: string;
  compilerOptions?: {
    baseUrl?: unknown;
    paths?: unknown;
  };
}

export async function loadJavaScriptProjectConfigs(
  rootPath: string,
  files: Array<{ relativePath: string }>,
): Promise<JavaScriptProjectConfig[]> {
  const configPaths = await findConfigPathsForFiles(rootPath, files);
  const configs: JavaScriptProjectConfig[] = [];
  for (const configPath of configPaths) {
    const config = await loadJavaScriptProjectConfig(rootPath, configPath);
    if (config) configs.push(config);
  }
  return configs.sort((a, b) => b.configDir.length - a.configDir.length);
}

export function resolveJavaScriptImportFromConfigs(
  rootPath: string,
  importingFile: string,
  source: string,
  graphFiles: Map<string, GraphFileLike>,
  configs: JavaScriptProjectConfig[],
): string | null {
  if (source.startsWith('.') || source.startsWith('/')) {
    const importingDir = path.posix.dirname(importingFile);
    return resolveLocalBase(path.posix.normalize(path.posix.join(importingDir, source)), graphFiles);
  }

  const config = findConfigForFile(importingFile, configs);
  if (!config) return null;

  for (const candidateAbs of candidateAbsoluteImports(config, source)) {
    const relativeCandidate = absoluteToRepoPath(rootPath, candidateAbs);
    if (!relativeCandidate) continue;
    const resolved = resolveLocalBase(relativeCandidate, graphFiles);
    if (resolved) return resolved;
  }
  return null;
}

export async function resolveJavaScriptImportAbsolute(
  rootPath: string,
  importingFile: string,
  source: string,
  configs: JavaScriptProjectConfig[],
): Promise<string | null> {
  const sourceBase = source.startsWith('.') || source.startsWith('/')
    ? path.resolve(rootPath, path.dirname(importingFile), source)
    : firstConfigCandidate(rootPath, importingFile, source, configs);
  if (!sourceBase) return null;
  return await resolveAbsoluteBase(sourceBase);
}

export function resolveLocalBase(
  base: string,
  graphFiles: Map<string, GraphFileLike>,
): string | null {
  if (graphFiles.has(base)) return base;

  for (const ext of JS_RESOLUTION_EXTS) {
    if (graphFiles.has(base + ext)) return base + ext;
  }
  for (const ext of JS_RESOLUTION_EXTS) {
    const barrel = `${base}/index${ext}`;
    if (graphFiles.has(barrel)) return barrel;
  }

  if (base.endsWith('.js')) {
    const trimmed = base.slice(0, -3);
    if (graphFiles.has(`${trimmed}.ts`)) return `${trimmed}.ts`;
    if (graphFiles.has(`${trimmed}.tsx`)) return `${trimmed}.tsx`;
  }
  return null;
}

function firstConfigCandidate(
  rootPath: string,
  importingFile: string,
  source: string,
  configs: JavaScriptProjectConfig[],
): string | null {
  const config = findConfigForFile(importingFile, configs);
  return config ? (candidateAbsoluteImports(config, source)[0] ?? null) : null;
}

function candidateAbsoluteImports(config: JavaScriptProjectConfig, source: string): string[] {
  const candidates: string[] = [];
  for (const alias of config.aliases) {
    const wildcard = matchAliasPattern(alias.pattern, source);
    if (wildcard === null) continue;
    for (const target of alias.targets) {
      const expanded = target.includes('*') ? target.split('*').join(wildcard) : target;
      candidates.push(path.resolve(alias.targetBaseAbs, expanded));
    }
  }
  if (candidates.length === 0 && config.baseUrlAbs) {
    candidates.push(path.resolve(config.baseUrlAbs, source));
  }
  return candidates;
}

function findConfigForFile(
  relativePath: string,
  configs: JavaScriptProjectConfig[],
): JavaScriptProjectConfig | undefined {
  return configs.find((config) => {
    if (!config.configDir) return true;
    return relativePath === config.configDir || relativePath.startsWith(`${config.configDir}/`);
  });
}

async function resolveAbsoluteBase(base: string): Promise<string | null> {
  if (await fileExists(base)) return path.resolve(base);
  for (const ext of JS_RESOLUTION_EXTS) {
    const candidate = base + ext;
    if (await fileExists(candidate)) return path.resolve(candidate);
  }
  for (const ext of JS_RESOLUTION_EXTS) {
    const candidate = path.join(base, `index${ext}`);
    if (await fileExists(candidate)) return path.resolve(candidate);
  }
  if (base.endsWith('.js')) {
    const trimmed = base.slice(0, -3);
    for (const ext of ['.ts', '.tsx']) {
      const candidate = `${trimmed}${ext}`;
      if (await fileExists(candidate)) return path.resolve(candidate);
    }
  }
  return null;
}

async function findConfigPathsForFiles(
  rootPath: string,
  files: Array<{ relativePath: string }>,
): Promise<string[]> {
  const found = new Set<string>();
  for (const file of files) {
    let dir = normalizeRepoPath(path.posix.dirname(file.relativePath));
    while (true) {
      for (const name of ['tsconfig.json', 'jsconfig.json']) {
        const candidate = path.join(rootPath, dir, name);
        if (await fileExists(candidate)) found.add(path.resolve(candidate));
      }
      if (!dir) break;
      dir = normalizeRepoPath(path.posix.dirname(dir));
    }
  }
  return [...found].sort();
}

async function loadJavaScriptProjectConfig(
  rootPath: string,
  configPath: string,
): Promise<JavaScriptProjectConfig | null> {
  const chain = await loadConfigChain(configPath, new Set());
  if (chain.length === 0) return null;

  let baseUrlAbs: string | undefined;
  let pathsLayer: ConfigLayer | undefined;
  for (const layer of chain) {
    const options = layer.compilerOptions;
    if (!options) continue;
    if (typeof options.baseUrl === 'string') baseUrlAbs = path.resolve(layer.configDirAbs, options.baseUrl);
    if (options.paths && typeof options.paths === 'object') pathsLayer = layer;
  }

  const configDirAbs = path.dirname(configPath);
  const aliases = pathsLayer ? aliasesFromLayer(pathsLayer, baseUrlAbs) : [];
  if (!baseUrlAbs && aliases.length === 0) return null;

  return {
    configPath: normalizeAbsoluteToRepoPath(rootPath, configPath),
    configDir: normalizeAbsoluteToRepoPath(rootPath, configDirAbs),
    configDirAbs,
    aliases,
    ...(baseUrlAbs ? { baseUrlAbs } : {}),
  };
}

function aliasesFromLayer(layer: ConfigLayer, baseUrlAbs: string | undefined): JavaScriptPathAlias[] {
  const paths = layer.compilerOptions?.paths;
  if (!paths || typeof paths !== 'object') return [];
  const targetBaseAbs = baseUrlAbs ?? layer.configDirAbs;
  const aliases: JavaScriptPathAlias[] = [];
  for (const [pattern, rawTargets] of Object.entries(paths as Record<string, unknown>)) {
    if (!Array.isArray(rawTargets)) continue;
    const targets = rawTargets.filter((target): target is string => typeof target === 'string');
    if (targets.length > 0) aliases.push({ pattern, targets, targetBaseAbs });
  }
  return aliases;
}

async function loadConfigChain(configPath: string, seen: Set<string>): Promise<ConfigLayer[]> {
  const resolvedPath = path.resolve(configPath);
  if (seen.has(resolvedPath)) return [];
  seen.add(resolvedPath);

  let parsed: {
    extends?: unknown;
    compilerOptions?: ConfigLayer['compilerOptions'];
  };
  try {
    const raw = await fs.readFile(resolvedPath, 'utf-8');
    parsed = JSON.parse(stripJsonCommentsAndTrailingCommas(raw)) as typeof parsed;
  } catch {
    return [];
  }

  const layers: ConfigLayer[] = [];
  if (typeof parsed.extends === 'string') {
    const parent = resolveExtendsPath(parsed.extends, path.dirname(resolvedPath));
    if (parent) layers.push(...(await loadConfigChain(parent, seen)));
  }
  layers.push({
    configPath: resolvedPath,
    configDirAbs: path.dirname(resolvedPath),
    compilerOptions: parsed.compilerOptions,
  });
  return layers;
}

function resolveExtendsPath(value: string, fromDir: string): string | null {
  const candidates: string[] = [];
  if (value.startsWith('.') || value.startsWith('/') || value.startsWith('..')) {
    const base = path.resolve(fromDir, value);
    candidates.push(base, ensureJsonExtension(base), path.join(base, 'tsconfig.json'));
  } else {
    try {
      const require = createRequire(path.join(fromDir, 'tsconfig.json'));
      candidates.push(require.resolve(value));
    } catch {
      return null;
    }
  }
  return candidates.find((candidate, index) => candidates.indexOf(candidate) === index && existsSyncish(candidate)) ?? null;
}

function matchAliasPattern(pattern: string, source: string): string | null {
  const star = pattern.indexOf('*');
  if (star === -1) return pattern === source ? '' : null;

  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  if (!source.startsWith(prefix) || !source.endsWith(suffix)) return null;
  return source.slice(prefix.length, source.length - suffix.length);
}

function absoluteToRepoPath(rootPath: string, absolutePath: string): string | null {
  const relative = normalizeRepoPath(path.relative(rootPath, absolutePath));
  if (!relative || relative.startsWith('..')) return null;
  return relative;
}

function normalizeAbsoluteToRepoPath(rootPath: string, absolutePath: string): string {
  return normalizeRepoPath(path.relative(rootPath, absolutePath));
}

function normalizeRepoPath(value: string): string {
  const normalized = path.posix.normalize(value.replace(/\\/g, '/'));
  return normalized === '.' ? '' : normalized.replace(/^\.\//, '');
}

function ensureJsonExtension(value: string): string {
  return path.extname(value) ? value : `${value}.json`;
}

async function fileExists(filePath: string): Promise<boolean> {
  return fs.stat(filePath).then(
    (stat) => stat.isFile(),
    () => false,
  );
}

function existsSyncish(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function stripJsonCommentsAndTrailingCommas(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/,\s*([}\]])/g, '$1');
}
