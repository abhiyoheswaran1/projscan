import type { CodeGraph } from './codeGraph.js';
import { buildPublicExportFileSet } from './reviewPublicSurface.js';
import type { ManifestSnapshot } from './reviewManifests.js';
import type { PrDiffReport } from '../types/prDiff.js';
import type { ReviewContractChange } from '../types/reviewContract.js';

type ExportChangeKind = 'export-added' | 'export-removed';
type ModifiedFileDiff = PrDiffReport['filesModified'][number];

export function buildContractChanges(
  prDiff: PrDiffReport,
  baseGraph: CodeGraph,
  headGraph: CodeGraph,
  baseManifests: Map<string, ManifestSnapshot>,
  headManifests: Map<string, ManifestSnapshot>,
  packageName?: string,
): ReviewContractChange[] {
  const scopedBaseManifests = scopeManifestsByPackage(baseManifests, packageName);
  const scopedHeadManifests = scopeManifestsByPackage(headManifests, packageName);
  const publicExportFiles = buildPublicExportFileSet(
    scopedBaseManifests.values(),
    scopedHeadManifests.values(),
    baseGraph,
    headGraph,
  );
  return [
    ...exportContractChangesForFiles(
      'export-added',
      prDiff.filesAdded,
      headGraph,
      publicExportFiles,
    ),
    ...exportContractChangesForFiles(
      'export-removed',
      prDiff.filesRemoved,
      baseGraph,
      publicExportFiles,
    ),
    ...modifiedExportContractChanges(prDiff.filesModified, publicExportFiles),
    ...entrypointContractChanges(scopedBaseManifests, scopedHeadManifests),
  ];
}

function scopeManifestsByPackage(
  manifests: Map<string, ManifestSnapshot>,
  packageName?: string,
): Map<string, ManifestSnapshot> {
  if (!packageName) return manifests;
  return new Map([...manifests].filter(([, manifest]) => manifest.workspace === packageName));
}

function exportContractChangesForFiles(
  kind: ExportChangeKind,
  files: string[],
  graph: CodeGraph,
  publicExportFiles: Set<string>,
): ReviewContractChange[] {
  const changes: ReviewContractChange[] = [];
  for (const file of files) {
    if (!publicExportFiles.has(file)) continue;
    for (const exp of graph.files.get(file)?.exports ?? []) {
      changes.push(exportContractChange(kind, file, exp.name));
    }
  }
  return changes;
}

function modifiedExportContractChanges(
  files: ModifiedFileDiff[],
  publicExportFiles: Set<string>,
): ReviewContractChange[] {
  const changes: ReviewContractChange[] = [];
  for (const file of files) {
    if (!publicExportFiles.has(file.relativePath)) continue;
    appendExportSymbolChanges(changes, 'export-added', file.relativePath, file.exportsAdded);
    appendExportSymbolChanges(changes, 'export-removed', file.relativePath, file.exportsRemoved);
    appendRenamedExportChanges(changes, file);
  }
  return changes;
}

function appendExportSymbolChanges(
  changes: ReviewContractChange[],
  kind: ExportChangeKind,
  file: string,
  symbols: string[],
): void {
  for (const symbol of symbols) {
    changes.push(exportContractChange(kind, file, symbol));
  }
}

function appendRenamedExportChanges(
  changes: ReviewContractChange[],
  file: ModifiedFileDiff,
): void {
  for (const rename of file.exportsRenamed) {
    changes.push({
      kind: 'export-renamed',
      file: file.relativePath,
      symbol: rename.to,
      before: rename.from,
      after: rename.to,
      confidence: 'high',
      why: `Export "${rename.from}" was renamed to "${rename.to}" in ${file.relativePath}; downstream imports of the old name can fail at compile time or runtime.`,
    });
  }
}

function exportContractChange(
  kind: ExportChangeKind,
  file: string,
  symbol: string,
): ReviewContractChange {
  return {
    kind,
    file,
    symbol,
    confidence: 'high',
    why:
      kind === 'export-added'
        ? `Export "${symbol}" was added in ${file}; downstream code may start depending on a new public API.`
        : `Export "${symbol}" was removed from ${file}; downstream imports can fail at compile time or runtime.`,
  };
}

function entrypointContractChanges(
  base: Map<string, ManifestSnapshot>,
  head: Map<string, ManifestSnapshot>,
): ReviewContractChange[] {
  const out: ReviewContractChange[] = [];
  for (const manifestFile of allManifestFiles(base, head)) {
    out.push(
      ...entrypointChangesForManifest(
        manifestFile,
        base.get(manifestFile)?.entrypoints ?? {},
        head.get(manifestFile)?.entrypoints ?? {},
      ),
    );
  }
  return out.sort(sortContractChange);
}

function allManifestFiles(
  base: Map<string, ManifestSnapshot>,
  head: Map<string, ManifestSnapshot>,
): Set<string> {
  return new Set<string>([...base.keys(), ...head.keys()]);
}

function entrypointChangesForManifest(
  manifestFile: string,
  baseEntrypoints: Record<string, string>,
  headEntrypoints: Record<string, string>,
): ReviewContractChange[] {
  const changes: ReviewContractChange[] = [];
  for (const field of entrypointFields(baseEntrypoints, headEntrypoints)) {
    const change = entrypointContractChange(
      manifestFile,
      field,
      baseEntrypoints[field],
      headEntrypoints[field],
    );
    if (change) changes.push(change);
  }
  return changes;
}

function entrypointFields(
  baseEntrypoints: Record<string, string>,
  headEntrypoints: Record<string, string>,
): Set<string> {
  return new Set<string>([...Object.keys(baseEntrypoints), ...Object.keys(headEntrypoints)]);
}

function entrypointContractChange(
  manifestFile: string,
  field: string,
  before: string | undefined,
  after: string | undefined,
): ReviewContractChange | null {
  if (before === after) return null;
  const kind = field === 'exports' ? 'public-export-changed' : 'entrypoint-changed';
  return {
    kind,
    file: manifestFile,
    symbol: field,
    ...(before !== undefined ? { before } : {}),
    ...(after !== undefined ? { after } : {}),
    confidence: 'high',
    why: entrypointContractWhy(kind, manifestFile, field, before, after),
  };
}

function entrypointContractWhy(
  kind: 'public-export-changed' | 'entrypoint-changed',
  manifestFile: string,
  field: string,
  before: string | undefined,
  after: string | undefined,
): string {
  if (kind === 'public-export-changed') {
    return `${manifestFile} package "exports" changed; consumers may resolve different public modules.`;
  }
  return `${manifestFile} package "${field}" changed from ${before ?? '<unset>'} to ${after ?? '<unset>'}; package consumers may load a different entrypoint.`;
}

function sortContractChange(a: ReviewContractChange, b: ReviewContractChange): number {
  return `${a.file}:${a.symbol ?? ''}`.localeCompare(`${b.file}:${b.symbol ?? ''}`);
}
