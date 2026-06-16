import type { FileEntry, Issue } from '../types.js';

export function indexIssuesByFile(issues: Issue[], files: FileEntry[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const filePathSet = new Set(files.map((f) => f.relativePath));

  for (const issue of issues) {
    if (issue.locations && issue.locations.length > 0) {
      indexLocatedIssue(index, filePathSet, issue);
    } else {
      indexLegacyIssue(index, filePathSet, issue);
    }
  }
  return index;
}

function indexLocatedIssue(
  index: Map<string, string[]>,
  filePathSet: Set<string>,
  issue: Issue,
): void {
  // Prefer explicit locations when the analyzer supplied them - this is exact
  // and avoids substring false positives such as src/a.ts matching src/ab.ts.
  for (const loc of issue.locations ?? []) {
    if (loc.file && filePathSet.has(loc.file)) addIssueFile(index, loc.file, issue.id);
  }
}

function indexLegacyIssue(
  index: Map<string, string[]>,
  filePathSet: Set<string>,
  issue: Issue,
): void {
  // Fall back to substring scan for legacy issues with no locations.
  // Use word-boundary-ish guards: require the match to start at the
  // beginning of title/description OR be preceded/followed by non-path chars.
  const haystack = `${issue.title}\n${issue.description}`;
  for (const filePath of filePathSet) {
    if (!legacyIssueMentionsPath(haystack, filePath)) continue;
    addIssueFile(index, filePath, issue.id);
  }
}

function legacyIssueMentionsPath(haystack: string, filePath: string): boolean {
  return Boolean(filePath && haystack.includes(filePath) && hasPathBoundaries(haystack, filePath));
}

function addIssueFile(index: Map<string, string[]>, file: string, issueId: string): void {
  const list = index.get(file) ?? [];
  if (!list.includes(issueId)) list.push(issueId);
  index.set(file, list);
}

function hasPathBoundaries(haystack: string, filePath: string): boolean {
  let startIdx = 0;
  while (startIdx < haystack.length) {
    const idx = haystack.indexOf(filePath, startIdx);
    if (idx === -1) return false;
    const before = idx > 0 ? haystack.charCodeAt(idx - 1) : -1;
    const after =
      idx + filePath.length < haystack.length ? haystack.charCodeAt(idx + filePath.length) : -1;
    // Good boundary = start-of-string, whitespace, quote, paren, comma, colon, or end-of-string.
    if (isPathBoundary(before) && isPathBoundary(after)) return true;
    startIdx = idx + 1;
  }
  return false;
}

const PATH_BOUNDARY_CODES = new Set<number>([
  0x20, // space
  0x09, // tab
  0x0a, // \n
  0x0d, // \r
  0x22, // "
  0x27, // '
  0x60, // `
  0x28, // (
  0x29, // )
  0x5b, // [
  0x5d, // ]
  0x7b, // {
  0x7d, // }
  0x3a, // :
  0x2c, // ,
  0x3b, // ;
  0x2e, // . (e.g., "src/a.ts." end of sentence)
  0x3f, // ?
  0x21, // !
  0x3e, // >
  0x3c, // <
]);

function isPathBoundary(code: number): boolean {
  return code === -1 || PATH_BOUNDARY_CODES.has(code);
}
