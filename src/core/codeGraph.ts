import type { FileEntry } from '../types.js';
import { listAdapters } from './languages/registry.js';
import { mapWithConcurrency, DEFAULT_FILE_IO_CONCURRENCY } from '../utils/concurrency.js';
import { computeFanIn, computeFanOut } from './codeGraphFanMetrics.js';
import { selectParseableGraphInputs } from './codeGraphFileSelection.js';
import { rebuildCrossFileIndexes } from './codeGraphIndexes.js';
import { parseFileToGraphEntry } from './codeGraphParsing.js';
import { prepareAdapterContexts } from './codeGraphAdapterContexts.js';
export {
  packagesUsed,
  filesImportingPackage,
  filesImportingFile,
  filesDefiningSymbol,
  importersOf,
  exportsOf,
  importsOf,
} from './codeGraphQueries.js';
export { incrementallyUpdateGraph } from './codeGraphIncremental.js';
import { expandLocalStarReexports } from './codeGraphReexports.js';
import type { CodeGraph, GraphFile } from './codeGraphTypes.js';

export type { CodeGraph, GraphFile };

export async function buildCodeGraph(
  rootPath: string,
  files: FileEntry[],
  previousGraph?: CodeGraph,
): Promise<CodeGraph> {
  const contextByAdapter = await prepareAdapterContexts(rootPath, files);
  const parseable = selectParseableGraphInputs(files);

  const graphFiles = new Map<string, GraphFile>();
  // Bound concurrency. Without this, a 10K-file repo would issue 10K
  // concurrent fs.stat + fs.readFile + adapter.parse, far exceeding macOS's
  // default 256 open-files ulimit and tripping EMFILE on cold scans.
  await mapWithConcurrency(parseable, DEFAULT_FILE_IO_CONCURRENCY, async ({ file, adapter }) => {
    const entry = await parseFileToGraphEntry(rootPath, file, adapter, previousGraph);
    if (entry) graphFiles.set(file.relativePath, entry);
  });

  expandLocalStarReexports(graphFiles, contextByAdapter);
  const { localImporters, packageImporters, symbolDefs } = rebuildCrossFileIndexes(
    graphFiles,
    contextByAdapter,
  );
  computeFanIn(graphFiles);
  computeFanOut(graphFiles);

  return {
    files: graphFiles,
    packageImporters,
    localImporters,
    symbolDefs,
    scannedFiles: graphFiles.size,
  };
}

/**
 * Back-compat: convert a JS/TS import specifier to a bare package name.
 * Delegates to the JavaScript adapter. For multi-language use cases, prefer
 * `getAdapterFor(filePath).toPackageName(specifier)`.
 */
export function toPackageName(specifier: string): string | null {
  const jsAdapter = listAdapters().find((a) => a.id === 'javascript');
  return jsAdapter ? jsAdapter.toPackageName(specifier) : null;
}
