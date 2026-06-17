export interface TaintConfig {
  /**
   * Bare callee names treated as taint sources. Examples:
   *   "process.env"        - environment variables (read sensitive config)
   *   "req.body"           - HTTP request body
   *   "readFileSync"       - disk read (could be user-controlled paths)
   *
   * Match is by bare name (the rightmost identifier in a member-access
   * chain). "process.env.SECRET" -> "env"; "req.body.userId" -> "body".
   * The default list captures the most common JS / Python / Go sources;
   * users override via .projscanrc taint.sources.
   */
  sources: string[];
  /**
   * Bare callee names treated as taint sinks. Examples:
   *   "exec"               - child_process.exec
   *   "spawn"              - child_process.spawn
   *   "writeFile"          - fs.writeFile
   *   "query"              - raw SQL (db.query("SELECT...${user}"))
   *   "eval"               - JS eval / Python eval / etc.
   */
  sinks: string[];
}

export interface TaintFlow {
  /** Bare function name where the source was called. */
  sourceFn: string;
  /** Bare function name where the sink was called. */
  sinkFn: string;
  /** The source identifier (e.g. "env"). */
  source: string;
  /** The sink identifier (e.g. "exec"). */
  sink: string;
  /**
   * Sequence of fully-qualified function names from sourceFn to sinkFn,
   * inclusive at both ends. Length 1 means the same function reads the
   * source and calls the sink (the most direct flow).
   */
  path: string[];
  /** Files touched by the path (in order, deduped). */
  files: string[];
}

export interface TaintReport {
  available: boolean;
  reason?: string;
  flowCount: number;
  flows: TaintFlow[];
  /** The effective sources/sinks list used for this run (after merging defaults + config). */
  effectiveSources: string[];
  effectiveSinks: string[];
  /**
   * 1.8+ - true when the BFS hit MAX_DEPTH for at least one source with
   * a non-empty frontier still pending. When set, the agent should know
   * that flows deeper than MAX_DEPTH may exist but weren't reported.
   * Pairs with `truncatedSources` so a follow-up scan can re-target.
   */
  truncated?: boolean;
  /**
   * 1.8+ - function names whose BFS exited at MAX_DEPTH with the
   * frontier non-empty. Empty when no truncation occurred.
   */
  truncatedSources?: string[];
  /**
   * 1.8+ - the depth cap actually used. Surfacing this lets agents
   * notice when projscan's defaults shift between releases.
   */
  maxDepth?: number;
}
