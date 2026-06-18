import { isGenericReferenceTarget, unwrapTarget } from './startIntentTargetText.js';

export function extractImpactTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  const usageMatch = compactIntent.match(
    /\bwhere\s+(?:is|are)\s+[`'"]?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)[`'"]?\s+(?:used|referenced|called)\b/i,
  );
  if (usageMatch?.[1] && !isGenericReferenceTarget(usageMatch[1])) return usageMatch[1];

  const match = compactIntent.match(
    /\b(?:rename|change|modify|delete|remove)\s+(?:the\s+|a\s+|an\s+)?(.+)$/i,
  );
  const target = unwrapTarget((match?.[1] ?? '').trim());
  if (target.length === 0) return undefined;
  const normalized = target
    .replace(/\s+(?:in|from|inside)\s+(?:this\s+)?(?:repo|repository|codebase)$/i, '')
    .trim();
  if (isGenericReferenceTarget(normalized)) return undefined;
  return normalized;
}
