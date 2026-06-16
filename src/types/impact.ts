/**
 * One reachable file in an impact analysis. `distance` is BFS-hops from the
 * input target (1 = direct dependent, 2 = dependent-of-dependent, etc).
 * `target` itself is not included in the reachable list.
 */
export interface ImpactNode {
  file: string;
  distance: number;
  /**
   * 1.6+ - name of the registered repo that contains this file.
   * Present only when `cross_repo: true` was passed and the file
   * lives outside the source repo. Absent for in-repo entries.
   */
  repo?: string;
}

export interface ImpactBoundarySummary {
  repo: string;
  packageName: string;
  owner: string;
  files: string[];
  reachableFiles: number;
}

export interface ImpactReport {
  available: boolean;
  reason?: string;
  /** What was queried. */
  target: { kind: 'file' | 'symbol'; value: string };
  /**
   * For symbol mode: every file the graph claims defines the symbol. Empty
   * for file mode. Useful when an agent needs to know whether a name is
   * defined in multiple places before treating impact as authoritative.
   */
  definitionFiles: string[];
  /**
   * For symbol mode: files that directly call the symbol (their callSites
   * contains the name). The reachable set is computed from these as roots.
   * Empty for file mode.
   */
  directCallers: string[];
  /** Sorted by distance asc, then file asc. */
  reachable: ImpactNode[];
  /** Convenience count of reachable files (== reachable.length). */
  totalReachable: number;
  /**
   * 1.6+ - when cross-repo expansion ran, this is the per-repo
   * breakdown of reachable file counts. Absent when `cross_repo`
   * was false or the workspace had no siblings.
   */
  totalReachableByRepo?: Record<string, number>;
  /** 3.5+ - cross-repo package/ownership boundaries that mention the target. */
  boundarySummary?: ImpactBoundarySummary[];
  /**
   * True when traversal hit `maxDistance` before exhausting the graph.
   * Items beyond the limit are omitted from `reachable`.
   */
  truncated: boolean;
  /** The maxDistance value used for the traversal. */
  maxDistance: number;
}
