import { isGenericReferenceTarget } from './startIntentTargetText.js';

export function extractQuotedTextTarget(intent: string): string | undefined {
  const quoted = intent.match(/(["'`])(.{2,200}?)\1/);
  const target = quoted?.[2]?.trim();
  return target && !isGenericReferenceTarget(target) ? target : undefined;
}
