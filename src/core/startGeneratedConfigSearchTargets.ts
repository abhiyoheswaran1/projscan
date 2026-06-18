import { unwrapTarget } from './startIntentTargetText.js';
import { extractToolingConfigQuery } from './startIntentToolingConfigQueries.js';

export function searchQueryFromGeneratedAndConfig(trimmed: string): string | undefined {
  const generatedLookup = trimmed.match(
    /\b(?:show|find|locate|search(?:\s+for)?|where\s+(?:are|is)|which|what|is)\s+(?:me\s+)?(?:this\s+)?(?:the\s+)?(.+?)\s*[?!.]*$/i,
  );
  if (generatedLookup?.[1] && /\bgenerated\b/i.test(generatedLookup[1])) {
    if (/\bfiles?\b/i.test(generatedLookup[1])) return 'generated files';
    if (/\bcode\b/i.test(generatedLookup[1])) return 'generated code';
  }
  const toolingConfig = extractToolingConfigQuery(trimmed);
  if (toolingConfig) return toolingConfig;
  const configDefinitionLookup = trimmed.match(
    /\bwhich\s+(?:config(?:uration)?\s+files?|files?)\s+(?:defines?|contains|sets?|configures?)\s+(.+?)\s*[?!.]*$/i,
  );
  if (configDefinitionLookup?.[1] && /\bconfig(?:uration)?\b/i.test(trimmed))
    return `${unwrapTarget(configDefinitionLookup[1].trim())} config`;
  const configLookup = trimmed.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup|show)\s+(?:the\s+)?(.+?\bconfig(?:uration)?(?:\s+files?)?)\s*[?!.]*$/i,
  );
  if (configLookup?.[1]) return unwrapTarget(configLookup[1].trim());
  return undefined;
}
