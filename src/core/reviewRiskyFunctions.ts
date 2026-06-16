import type { FunctionInfo } from './ast.js';
import type { CodeGraph, GraphFile } from './codeGraph.js';
import type { ReviewFunction } from '../types/review.js';

const HIGH_CC_THRESHOLD = 10;
const CC_JUMP_THRESHOLD = 5;

export function findRiskyFunctions(
  baseGraph: CodeGraph,
  headGraph: CodeGraph,
  prDiff: { filesAdded: string[]; filesModified: { relativePath: string }[] },
): ReviewFunction[] {
  const out: ReviewFunction[] = [];

  appendAddedFileRiskyFunctions(out, headGraph, prDiff.filesAdded);

  for (const f of prDiff.filesModified) {
    appendModifiedFileRiskyFunctions(out, baseGraph, headGraph, f.relativePath);
  }

  out.sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity);
  return out;
}

function appendAddedFileRiskyFunctions(
  out: ReviewFunction[],
  headGraph: CodeGraph,
  filesAdded: string[],
): void {
  for (const file of filesAdded) {
    const head = headGraph.files.get(file);
    if (head) appendAddedHighComplexityFunctions(out, file, head);
  }
}

function appendAddedHighComplexityFunctions(
  out: ReviewFunction[],
  file: string,
  graphFile: GraphFile,
): void {
  for (const fn of graphFile.functions ?? []) {
    if (fn.cyclomaticComplexity >= HIGH_CC_THRESHOLD) {
      out.push(reviewFunction(file, fn, null, 'added'));
    }
  }
}

function appendModifiedFileRiskyFunctions(
  out: ReviewFunction[],
  baseGraph: CodeGraph,
  headGraph: CodeGraph,
  file: string,
): void {
  const head = headGraph.files.get(file);
  const base = baseGraph.files.get(file);
  if (!head || !base) return;

  const baseByName = functionComplexitiesByName(base);
  const headCountByName = functionCountsByName(head);
  for (const fn of head.functions ?? []) {
    const risk = classifyModifiedFunctionRisk(
      fn,
      baseByName.get(fn.name),
      headCountByName.get(fn.name) ?? 0,
    );
    if (risk) out.push(reviewFunction(file, fn, risk.baseCc, risk.reason));
  }
}

interface ModifiedFunctionRisk {
  baseCc: number | null;
  reason: ReviewFunction['reason'];
}

function classifyModifiedFunctionRisk(
  fn: FunctionInfo,
  candidates: number[] | undefined,
  headNameCount: number,
): ModifiedFunctionRisk | null {
  if (!candidates || candidates.length === 0) {
    return fn.cyclomaticComplexity >= HIGH_CC_THRESHOLD ? { baseCc: null, reason: 'added' } : null;
  }
  // Pair head-vs-base only when the name is unambiguous on BOTH sides
  // (1 to 1). Other ratios are usually anonymous callbacks with no stable identity.
  if (candidates.length > 1 || headNameCount > 1) return null;

  const baseCc = candidates[0];
  if (baseCc < HIGH_CC_THRESHOLD && fn.cyclomaticComplexity >= HIGH_CC_THRESHOLD) {
    return { baseCc, reason: 'crossed-threshold' };
  }
  if (fn.cyclomaticComplexity - baseCc >= CC_JUMP_THRESHOLD) {
    return { baseCc, reason: 'jumped' };
  }
  return null;
}

function functionComplexitiesByName(file: GraphFile): Map<string, number[]> {
  const byName = new Map<string, number[]>();
  for (const fn of file.functions ?? []) {
    const list = byName.get(fn.name) ?? [];
    list.push(fn.cyclomaticComplexity);
    byName.set(fn.name, list);
  }
  return byName;
}

function functionCountsByName(file: GraphFile): Map<string, number> {
  const counts = new Map<string, number>();
  for (const fn of file.functions ?? []) {
    counts.set(fn.name, (counts.get(fn.name) ?? 0) + 1);
  }
  return counts;
}

function reviewFunction(
  file: string,
  fn: FunctionInfo,
  baseCc: number | null,
  reason: ReviewFunction['reason'],
): ReviewFunction {
  return {
    file,
    name: fn.name,
    line: fn.line,
    endLine: fn.endLine,
    cyclomaticComplexity: fn.cyclomaticComplexity,
    baseCc,
    reason,
  };
}
