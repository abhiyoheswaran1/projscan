const DATAFLOW_INHERENT_KEYWORDS = [
  'dataflow',
  'taint',
  'security',
  'injection',
  'source',
  'sink',
  'sinks',
  'vulnerability',
  'sql',
  'xss',
];
const DATAFLOW_PRIVACY_SUBJECT_KEYWORDS = [
  'pii',
  'gdpr',
  'personal',
  'customer',
  'email',
  'emails',
  'password',
  'token',
  'tokens',
  'secret',
  'secrets',
  'data',
];
const DATAFLOW_DIRECT_PRIVACY_KEYWORDS = [
  'pii',
  'gdpr',
  'personal',
  'customer',
  'email',
  'emails',
];
const DATAFLOW_PRIVACY_ACTION_KEYWORDS = [
  'password',
  'token',
  'tokens',
  'leak',
  'leaks',
  'logged',
  'logging',
  'log',
  'logs',
  'store',
  'stores',
  'retention',
  'handled',
  'handles',
  'process',
  'processes',
  'processing',
];
const DATAFLOW_FLOW_CONTEXT_KEYWORDS = [
  'security',
  'secure',
  'vulnerable',
  'vulnerability',
  'secret',
  'secrets',
  'expose',
  'exposes',
  'exposed',
  'sanitize',
  'sanitized',
  'request',
  'data',
  'reach',
  'reaches',
  'exec',
  'auth',
  'bypass',
  'risk',
  'risks',
  'xss',
  'sql',
  'sink',
  'sinks',
  'pii',
  'gdpr',
  'personal',
  'customer',
  'email',
  'emails',
  'password',
  'token',
  'tokens',
  'leak',
  'leaks',
  'logged',
  'logging',
  'store',
  'stores',
  'retention',
  'handled',
  'handles',
  'process',
  'processes',
  'processing',
];
const PRIVACY_SUBJECT_CONTEXT_KEYWORDS = [
  'privacy',
  'trust',
  'boundary',
  'upload',
  'leave',
  'machine',
  'telemetry',
  'network',
  'contact',
  'contacted',
  'projscan',
];
const PRIVACY_READ_TARGET_KEYWORDS = ['env', 'values', 'code', 'source', 'local'];
const PRIVACY_WRITE_KEYWORDS = ['write', 'writes'];
const PRIVACY_PROJSCAN_CONTEXT_KEYWORDS = [
  'read',
  'upload',
  'telemetry',
  'privacy',
  'write',
  'writes',
  'contact',
  'contacted',
];

export function dataflowKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  if (DATAFLOW_INHERENT_KEYWORDS.includes(keyword)) return true;
  if (DATAFLOW_DIRECT_PRIVACY_KEYWORDS.includes(keyword)) return true;
  if (keyword === 'compliance') return dataflowPrivacySubjectMatches(tokens);
  if (DATAFLOW_PRIVACY_ACTION_KEYWORDS.includes(keyword))
    return dataflowPrivacySubjectMatches(tokens) || dataflowPrivacyActionMatches(tokens);
  if (keyword === 'auth') return authDataflowContextMatches(tokens);
  return hasAnyToken(tokens, DATAFLOW_FLOW_CONTEXT_KEYWORDS);
}

export function privacyCheckKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  const privacySubjectContext = hasAnyToken(tokens, PRIVACY_SUBJECT_CONTEXT_KEYWORDS);
  const matcher = privacyKeywordMatchers(privacySubjectContext, tokens).find((entry) =>
    entry.keywords.includes(keyword),
  );
  return matcher ? matcher.matches() : true;
}

export function explicitDataflowContextMatches(tokens: Set<string>): boolean {
  return [
    'dataflow',
    'taint',
    'source',
    'sink',
    'sinks',
    'reach',
    'reaches',
    'request',
    'exec',
    'injection',
    'sql',
    'xss',
    'sanitize',
    'sanitized',
    'security',
    'vulnerability',
    'bypass',
  ].some((token) => tokens.has(token));
}

export function explicitDataflowRiskContextMatches(tokens: Set<string>): boolean {
  return [
    'dataflow',
    'taint',
    'source',
    'sink',
    'sinks',
    'reach',
    'reaches',
    'exec',
    'injection',
    'sql',
    'xss',
    'sanitize',
    'sanitized',
    'security',
    'vulnerability',
    'bypass',
    'secret',
    'secrets',
    'expose',
    'exposes',
    'exposed',
    'pii',
    'gdpr',
    'token',
    'tokens',
    'leak',
    'leaks',
  ].some((token) => tokens.has(token));
}

function dataflowPrivacySubjectMatches(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, DATAFLOW_PRIVACY_SUBJECT_KEYWORDS);
}

function dataflowPrivacyActionMatches(tokens: Set<string>): boolean {
  return hasAnyToken(tokens, DATAFLOW_PRIVACY_ACTION_KEYWORDS);
}

function authDataflowContextMatches(tokens: Set<string>): boolean {
  return (
    tokens.has('bypass') || tokens.has('security') || tokens.has('risk') || tokens.has('risks')
  );
}

function privacyKeywordMatchers(privacySubjectContext: boolean, tokens: Set<string>) {
  return [
    {
      keywords: ['offline'],
      matches: () => privacySubjectContext || tokens.has('mode'),
    },
    {
      keywords: ['read', ...PRIVACY_WRITE_KEYWORDS],
      matches: () => privacySubjectContext,
    },
    {
      keywords: PRIVACY_READ_TARGET_KEYWORDS,
      matches: () => privacySubjectContext || (tokens.has('read') && tokens.has('projscan')),
    },
    {
      keywords: ['check'],
      matches: () => privacyCheckContextMatches(tokens),
    },
    {
      keywords: ['projscan'],
      matches: () => hasAnyToken(tokens, PRIVACY_PROJSCAN_CONTEXT_KEYWORDS),
    },
  ];
}

function privacyCheckContextMatches(tokens: Set<string>): boolean {
  return tokens.has('privacy') || tokens.has('trust') || tokens.has('boundary');
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((token) => tokens.has(token));
}
