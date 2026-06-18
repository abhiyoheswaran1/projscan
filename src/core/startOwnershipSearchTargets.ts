import { unwrapTarget } from './startIntentTargetText.js';

export function searchQueryFromOwnership(trimmed: string): string | undefined {
  const ownership = trimmed.match(/\b(?:who|which\s+team)\s+owns?\s+(.+?)\s*[?!.]*$/i);
  if (ownership?.[1]) return unwrapTarget(ownership[1].trim());
  const ownershipHelp = trimmed.match(
    /\bwho\s+(?:should\s+i\s+ask|can\s+help|knows|is\s+(?:the\s+)?(?:expert|contact))\s*(?:about|with|for)?\s+(.+?)\s*[?!.]*$/i,
  );
  if (ownershipHelp?.[1]) return unwrapTarget(ownershipHelp[1].trim());
  const expertLookup = trimmed.match(
    /\b(?:find|locate|search(?:\s+for)?|lookup)\s+(?:an?\s+)?(?:expert|experts|contact|contacts)\s+(?:for|on|about|with)\s+(.+?)\s*[?!.]*$/i,
  );
  if (expertLookup?.[1]) return unwrapTarget(expertLookup[1].trim());
  const codeOwners = trimmed.match(
    /\b(?:find|locate|search(?:\s+for)?|lookup)\s+(?:code\s+)?owners?\s+(?:for|of)\s+(.+?)\s*[?!.]*$/i,
  );
  if (codeOwners?.[1]) return unwrapTarget(codeOwners[1].trim());
  return undefined;
}

export function searchQueryFromImplementation(trimmed: string): string | undefined {
  const whereImplemented = trimmed.match(
    /\bwhere\s+(?:is|are|do|does|we)?\s*(.+?)\s+(?:implemented|handled|configured|created|defined|loaded|parsed|documented)\b/i,
  );
  if (whereImplemented?.[1]) return unwrapTarget(whereImplemented[1].trim());
  return undefined;
}
