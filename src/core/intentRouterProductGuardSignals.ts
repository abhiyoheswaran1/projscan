const REPORT_CONTROL_CONTEXT_KEYWORDS = keywordList(
  'redact redacted redaction scoped scope partner vendor external artifact artifacts export exports paths report reports',
);
const PROVE_CONTEXT_KEYWORDS = keywordList(
  'allowed permission permissions proof contract contracts scope scoped forbidden receipt receipts replay ledger stale fresh bounded',
);

function keywordList(words: string): readonly string[] {
  return words.split(' ');
}

export function reportControlContextMatches(tokens: Set<string>): boolean {
  return REPORT_CONTROL_CONTEXT_KEYWORDS.some((token) => tokens.has(token));
}

export function feedbackIntakeContextMatches(tokens: Set<string>): boolean {
  if (['feedback', 'intake', 'raw', 'pasted', 'paste'].some((token) => tokens.has(token)))
    return true;
  if (tokens.has('false') && tokens.has('positive')) return true;
  if (tokens.has('alias') && tokens.has('import')) return true;
  if (tokens.has('allow') && (tokens.has('script') || tokens.has('scripts'))) return true;
  if (tokens.has('tree') && tokens.has('sitter')) return true;
  if (tokens.has('node') && tokens.has('gyp')) return true;
  if (
    ['noisy', 'noise', 'background'].some((token) => tokens.has(token)) &&
    tokens.has('caution')
  )
    return true;
  if (
    ['doc', 'docs', 'output', 'outputs', 'wording'].some((token) => tokens.has(token)) &&
    [
      'confusing',
      'bigger',
      'demonstrated',
      'workflow',
      'workflows',
      'overclaim',
      'overclaims',
      'sound',
      'sounds',
    ].some((token) => tokens.has(token))
  )
    return true;
  if (
    (tokens.has('breadth') ||
      (['feature', 'features'].some((token) => tokens.has(token)) &&
        ['workflow', 'workflows'].some((token) => tokens.has(token))) ||
      (tokens.has('killer') && ['workflow', 'workflows'].some((token) => tokens.has(token)))) &&
    ['trust', 'daily', 'engineer', 'engineers', 'without', 'few'].some((token) =>
      tokens.has(token),
    )
  )
    return true;
  if (tokens.has('missing') && tokens.has('signal')) return true;
  if (
    ['wrong', 'incorrect', 'incorrectly', 'flagged'].some((token) => tokens.has(token)) &&
    ['rule', 'rules', 'unused', 'exports', 'route', 'router'].some((token) => tokens.has(token))
  )
    return true;
  return false;
}

export function proveContextMatches(tokens: Set<string>): boolean {
  if (tokens.has('claim')) return false;
  if (PROVE_CONTEXT_KEYWORDS.some((token) => tokens.has(token))) return true;
  return (
    tokens.has('agent') &&
    (tokens.has('change') || tokens.has('changed') || tokens.has('edit') || tokens.has('edits'))
  );
}
