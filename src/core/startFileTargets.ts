import { unwrapTarget } from './startIntentTargetText.js';

export function extractFileTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const wrapped = compactIntent.match(/[`'"]([^`'"]+\.[A-Za-z0-9]{1,12})[`'"]/);
  if (wrapped?.[1] && isFilePathTarget(wrapped[1])) return wrapped[1];

  const pathMatch = compactIntent.match(/(?:^|\s)([A-Za-z0-9_./:@-]+\.[A-Za-z0-9]{1,12})(?:\s|$)/);
  if (pathMatch?.[1] && isFilePathTarget(pathMatch[1])) return unwrapTarget(pathMatch[1]);

  const slashPathMatch = compactIntent.match(
    /(?:^|\s)([A-Za-z0-9_./:@-]+\/[A-Za-z0-9_./:@-]+)(?:\s|$)/,
  );
  if (slashPathMatch?.[1] && isFilePathTarget(slashPathMatch[1]))
    return unwrapTarget(slashPathMatch[1]);

  return undefined;
}

export function isFilePathTarget(target: string): boolean {
  return (
    (target.includes('/') || target.startsWith('.') || /\.[A-Za-z0-9]{1,12}$/.test(target)) &&
    !/\s/.test(target)
  );
}
