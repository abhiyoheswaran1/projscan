type QueryExtractor = (intent: string) => string | undefined;

export function extractIntegrationQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  return firstQuery(compactIntent, [
    serviceCallIntegrationQuery,
    emailProviderIntegrationQuery,
    storageUploadIntegrationQuery,
    serviceClientIntegrationQuery,
    graphQlIntegrationQuery,
    websocketIntegrationQuery,
  ]);
}

function firstQuery(intent: string, extractors: readonly QueryExtractor[]): string | undefined {
  for (const extract of extractors) {
    const query = extract(intent);
    if (query) return query;
  }
  return undefined;
}

function serviceCallIntegrationQuery(compactIntent: string): string | undefined {
  const serviceCall = compactIntent.match(/\bwhere\s+(?:do|does)\s+(?:we\s+)?calls?\s+(.+?)$/i);
  if (serviceCall?.[1]) {
    const service = canonicalIntegrationTarget(serviceCall[1]);
    if (service) return `${service} API`;
  }
  return undefined;
}

function emailProviderIntegrationQuery(compactIntent: string): string | undefined {
  const emailProvider = compactIntent.match(
    /\b(?:which|what)\s+(?:code\s+)?sends?\s+email\s+(?:through|via|with|using)\s+(.+?)$/i,
  );
  if (emailProvider?.[1]) {
    const service = canonicalIntegrationTarget(emailProvider[1]);
    if (service) return `${service} email`;
  }
  return undefined;
}

function storageUploadIntegrationQuery(compactIntent: string): string | undefined {
  const storageUpload = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(.+?\bs3\b.*?)\s+(?:upload|uploads|uploaded|implemented|handled|configured)\b/i,
  );
  if (storageUpload?.[1] && /\bs3\b/i.test(storageUpload[1])) return 'S3 upload';
  return undefined;
}

function serviceClientIntegrationQuery(compactIntent: string): string | undefined {
  const serviceClient = compactIntent.match(
    /\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:is|are))\s+(?:the\s+)?(.+?\b(?:api\s+client|client|sdk)\b)$/i,
  );
  if (serviceClient?.[1] && isIntegrationTarget(serviceClient[1]))
    return normalizeIntegrationPhrase(serviceClient[1]);
  return undefined;
}

function graphQlIntegrationQuery(compactIntent: string): string | undefined {
  const graphQuery = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?graphql\s+quer(?:y|ies)\s+(?:for|of)\s+(.+?)$/i,
  );
  if (graphQuery?.[1]) return `${unwrapTarget(graphQuery[1].trim())} GraphQL query`;
  return undefined;
}

function websocketIntegrationQuery(compactIntent: string): string | undefined {
  if (
    /\bwebsockets?\s+connections?\b/i.test(compactIntent) ||
    /\bwebsockets?\s+connection\s+opened\b/i.test(compactIntent)
  )
    return 'websocket connection';
  return undefined;
}

function canonicalIntegrationTarget(value: string): string | undefined {
  const target = unwrapTarget(value.trim()).replace(/^the\s+/i, '');
  if (!isIntegrationTarget(target)) return undefined;
  const lower = target.toLowerCase();
  if (lower === 'stripe') return 'Stripe';
  if (lower === 'sendgrid') return 'SendGrid';
  if (lower === 's3' || lower === 'aws s3') return 'S3';
  if (lower === 'github') return 'GitHub';
  if (lower === 'graphql') return 'GraphQL';
  return target;
}

function normalizeIntegrationPhrase(value: string): string {
  return value
    .trim()
    .replace(/\bgithub\b/gi, 'GitHub')
    .replace(/\bgraphql\b/gi, 'GraphQL')
    .replace(/\bstripe\b/gi, 'Stripe')
    .replace(/\bsendgrid\b/gi, 'SendGrid')
    .replace(/\bs3\b/gi, 'S3');
}

function isIntegrationTarget(value: string): boolean {
  return /\b(?:stripe|sendgrid|s3|aws\s+s3|github|graphql|websocket|websockets?|axios|fetch|rest|http|api\s+client|client|sdk)\b/i.test(
    value,
  );
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
