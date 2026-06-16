import type { CodeGraph } from './codeGraph.js';
import type { PrDiffReport } from '../types/prDiff.js';
import type { ReviewFile } from '../types/review.js';

export function indexHotspotRisk(
  hotspots: Array<{ relativePath: string; riskScore: number }>,
): Map<string, number> {
  const hotspotByPath = new Map<string, number>();
  for (const h of hotspots) hotspotByPath.set(h.relativePath, h.riskScore);
  return hotspotByPath;
}

export function buildReviewChangedFiles(
  prDiff: PrDiffReport,
  baseGraph: CodeGraph,
  headGraph: CodeGraph,
  hotspotByPath: Map<string, number>,
): ReviewFile[] {
  const changedFiles: ReviewFile[] = [];
  appendAddedReviewFiles(changedFiles, prDiff.filesAdded, headGraph, hotspotByPath);
  appendRemovedReviewFiles(changedFiles, prDiff.filesRemoved, baseGraph);
  appendModifiedReviewFiles(changedFiles, prDiff.filesModified, headGraph, hotspotByPath);
  changedFiles.sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
  return changedFiles;
}

function appendAddedReviewFiles(
  changedFiles: ReviewFile[],
  added: string[],
  headGraph: CodeGraph,
  hotspotByPath: Map<string, number>,
): void {
  for (const file of added) {
    const headFile = headGraph.files.get(file);
    changedFiles.push({
      relativePath: file,
      status: 'added',
      riskScore: hotspotByPath.get(file) ?? null,
      cyclomaticComplexity: headFile?.parseOk ? headFile.cyclomaticComplexity : null,
      cyclomaticDelta: null,
      exportsAdded: headFile?.exports.length ?? 0,
      exportsRemoved: 0,
      importsAdded: headFile?.imports.length ?? 0,
      importsRemoved: 0,
    });
  }
}

function appendRemovedReviewFiles(
  changedFiles: ReviewFile[],
  removed: string[],
  baseGraph: CodeGraph,
): void {
  for (const file of removed) {
    const baseFile = baseGraph.files.get(file);
    changedFiles.push({
      relativePath: file,
      status: 'removed',
      riskScore: null,
      cyclomaticComplexity: null,
      cyclomaticDelta: null,
      exportsAdded: 0,
      exportsRemoved: baseFile?.exports.length ?? 0,
      importsAdded: 0,
      importsRemoved: baseFile?.imports.length ?? 0,
    });
  }
}

function appendModifiedReviewFiles(
  changedFiles: ReviewFile[],
  modified: PrDiffReport['filesModified'],
  headGraph: CodeGraph,
  hotspotByPath: Map<string, number>,
): void {
  for (const file of modified) {
    const headFile = headGraph.files.get(file.relativePath);
    changedFiles.push({
      relativePath: file.relativePath,
      status: 'modified',
      riskScore: hotspotByPath.get(file.relativePath) ?? null,
      cyclomaticComplexity: headFile?.parseOk ? headFile.cyclomaticComplexity : null,
      cyclomaticDelta: file.cyclomaticDelta,
      exportsAdded: file.exportsAdded.length,
      exportsRemoved: file.exportsRemoved.length,
      importsAdded: file.importsAdded.length,
      importsRemoved: file.importsRemoved.length,
    });
  }
}
