import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { walkFiles, getDefaultIgnorePatterns } from '../utils/fileWalker.js';
import { loadConfig } from '../utils/config.js';
import type {
  ScanResult,
  FileEntry,
  DirectoryNode,
  ScanBoundary,
  ProjscanConfig,
} from '../types.js';

const execFileAsync = promisify(execFile);
const INCLUDE_IGNORED_ENV = 'PROJSCAN_INCLUDE_IGNORED';

export interface ScanOptions {
  ignore?: string[];
  includeIgnored?: boolean;
  countIgnoredFiles?: boolean;
  useConfig?: boolean;
}

export async function scanRepository(
  rootPath: string,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const start = performance.now();
  const config =
    options.useConfig === false
      ? {}
      : (await loadConfig(rootPath).catch(() => ({ config: {} as ProjscanConfig }))).config;
  const ignore = mergeIgnorePatterns(config.ignore, options.ignore);
  const includeIgnored =
    options.includeIgnored === true ||
    config.scan?.includeIgnored === true ||
    process.env[INCLUDE_IGNORED_ENV] === '1';
  const countIgnoredFiles = options.countIgnoredFiles !== false;

  let files: FileEntry[];
  let scanBoundary: ScanBoundary;

  if (includeIgnored) {
    files = await walkWithProjscanIgnores(rootPath, ignore);
    scanBoundary = {
      source: 'glob',
      gitignoreRespected: false,
      includeIgnored: true,
      ignoredFileCount: countIgnoredFiles ? await countGitIgnoredFiles(rootPath) : 0,
    };
  } else {
    const gitBoundary = await listGitVisibleFiles(rootPath, countIgnoredFiles);
    if (gitBoundary) {
      files = await fileEntriesFromGitVisibleFiles(rootPath, gitBoundary.files, ignore);
      scanBoundary = {
        source: 'git',
        gitignoreRespected: true,
        includeIgnored: false,
        ignoredFileCount: gitBoundary.ignoredFileCount,
      };
    } else {
      files = await walkWithProjscanIgnores(rootPath, ignore);
      scanBoundary = {
        source: 'glob',
        gitignoreRespected: false,
        includeIgnored: false,
        ignoredFileCount: 0,
      };
    }
  }

  const directoryTree = buildDirectoryTree(files, rootPath);
  // 1.9+ — exclude the empty-string "directory" key (some file
  // walkers emit '' for root-level entries instead of '.'). The root
  // is represented as '.' and counts as a directory; '' is the same
  // logical place and would otherwise double-count when both shapes
  // appear in the same scan.
  const directories = new Set(files.map((f) => f.directory).filter((d) => d !== ''));
  const scanDurationMs = performance.now() - start;

  return {
    rootPath,
    totalFiles: files.length,
    totalDirectories: directories.size,
    files,
    directoryTree,
    scanDurationMs,
    scanBoundary,
  };
}

function mergeIgnorePatterns(
  configIgnore?: string[],
  optionIgnore?: string[],
): string[] | undefined {
  const merged = [...(configIgnore ?? []), ...(optionIgnore ?? [])].filter(
    (entry) => entry.length > 0,
  );
  return merged.length > 0 ? [...new Set(merged)] : undefined;
}

async function walkWithProjscanIgnores(rootPath: string, ignore?: string[]): Promise<FileEntry[]> {
  const patterns = ignore?.length ? [...getDefaultIgnorePatterns(), ...ignore] : undefined;
  return walkFiles(rootPath, patterns ? { ignore: patterns } : undefined);
}

async function fileEntriesFromGitVisibleFiles(
  rootPath: string,
  files: string[],
  ignore?: string[],
): Promise<FileEntry[]> {
  const patterns = ignore?.length ? [...getDefaultIgnorePatterns(), ...ignore] : undefined;
  return walkFiles(rootPath, patterns ? { ignore: patterns, paths: files } : { paths: files });
}

async function listGitVisibleFiles(
  rootPath: string,
  countIgnoredFiles: boolean,
): Promise<{ files: string[]; ignoredFileCount: number } | null> {
  try {
    await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: rootPath });
    const [{ stdout }, ignoredFileCount] = await Promise.all([
      execFileAsync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
        cwd: rootPath,
        maxBuffer: 32 * 1024 * 1024,
      }),
      countIgnoredFiles ? countGitIgnoredFiles(rootPath) : Promise.resolve(0),
    ]);
    return { files: parseGitFileList(stdout), ignoredFileCount };
  } catch {
    return null;
  }
}

async function countGitIgnoredFiles(rootPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['ls-files', '--others', '--ignored', '--exclude-standard'],
      {
        cwd: rootPath,
        maxBuffer: 32 * 1024 * 1024,
      },
    );
    return parseGitFileList(stdout).length;
  } catch {
    return 0;
  }
}

function parseGitFileList(stdout: string): string[] {
  return stdout.split('\n').filter((line) => line.length > 0);
}

function buildDirectoryTree(files: FileEntry[], rootPath: string): DirectoryNode {
  const root: DirectoryNode = {
    name: path.basename(rootPath),
    path: '.',
    children: [],
    fileCount: 0,
    totalFileCount: 0,
  };

  const nodeMap = new Map<string, DirectoryNode>();
  nodeMap.set('.', root);

  for (const file of files) {
    const dir = file.directory;
    ensureNode(dir, nodeMap, root);
  }

  // Count files per directory
  for (const file of files) {
    const dir = file.directory === '' ? '.' : file.directory;
    const node = nodeMap.get(dir);
    if (node) {
      node.fileCount++;
    }
  }

  // Compute totalFileCount bottom-up
  computeTotalFileCount(root);

  // Sort children alphabetically
  sortTree(root);

  return root;
}

function ensureNode(
  dirPath: string,
  nodeMap: Map<string, DirectoryNode>,
  root: DirectoryNode,
): DirectoryNode {
  if (dirPath === '' || dirPath === '.') return root;

  const existing = nodeMap.get(dirPath);
  if (existing) return existing;

  const parentPath = path.dirname(dirPath);
  const parent = ensureNode(parentPath === '.' ? '.' : parentPath, nodeMap, root);

  const node: DirectoryNode = {
    name: path.basename(dirPath),
    path: dirPath,
    children: [],
    fileCount: 0,
    totalFileCount: 0,
  };

  parent.children.push(node);
  nodeMap.set(dirPath, node);
  return node;
}

function computeTotalFileCount(node: DirectoryNode): number {
  let total = node.fileCount;
  for (const child of node.children) {
    total += computeTotalFileCount(child);
  }
  node.totalFileCount = total;
  return total;
}

function sortTree(node: DirectoryNode): void {
  node.children.sort((a, b) => a.name.localeCompare(b.name));
  for (const child of node.children) {
    sortTree(child);
  }
}
