import type { FileEntry } from '../types.js';
import type { ChurnEntry } from './hotspotGit.js';
import { countLines } from './hotspotLines.js';

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.rb',
  '.go',
  '.java',
  '.rs',
  '.php',
  '.c',
  '.cc',
  '.cpp',
  '.h',
  '.hpp',
  '.cs',
  '.swift',
  '.kt',
  '.kts',
  '.scala',
  '.vue',
  '.svelte',
]);

const MAX_LINE_READS = 400;
const MAX_LINE_READ_BYTES = 512 * 1024;

export interface HotspotCandidateEvidence {
  candidates: FileEntry[];
  lineCounts: Map<string, number>;
}

export async function collectHotspotCandidateEvidence(
  files: FileEntry[],
  churnMap: Map<string, ChurnEntry>,
): Promise<HotspotCandidateEvidence> {
  const candidates = selectHotspotCandidates(files);
  const readTargets = rankLineReadTargets(candidates, churnMap).slice(0, MAX_LINE_READS);
  const lineCounts = await collectLineCounts(readTargets);
  return { candidates, lineCounts };
}

export function selectHotspotCandidates(files: FileEntry[]): FileEntry[] {
  return files.filter(isSizedCodeFile);
}

export function rankLineReadTargets(
  candidates: FileEntry[],
  churnMap: Map<string, ChurnEntry>,
): FileEntry[] {
  return [...candidates].sort(compareChurnThenSize(churnMap));
}

function isSizedCodeFile(file: FileEntry): boolean {
  return CODE_EXTENSIONS.has(file.extension) && file.sizeBytes <= MAX_LINE_READ_BYTES;
}

function compareChurnThenSize(
  churnMap: Map<string, ChurnEntry>,
): (a: FileEntry, b: FileEntry) => number {
  return (a, b) => {
    const aChurn = churnMap.get(a.relativePath)?.churn ?? 0;
    const bChurn = churnMap.get(b.relativePath)?.churn ?? 0;
    if (bChurn !== aChurn) return bChurn - aChurn;
    return b.sizeBytes - a.sizeBytes;
  };
}

async function collectLineCounts(readTargets: FileEntry[]): Promise<Map<string, number>> {
  const lineCounts = new Map<string, number>();
  await Promise.all(
    readTargets.map(async (file) => {
      const lines = await countLines(file.absolutePath);
      if (lines !== null) lineCounts.set(file.relativePath, lines);
    }),
  );
  return lineCounts;
}
