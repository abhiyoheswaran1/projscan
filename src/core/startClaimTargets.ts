import { extractFileTarget } from './startFileTargets.js';
import { extractSymbolTarget } from './startSymbolTargets.js';

export function extractClaimTarget(intent: string): string | undefined {
  return extractFileTarget(intent) ?? extractSymbolTarget(intent);
}

export function extractClaimAgent(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const match = compactIntent.match(/\b(?:as|for|agent)\s+([A-Za-z0-9_.:@-]{2,64})\b/i);
  const candidate = match?.[1];
  if (!candidate || /^(?:me|myself|us|team|agent|owner)$/i.test(candidate)) return undefined;
  return candidate;
}
