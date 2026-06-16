export function isTestLikePath(file: string): boolean {
  const normalized = normalizePath(file);
  return (
    normalized.startsWith('test/') ||
    normalized.startsWith('tests/') ||
    normalized.includes('/test/') ||
    normalized.includes('/tests/') ||
    normalized.includes('/__tests__/') ||
    /\.(test|spec)\.[^/]+$/.test(normalized)
  );
}

export function isGeneratedLikePath(file: string): boolean {
  const normalized = normalizePath(file);
  const segments = normalized.split('/');
  return (
    segments.some(
      (segment) =>
        segment === 'generated' ||
        segment === '__generated__' ||
        segment === 'codegen' ||
        segment === '.generated',
    ) ||
    /(?:^|[._-])generated\.[^/]+$/.test(normalized) ||
    /(?:^|[._-])gen\.[^/]+$/.test(normalized)
  );
}

function normalizePath(file: string): string {
  return file.replace(/\\/g, '/');
}
