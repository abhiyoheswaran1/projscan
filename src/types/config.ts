import type { IssueSeverity } from './common.js';

export type ReportFormat = 'console' | 'json' | 'markdown' | 'sarif' | 'html';

export interface ProjscanConfig {
  minScore?: number;
  baseRef?: string;
  hotspots?: {
    limit?: number;
    since?: string;
  };
  ignore?: string[];
  scan?: {
    includeIgnored?: boolean;
    scanEnvValues?: boolean;
    offline?: boolean;
  };
  disableRules?: string[];
  severityOverrides?: Record<string, IssueSeverity>;
  /**
   * Named evidence-export presets. `analyze`, `doctor`, and `ci` can select
   * one with `--report-policy <name>` and still override scope/redaction with
   * direct CLI flags for a single run.
   */
  reportPolicies?: Record<string, ReportPolicyPreset>;
  /**
   * Monorepo-specific configuration (0.14.0+). Currently scopes the
   * cross-package import policy: each entry says "package P may only import
   * from these listed packages, or specifically may NOT import from these
   * listed packages." Edges that violate become `cross-package-violation-*`
   * issues in projscan_doctor.
   */
  monorepo?: {
    importPolicy?: ImportPolicyRule[];
  };
  /**
   * Taint analysis tuning (1.6.0+). Both lists merge ON TOP of the
   * built-in defaults - they don't replace them. Use this to add
   * project-specific source/sink names: `customSecretReader`, `query`,
   * `runRawSql`, etc. To suppress a default, list the rule id under
   * `disableRules` (e.g. `taint-flow-detected`).
   */
  taint?: {
    sources?: string[];
    sinks?: string[];
  };
}

export interface ReportPolicyPreset {
  reportScope?: string[];
  redactPaths?: boolean;
}

/**
 * One cross-package import rule. `from` is the package name (matches
 * WorkspacePackage.name). Exactly one of `allow` / `deny` is required. Both
 * lists are package-name globs - a leading `!` negates a single entry, and a
 * single `*` is the wildcard. When both `allow` and `deny` are set, allow
 * is checked first and a hit short-circuits as ALLOWED; otherwise deny is
 * checked.
 */
export interface ImportPolicyRule {
  from: string;
  allow?: string[];
  deny?: string[];
}

export interface LoadedConfig {
  config: ProjscanConfig;
  source: string | null;
}
