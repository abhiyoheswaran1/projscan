import type { FileEntry, Issue } from '../types.js';
import { buildCodeGraph } from '../core/codeGraph.js';
import { loadCachedGraph, saveCachedGraph } from '../core/indexCache.js';
import { computeCoupling } from '../core/couplingAnalyzer.js';

const MAX_FILES_PER_CYCLE_ISSUE = 8;
const MAX_CYCLES_REPORTED = 20;

/**
 * Lift Tarjan-detected import cycles from the coupling analyzer into the
 * doctor issue list. Each cycle yields ONE warning issue listing every file
 * in the cycle as a location, so an agent calling `projscan_doctor` (which
 * doesn't fetch coupling data on its own) still sees circular dependencies.
 *
 * Capped at MAX_CYCLES_REPORTED to keep the doctor output bounded on
 * pathological codebases. Each issue's `locations` is capped at
 * MAX_FILES_PER_CYCLE_ISSUE; the rest are listed in the description.
 */
export async function check(rootPath: string, files: FileEntry[]): Promise<Issue[]> {
  // Build the graph (cache-first). saveCachedGraph is best-effort and won't
  // throw on permissions issues.
  const cached = await loadCachedGraph(rootPath);
  let graph;
  try {
    graph = await buildCodeGraph(rootPath, files, cached);
  } catch {
    // If graph building fails entirely (e.g. all parsers throw), skip silently.
    return [];
  }
  await saveCachedGraph(rootPath, graph).catch(() => undefined);

  const coupling = computeCoupling(graph);
  if (coupling.cycles.length === 0) return [];

  const issues: Issue[] = [];
  const cyclesToReport = coupling.cycles.slice(0, MAX_CYCLES_REPORTED);

  for (let i = 0; i < cyclesToReport.length; i++) {
    const cycle = cyclesToReport[i];
    const id = `cycle-detected-${i + 1}`;
    const locFiles = cycle.files.slice(0, MAX_FILES_PER_CYCLE_ISSUE);
    const overflowCount = cycle.files.length - locFiles.length;

    const filesPretty = cycle.files.join(', ');
    const description =
      overflowCount > 0
        ? `Circular import among ${cycle.size} files: ${filesPretty}. Resolve by introducing an interface boundary or moving shared types to a leaf module.`
        : `Circular import among ${cycle.size} files: ${filesPretty}. Resolve by introducing an interface boundary or moving shared types to a leaf module.`;

    issues.push({
      id,
      title: `Circular imports detected (${cycle.size} files)`,
      description,
      severity: 'warning',
      category: 'architecture',
      fixAvailable: false,
      locations: locFiles.map((file) => ({ file })),
    });
  }

  if (coupling.cycles.length > MAX_CYCLES_REPORTED) {
    issues.push({
      id: 'cycle-detected-overflow',
      title: `${coupling.cycles.length - MAX_CYCLES_REPORTED} additional import cycles not reported`,
      description: `Doctor caps cycle reporting at ${MAX_CYCLES_REPORTED} cycles. Run \`projscan coupling --cycles-only\` for the full list.`,
      severity: 'info',
      category: 'architecture',
      fixAvailable: false,
    });
  }

  return issues;
}
