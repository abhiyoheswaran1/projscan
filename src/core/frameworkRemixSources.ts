const REMIX_REQUEST_SOURCE_BY_CALLEE = new Map<string, string>([
  ['json', 'remix.request.json'],
  ['formData', 'remix.request.formData'],
  ['text', 'remix.request.text'],
  ['arrayBuffer', 'remix.request.arrayBuffer'],
  ['headers.get', 'remix.request.headers'],
]);

const REMIX_REQUEST_SOURCE_BY_REFERENCE = new Map<string, string>([
  ['url', 'remix.request.url'],
  ['headers', 'remix.request.headers'],
  ['signal', 'remix.request.signal'],
]);

const REMIX_ROUTE_FUNCTIONS = new Set(['action', 'loader', 'clientAction', 'clientLoader']);

export const REMIX_REQUEST_SOURCES = [
  ...REMIX_REQUEST_SOURCE_BY_CALLEE.values(),
  ...REMIX_REQUEST_SOURCE_BY_REFERENCE.values(),
  'remix.params',
];

export function remixRequestSource(
  file: string,
  functionName: string,
  parameters: string[],
  memberCallSites: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
): string | null {
  if (!isRemixRouteHandler(file, functionName)) return null;
  return (
    remixRequestCallSource(parameters, memberCallSites, enabledSources) ??
    remixRequestReferenceSource(parameters, memberReferences, enabledSources) ??
    remixParamsSource(parameters, memberReferences, enabledSources)
  );
}

function remixRequestCallSource(
  parameters: string[],
  memberCallSites: string[],
  enabledSources: Set<string>,
): string | null {
  if (!parameters.includes('request')) return null;
  const calls = new Set(memberCallSites);
  for (const [member, source] of REMIX_REQUEST_SOURCE_BY_CALLEE) {
    if (enabledSources.has(source) && calls.has(`request.${member}`)) return source;
  }
  return null;
}

function remixRequestReferenceSource(
  parameters: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
): string | null {
  if (!parameters.includes('request')) return null;
  const references = new Set(memberReferences);
  for (const [member, source] of REMIX_REQUEST_SOURCE_BY_REFERENCE) {
    if (enabledSources.has(source) && references.has(`request.${member}`)) return source;
  }
  return null;
}

function remixParamsSource(
  parameters: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
): string | null {
  if (!enabledSources.has('remix.params') || !parameters.includes('params')) return null;
  return memberReferences.some((reference) => reference.startsWith('params.'))
    ? 'remix.params'
    : null;
}

function isRemixRouteHandler(file: string, functionName: string): boolean {
  if (!REMIX_ROUTE_FUNCTIONS.has(bareName(functionName))) return false;
  const normalized = file.replace(/\\/g, '/');
  return /(?:^|\/)app\/routes\/.+\.(?:cjs|mjs|js|jsx|ts|tsx)$/.test(normalized);
}

function bareName(qualified: string): string {
  const dot = qualified.lastIndexOf('.');
  return dot < 0 ? qualified : qualified.slice(dot + 1);
}
