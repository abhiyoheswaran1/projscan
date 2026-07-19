import type { FileEntry } from '../types.js';
import { isAdapterParseable } from './languages/registry.js';

/**
 * Code file types projscan has no adapter for.
 *
 * This list exists so the ledger reports *blind spots* rather than *file
 * counts*: a `.png` or a `README.md` is not a gap in our analysis, but a
 * directory of `.dart` files is. Only extensions that carry real program logic
 * belong here — adding noise here devalues every number the ledger prints.
 *
 * When an adapter starts claiming an extension, `isAdapterParseable` wins and
 * the entry below becomes inert, so this list is safe to leave alone as
 * adapters land.
 */
const UNSUPPORTED_CODE_EXTENSIONS = new Set([
  // Template / view languages that import application modules.
  '.mdx',
  '.erb',
  '.haml',
  '.slim',
  '.liquid',
  '.hbs',
  '.handlebars',
  '.ejs',
  '.pug',
  '.jade',
  '.twig',
  '.razor',
  '.cshtml',
  '.jsp',
  // Languages with no adapter yet.
  '.dart',
  '.scala',
  '.ex',
  '.exs',
  '.erl',
  '.clj',
  '.cljs',
  '.hs',
  '.lua',
  '.jl',
  '.r',
  '.pl',
  '.pm',
  '.zig',
  '.nim',
  '.vb',
  '.fs',
  '.fsx',
  '.groovy',
  '.gradle',
  '.tf',
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.sql',
  '.proto',
  '.graphql',
  '.gql',
]);

/**
 * Blind spots that can hold an import of project code. A `.dart` file may
 * import a module; a `.sql` file cannot. Only the former weakens a
 * "nothing imports this" style conclusion, so only the former should make an
 * analyzer hedge.
 */
const NON_IMPORTING_EXTENSIONS = new Set(['.sql', '.proto', '.graphql', '.gql', '.tf']);

export interface BlindSpot {
  extension: string;
  fileCount: number;
}

export interface CoverageLedger {
  /** Files a language adapter claimed and therefore reasoned over. */
  analyzedFiles: number;
  /** Code files with no adapter — the analysis could not see inside these. */
  blindSpotFiles: number;
  /** Blind spots grouped by extension, largest group first. */
  blindSpots: BlindSpot[];
  /**
   * True when at least one blind spot could contain an import of project code.
   *
   * Callers should use this to downgrade *negative* findings — "nothing imports
   * this file", "this export is unused", "no caller found". Those conclusions
   * rest on having seen every importer, which is exactly the assumption a blind
   * spot breaks. Positive findings are unaffected.
   */
  weakensReachability: boolean;
}

export function computeCoverageLedger(files: FileEntry[]): CoverageLedger {
  let analyzedFiles = 0;
  const blindSpotCounts = new Map<string, number>();

  for (const file of files) {
    if (isAdapterParseable(file.relativePath)) {
      analyzedFiles++;
      continue;
    }
    const ext = file.extension.toLowerCase();
    if (!UNSUPPORTED_CODE_EXTENSIONS.has(ext)) continue;
    blindSpotCounts.set(ext, (blindSpotCounts.get(ext) ?? 0) + 1);
  }

  const blindSpots = [...blindSpotCounts.entries()]
    .map(([extension, fileCount]) => ({ extension, fileCount }))
    // Largest group first; ties broken alphabetically so output is stable
    // across runs and safe to assert on in tests and CI diffs.
    .sort((a, b) => b.fileCount - a.fileCount || a.extension.localeCompare(b.extension));

  return {
    analyzedFiles,
    blindSpotFiles: blindSpots.reduce((sum, s) => sum + s.fileCount, 0),
    blindSpots,
    weakensReachability: blindSpots.some((s) => !NON_IMPORTING_EXTENSIONS.has(s.extension)),
  };
}

/** One-line human summary, or null when the analysis had full coverage. */
export function describeCoverageLedger(ledger: CoverageLedger): string | null {
  if (ledger.blindSpotFiles === 0) return null;
  const groups = ledger.blindSpots
    .slice(0, 4)
    .map((s) => `${s.extension} ×${s.fileCount}`)
    .join(', ');
  const more = ledger.blindSpots.length > 4 ? `, +${ledger.blindSpots.length - 4} more` : '';
  return `Analyzed ${ledger.analyzedFiles} files; ${ledger.blindSpotFiles} code files had no adapter (${groups}${more}).`;
}
