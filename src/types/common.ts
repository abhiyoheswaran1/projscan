export type IssueSeverity = 'info' | 'warning' | 'error';

export interface IssueLocation {
  file: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  category: string;
  fixAvailable: boolean;
  fixId?: string;
  locations?: IssueLocation[];
  /**
   * One-line hint shown inline in projscan_doctor output (0.14.0+). Points
   * at the fix-suggest pipeline. Absent when no template matches the issue.
   */
  suggestedAction?: { summary: string };
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  isRelative: boolean;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'default' | 'unknown';
}
