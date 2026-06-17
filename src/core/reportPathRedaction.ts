export type PathRedactor = (filePath: string) => string;

export function normalizeReportPath(value: string): string | null {
  let normalized = value.trim().replace(/\\/g, '/');
  normalized = normalized.replace(/\/+/g, '/');
  normalized = normalized.replace(/^\.\//, '');
  normalized = normalized.replace(/\/$/, '');
  if (!normalized || normalized === '.') return null;
  return normalized;
}

export function createPathRedactor(): PathRedactor {
  const seen = new Map<string, string>();
  return (filePath: string): string => {
    const normalized = normalizeReportPath(filePath) ?? filePath;
    const existing = seen.get(normalized);
    if (existing) return existing;
    const next = `redacted-path-${seen.size + 1}`;
    seen.set(normalized, next);
    return next;
  };
}

export function redactText(
  text: string,
  replacements: ReadonlyArray<readonly [string, string]>,
  redactor: PathRedactor | null,
): string {
  let out = text;
  const ordered = [...replacements].sort((a, b) => b[0].length - a[0].length);
  for (const [filePath, label] of ordered) {
    out = out.replace(pathReferenceRegExp(filePath), label);
  }
  if (redactor) out = redactUnmappedPathTokens(out, redactor);
  return out;
}

const TEXT_PATH_TOKEN_PATTERN =
  /(?:[A-Za-z]:[\\/]|\/|\.{1,2}[\\/])?(?:[A-Za-z0-9._@-]+[\\/])+[A-Za-z0-9._@-]+\.(?:ts|tsx|js|jsx|mjs|cjs|mts|cts|py|go|java|rb|rs|php|cs|json|ya?ml|toml|md)(?=$|[\s'"()[\]{}<>.,;:!?#])/gi;

function redactUnmappedPathTokens(text: string, redactor: PathRedactor): string {
  return text.replace(TEXT_PATH_TOKEN_PATTERN, (match, ...args) => {
    const offset = args[args.length - 2] as number;
    if (isHttpUrlPathToken(text, offset)) return match;
    return redactor(match);
  });
}

function isHttpUrlPathToken(text: string, offset: number): boolean {
  const tokenStart = previousTokenStart(text, offset);
  const prefix = text.slice(tokenStart, Math.min(text.length, offset + 2)).toLowerCase();
  return prefix.startsWith('http://') || prefix.startsWith('https://');
}

function previousTokenStart(text: string, offset: number): number {
  let index = offset;
  while (index > 0 && !isPathTokenBoundary(text[index - 1])) index -= 1;
  return index;
}

function isPathTokenBoundary(char: string | undefined): boolean {
  return char === undefined || /[\s'"()[\]{}<>]/.test(char);
}

function pathReferenceRegExp(filePath: string): RegExp {
  const normalized = filePath.replace(/\\/g, '/');
  const pathPattern = normalized.split('/').map(escapeRegExp).join(String.raw`[\\/]`);
  const tokenEnd = String.raw`(?=$|[\s'"()[\]{}<>.,;:!?#])`;
  return new RegExp(String.raw`(?:\S+[\\/])*` + pathPattern + tokenEnd, 'g');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
