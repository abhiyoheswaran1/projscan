export interface ExportRename {
  from: string;
  to: string;
}

export interface FileAstDiff {
  relativePath: string;
  status: 'added' | 'removed' | 'modified';
  exportsAdded: string[];
  exportsRemoved: string[];
  /**
   * Heuristically-detected renames (0.11). When an export disappears from
   * base AND a similar new name appears in head AND no other export matches,
   * we report it here instead of as a +/- pair. Removed/added lists exclude
   * any names that ended up in renames.
   */
  exportsRenamed: ExportRename[];
  importsAdded: string[];
  importsRemoved: string[];
  callsAdded: string[];
  callsRemoved: string[];
  /** CC(head) - CC(base). null when either side wasn't AST-parsed. */
  cyclomaticDelta: number | null;
  /** fanIn(head) - fanIn(base). null when graph entry missing on either side. */
  fanInDelta: number | null;
}

export interface PrDiffReport {
  available: boolean;
  reason?: string;
  base: { ref: string; resolvedSha: string | null };
  head: { ref: string; resolvedSha: string | null };
  filesAdded: string[];
  filesRemoved: string[];
  filesModified: FileAstDiff[];
  totalFilesChanged: number;
}
