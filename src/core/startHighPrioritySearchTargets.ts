import { extractEnvVarTarget } from './startEnvTargets.js';
import { extractFileTarget } from './startFileTargets.js';
import { unwrapTarget } from './startIntentTargetText.js';
import { extractQuotedTextTarget } from './startQuotedTextTargets.js';

export function searchQueryFromHighPrioritySignals(trimmed: string): string | undefined {
  const file = extractFileTarget(trimmed);
  if (file && /\b(?:where|find|locate|search)\b/i.test(trimmed) && /\btests?\b/i.test(trimmed)) {
    return `tests for ${file}`;
  }
  const envVar = extractEnvVarTarget(trimmed);
  if (envVar && /\b(?:where|find|locate|search|lookup|used|referenced|process)\b/i.test(trimmed)) {
    return envVar;
  }
  const envControl = trimmed.match(
    /\b(?:which|what|where|find|locate|search(?:\s+for)?|lookup)\s+(?:env(?:ironment)?\s+)?(?:var|vars|variable|variables)\s+(?:controls?|configures?|sets?|for)\s+(.+?)\s*[?!.]*$/i,
  );
  if (envControl?.[1]) return `${unwrapTarget(envControl[1].trim())} env var`;
  const quotedDebugText = extractQuotedTextTarget(trimmed);
  if (
    quotedDebugText &&
    /\b(?:error|errors|message|messages|throws?|thrown|logs?|logged|logging)\b/i.test(trimmed)
  ) {
    return quotedDebugText;
  }
  return undefined;
}
