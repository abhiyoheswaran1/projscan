const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'not',
  'of',
  'to',
  'in',
  'is',
  'it',
  'for',
  'on',
  'with',
  'this',
  'that',
  'by',
  'as',
  'at',
  'be',
  'are',
  'was',
  'were',
  'has',
  'have',
  'had',
]);

const TS_KEYWORDS = new Set([
  'const',
  'let',
  'var',
  'function',
  'return',
  'if',
  'else',
  'while',
  'for',
  'do',
  'break',
  'continue',
  'switch',
  'case',
  'default',
  'new',
  'class',
  'extends',
  'implements',
  'interface',
  'type',
  'enum',
  'public',
  'private',
  'protected',
  'static',
  'readonly',
  'async',
  'await',
  'try',
  'catch',
  'finally',
  'throw',
  'import',
  'export',
  'from',
  'as',
  'typeof',
  'instanceof',
  'void',
  'null',
  'undefined',
  'true',
  'false',
  'this',
  'super',
  'yield',
  'delete',
  'in',
  'of',
  'any',
  'never',
  'unknown',
  'string',
  'number',
  'boolean',
  'object',
  'symbol',
  'bigint',
]);

const PY_KEYWORDS = new Set([
  'def',
  'class',
  'self',
  'cls',
  'lambda',
  'yield',
  'pass',
  'elif',
  'none',
  'true',
  'false',
  'and',
  'or',
  'not',
  'is',
  'in',
  'import',
  'from',
  'as',
  'with',
  'try',
  'except',
  'finally',
  'raise',
  'assert',
  'global',
  'nonlocal',
  'del',
  'async',
  'await',
  'return',
  'if',
  'else',
  'for',
  'while',
  'break',
  'continue',
]);

/**
 * Tokenize a string for indexing/querying:
 *   - lowercase
 *   - split on non-identifier chars
 *   - split camelCase and snake_case
 *   - drop tokens shorter than 2 chars, stopwords, TS keywords
 *   - apply basic stem (drop trailing s / ing / ed)
 */
export function tokenize(input: string): string[] {
  const out: string[] = [];
  // Split on non-identifier boundaries. Keep original case so we can also
  // split on camelCase boundaries below.
  const rawTokens = input.match(/[A-Za-z0-9_]+/g) ?? [];
  for (const raw of rawTokens) {
    // Split on underscore and camelCase. camelCase: insert a boundary before
    // each uppercase that follows a lowercase or digit (OR before runs of
    // uppercase followed by lowercase to handle acronyms like "XMLParser").
    const camelSplit = raw
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    const parts = camelSplit.split(/[_\s]+/).filter(Boolean);
    for (const part of parts) {
      // Split embedded digits from letters - e.g. "v1api" -> "v", "1", "api"
      const subparts = part.split(/(\d+)/).filter(Boolean);
      for (const sp of subparts) {
        const lower = sp.toLowerCase();
        const stemmed = stem(lower);
        if (!keepToken(stemmed)) continue;
        out.push(stemmed);
      }
    }
  }
  return out;
}

/**
 * Expand a user query into a set of candidate tokens. Same rules as tokenize
 * plus: if the raw query has no hits, try progressively looser tokenization.
 */
export function expandQuery(query: string): string[] {
  const tokens = tokenize(query);
  return [...new Set(tokens)];
}

export function countHits(tokens: string[], query: string[]): number {
  let count = 0;
  const set = new Set(tokens);
  for (const q of query) if (set.has(q)) count++;
  return count;
}

function stem(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith('ing')) return token.slice(0, -3);
  if (token.endsWith('ed') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('es') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function keepToken(token: string): boolean {
  if (token.length < 2) return false;
  if (STOPWORDS.has(token)) return false;
  if (TS_KEYWORDS.has(token)) return false;
  if (PY_KEYWORDS.has(token)) return false;
  return true;
}
