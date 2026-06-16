import type { ReviewCycle } from '../types/review.js';

export function scopeCyclesToFiles(
  cycles: ReviewCycle[],
  scopeFiles?: Set<string>,
): ReviewCycle[] {
  if (!scopeFiles) return cycles;
  return cycles.filter((cycle) => cycle.files.some((file) => scopeFiles.has(file)));
}

export function classifyNewCycles(
  baseCycles: { files: string[] }[],
  headCycles: { files: string[] }[],
  filesAddedInPr: string[],
): ReviewCycle[] {
  const added = new Set(filesAddedInPr);
  const out: ReviewCycle[] = [];
  for (const head of headCycles) {
    const bestOverlap = bestCycleOverlap(head.files, baseCycles);
    if (bestOverlap === 0) {
      out.push({ files: [...head.files].sort(), size: head.files.length, classification: 'new' });
    } else if (bestOverlap < head.files.length) {
      out.push({
        files: [...head.files].sort(),
        size: head.files.length,
        classification: 'expanded',
      });
    }
  }
  return sortCyclesByAddedFiles(out, added);
}

function bestCycleOverlap(headFiles: string[], baseCycles: { files: string[] }[]): number {
  const headSet = new Set(headFiles);
  let bestOverlap = 0;
  for (const base of baseCycles) {
    const overlap = countOverlap(headSet, base.files);
    if (overlap > bestOverlap) bestOverlap = overlap;
  }
  return bestOverlap;
}

function countOverlap(headSet: Set<string>, baseFiles: string[]): number {
  let overlap = 0;
  for (const file of baseFiles) if (headSet.has(file)) overlap++;
  return overlap;
}

function sortCyclesByAddedFiles(cycles: ReviewCycle[], added: Set<string>): ReviewCycle[] {
  return cycles.sort((a, b) => {
    const aTouchesAdded = cycleTouchesAddedFile(a, added) ? 0 : 1;
    const bTouchesAdded = cycleTouchesAddedFile(b, added) ? 0 : 1;
    if (aTouchesAdded !== bTouchesAdded) return aTouchesAdded - bTouchesAdded;
    return b.size - a.size;
  });
}

function cycleTouchesAddedFile(cycle: ReviewCycle, added: Set<string>): boolean {
  return cycle.files.some((file) => added.has(file));
}
