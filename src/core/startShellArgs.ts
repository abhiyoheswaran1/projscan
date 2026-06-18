export function isPlaceholder(value: string): boolean {
  return /^<[^<>]+>$/.test(value);
}

export function escapeDoubleQuoted(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`');
}

export function quoteShellArg(value: string): string {
  return /^[A-Za-z0-9_./:@-]+$/.test(value) ? value : `"${escapeDoubleQuoted(value)}"`;
}

export function quoteShellArgOrPlaceholder(value: string): string {
  if (isPlaceholder(value)) return value;
  return quoteShellArg(value);
}
