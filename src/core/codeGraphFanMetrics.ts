import type { FunctionInfo } from './ast.js';

type FanMetricGraphFile = {
  relativePath: string;
  callSites: string[];
  functions?: FunctionInfo[];
};

/**
 * Per-function fan-in. For each function name across the graph, count how many
 * OTHER files include the name in their `callSites`.
 */
export function computeFanIn(graphFiles: Map<string, FanMetricGraphFile>): void {
  const callerFilesByName = collectCallerFilesByName(graphFiles);
  for (const gf of graphFiles.values()) applyFanIn(gf, callerFilesByName);
}

function collectCallerFilesByName(
  graphFiles: Map<string, FanMetricGraphFile>,
): Map<string, Set<string>> {
  const callerFilesByName = new Map<string, Set<string>>();
  for (const gf of graphFiles.values()) {
    for (const name of gf.callSites ?? []) {
      callerFilesFor(name, callerFilesByName).add(gf.relativePath);
    }
  }
  return callerFilesByName;
}

function callerFilesFor(name: string, callerFilesByName: Map<string, Set<string>>): Set<string> {
  let set = callerFilesByName.get(name);
  if (!set) {
    set = new Set();
    callerFilesByName.set(name, set);
  }
  return set;
}

function applyFanIn(
  gf: FanMetricGraphFile,
  callerFilesByName: Map<string, Set<string>>,
): void {
  if (!gf.functions || gf.functions.length === 0) return;
  for (const fn of gf.functions) {
    fn.fanIn = fanInForFunction(fn, gf.relativePath, callerFilesByName);
  }
}

function fanInForFunction(
  fn: FunctionInfo,
  relativePath: string,
  callerFilesByName: Map<string, Set<string>>,
): number {
  const callers = callerFilesByName.get(bareName(fn.name));
  return !callers ? 0 : callers.size - (callers.has(relativePath) ? 1 : 0);
}

/**
 * Per-function fan-out. Count distinct internal callee names, excluding
 * library, constructor, unknown, and self-recursive calls.
 */
export function computeFanOut(graphFiles: Map<string, FanMetricGraphFile>): void {
  const definedNames = collectDefinedNames(graphFiles);
  for (const gf of graphFiles.values()) {
    applyFanOut(gf, definedNames);
  }
}

function collectDefinedNames(graphFiles: Map<string, FanMetricGraphFile>): Set<string> {
  const definedNames = new Set<string>();
  for (const gf of graphFiles.values()) {
    if (!gf.functions) continue;
    for (const fn of gf.functions) definedNames.add(bareName(fn.name));
  }
  return definedNames;
}

function applyFanOut(gf: FanMetricGraphFile, definedNames: Set<string>): void {
  if (!gf.functions || gf.functions.length === 0) return;
  for (const fn of gf.functions) {
    fn.fanOut = countInternalFanOut(fn, definedNames);
  }
}

function countInternalFanOut(fn: FunctionInfo, definedNames: Set<string>): number {
  if (!fn.callSites) return 0;
  const selfBare = bareName(fn.name);
  const seen = new Set<string>();
  let count = 0;
  for (const callee of fn.callSites) {
    if (shouldCountCallee(callee, selfBare, definedNames, seen)) count += 1;
  }
  return count;
}

function shouldCountCallee(
  callee: string,
  selfBare: string,
  definedNames: Set<string>,
  seen: Set<string>,
): boolean {
  if (seen.has(callee)) return false;
  seen.add(callee);
  return callee !== selfBare && definedNames.has(callee);
}

function bareName(qualified: string): string {
  const dot = qualified.lastIndexOf('.');
  if (dot < 0) return qualified;
  return qualified.slice(dot + 1);
}
