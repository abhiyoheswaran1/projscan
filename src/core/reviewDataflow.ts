export function isReviewBlockingDataflowRisk(risk: { source: string; sink: string; files: string[] }): boolean {
  if (risk.files.some(isTestLikePath)) return false;
  if (BROAD_FILE_IO_REVIEW_SOURCES.has(risk.source)) return false;
  if (BROAD_FILE_IO_REVIEW_SINKS.has(risk.sink)) return false;
  return true;
}

const BROAD_FILE_IO_REVIEW_SOURCES = new Set(['readFile', 'readFileSync']);
const BROAD_FILE_IO_REVIEW_SINKS = new Set(['writeFile', 'writeFileSync', 'unlink', 'rm', 'rmSync']);

export function isTestLikePath(file: string): boolean {
  const normalized = file.replace(/\\/g, '/');
  return (
    normalized.startsWith('test/') ||
    normalized.startsWith('tests/') ||
    normalized.includes('/test/') ||
    normalized.includes('/tests/') ||
    normalized.includes('/__tests__/') ||
    /\.(test|spec)\.[^/]+$/.test(normalized)
  );
}
