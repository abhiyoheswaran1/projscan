import path from 'node:path';
import type { FileEntry, ImportPolicyRule, Issue } from '../types.js';
import { buildCodeGraph } from '../core/codeGraph.js';
import { loadCachedGraph, saveCachedGraph } from '../core/indexCache.js';
import { computeCoupling } from '../core/couplingAnalyzer.js';
import { detectWorkspaces } from '../core/monorepo.js';
import { loadConfig } from '../utils/config.js';

const MAX_VIOLATIONS_REPORTED = 50;

/**
 * Cross-package import policy (0.14.0). Walks the cross-package edges
 * detected by `computeCoupling` and checks each against the user-configured
 * `monorepo.importPolicy` block in `.projscanrc`. Emits one
 * `cross-package-violation-N` issue per violating edge (capped at 50 to
 * keep the doctor output bounded on large monorepos).
 *
 * Off by default: the analyzer is a no-op when no `monorepo.importPolicy`
 * entries are configured or when the repo isn't a monorepo. Adding a
 * single rule turns it on for the matching `from` package.
 */
export async function check(rootPath: string, files: FileEntry[]): Promise<Issue[]> {
  const { config } = await loadConfig(rootPath);
  const rules = config.monorepo?.importPolicy ?? [];
  if (rules.length === 0) return [];

  const ws = await detectWorkspaces(rootPath);
  const realWorkspaces = ws.packages.filter((p) => !p.isRoot);
  if (ws.kind === 'none' || realWorkspaces.length < 2) return [];

  // Index rules by `from` for O(1) lookup.
  const rulesByPackage = new Map<string, ImportPolicyRule>();
  for (const r of rules) rulesByPackage.set(r.from, r);

  const cached = await loadCachedGraph(rootPath);
  let graph;
  try {
    graph = await buildCodeGraph(rootPath, files, cached);
  } catch {
    return [];
  }
  await saveCachedGraph(rootPath, graph).catch(() => undefined);

  const coupling = computeCoupling(graph, ws);
  if (coupling.crossPackageEdges.length === 0) return [];

  const issues: Issue[] = [];
  let counter = 0;
  for (const edge of coupling.crossPackageEdges) {
    if (issues.length >= MAX_VIOLATIONS_REPORTED) break;
    const rule = rulesByPackage.get(edge.from.package);
    if (!rule) continue;

    const verdict = evaluateEdge(rule, edge.to.package);
    if (verdict !== 'deny') continue;

    counter++;
    // Try to find the actual import line. The graph file's imports include
    // resolved files; we can match by source string suffix to recover the line.
    const importingFile = graph.files.get(edge.from.file);
    const lineHint = importingFile?.imports.find((i) =>
      // The resolved target's basename usually appears in the source spec;
      // this is best-effort. If we can't pin a line, fall back to file only.
      edge.to.file.includes(path.basename(i.source).replace(/\.[a-z]+$/, '')),
    );
    const location = lineHint?.line
      ? { file: edge.from.file, line: lineHint.line }
      : { file: edge.from.file };

    issues.push({
      id: `cross-package-violation-${counter}`,
      title: `Disallowed import from "${edge.from.package}" to "${edge.to.package}"`,
      description:
        `${edge.from.file} imports from package "${edge.to.package}" but the .projscanrc importPolicy rule for "${edge.from.package}" forbids it. ` +
        'Replace with the package\'s public entry or update the importPolicy.',
      severity: 'warning',
      category: 'architecture',
      fixAvailable: false,
      locations: [location],
    });
  }

  if (coupling.crossPackageEdges.length > MAX_VIOLATIONS_REPORTED && issues.length === MAX_VIOLATIONS_REPORTED) {
    issues.push({
      id: 'cross-package-violation-overflow',
      title: 'Additional cross-package policy violations not reported',
      description: `Doctor caps violation reporting at ${MAX_VIOLATIONS_REPORTED}. Run \`projscan coupling\` for the full edge list.`,
      severity: 'info',
      category: 'architecture',
      fixAvailable: false,
    });
  }

  return issues;
}

/**
 * Decide whether an edge from a rule's `from` package to `targetPackage`
 * is allowed or denied. Logic:
 *   - If `allow` is set and matches → 'allow' (short-circuits).
 *   - If `deny` is set and matches → 'deny'.
 *   - If `allow` is set and doesn't match → 'deny' (allow-list semantics).
 *   - Otherwise → 'allow' (no policy hit).
 */
function evaluateEdge(rule: ImportPolicyRule, targetPackage: string): 'allow' | 'deny' {
  if (rule.allow && rule.allow.length > 0) {
    if (matchesAny(targetPackage, rule.allow)) return 'allow';
    // allow-list miss is a deny.
    return 'deny';
  }
  if (rule.deny && rule.deny.length > 0) {
    if (matchesAny(targetPackage, rule.deny)) return 'deny';
  }
  return 'allow';
}

function matchesAny(name: string, patterns: string[]): boolean {
  for (const p of patterns) {
    if (matchesGlob(name, p)) return true;
  }
  return false;
}

function matchesGlob(name: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern === name) return true;
  // Simple suffix glob: `pkg/*`
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    if (name.startsWith(prefix + '/')) return true;
  }
  // Simple prefix glob: `*/sub`
  if (pattern.startsWith('*/')) {
    const suffix = pattern.slice(2);
    if (name.endsWith('/' + suffix)) return true;
  }
  return false;
}
