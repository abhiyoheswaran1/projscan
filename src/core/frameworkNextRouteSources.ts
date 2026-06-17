const NEXT_ROUTE_SOURCE_BY_CALLEE = new Map<string, string>([
  ['json', 'request.json'],
  ['formData', 'request.formData'],
  ['text', 'request.text'],
  ['arrayBuffer', 'request.arrayBuffer'],
  ['headers.get', 'request.headers'],
  ['cookies.get', 'request.cookies'],
  ['cookies.getAll', 'request.cookies'],
]);

const NEXT_ROUTE_SOURCE_BY_REFERENCE = new Map<string, string>([
  ['url', 'request.url'],
  ['headers', 'request.headers'],
  ['cookies', 'request.cookies'],
  ['nextUrl.pathname', 'request.nextUrl.pathname'],
  ['nextUrl.searchParams', 'request.nextUrl.searchParams'],
]);

const NEXT_HEADERS_HELPER_SOURCE = 'next.headers';
const NEXT_ROUTE_HANDLERS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

export const NEXT_ROUTE_REQUEST_SOURCES = [
  ...NEXT_ROUTE_SOURCE_BY_CALLEE.values(),
  ...NEXT_ROUTE_SOURCE_BY_REFERENCE.values(),
  NEXT_HEADERS_HELPER_SOURCE,
];

export function nextRouteRequestSource(
  file: string,
  functionName: string,
  memberCallSites: string[],
  memberReferences: string[],
  parameters: string[],
  enabledSources: Set<string>,
  imports: Array<{ source: string; specifiers?: string[]; kind?: string; typeOnly?: boolean }> = [],
  directCallSites: string[] = [],
): string | null {
  return (
    nextHeadersHelperSource(directCallSites, imports, enabledSources) ??
    nextRouteParameterSource(
      file,
      functionName,
      memberCallSites,
      memberReferences,
      parameters,
      enabledSources,
    )
  );
}

function nextRouteParameterSource(
  file: string,
  functionName: string,
  memberCallSites: string[],
  memberReferences: string[],
  parameters: string[],
  enabledSources: Set<string>,
): string | null {
  if (!isNextRouteHandler(file, functionName)) return null;
  if (parameters.length === 0 || (memberCallSites.length === 0 && memberReferences.length === 0)) {
    return null;
  }

  return (
    nextRouteCallSource(parameters, memberCallSites, enabledSources) ??
    nextRouteReferenceSource(parameters, memberReferences, enabledSources)
  );
}

function nextHeadersHelperSource(
  directCallSites: string[],
  imports: Array<{ source: string; specifiers?: string[]; kind?: string; typeOnly?: boolean }>,
  enabledSources: Set<string>,
): string | null {
  if (!enabledSources.has(NEXT_HEADERS_HELPER_SOURCE)) return null;
  if (!directCallSites.includes('headers')) return null;
  if (!hasNextHeadersImport(imports)) return null;
  return NEXT_HEADERS_HELPER_SOURCE;
}

function hasNextHeadersImport(
  imports: Array<{ source: string; specifiers?: string[]; kind?: string; typeOnly?: boolean }>,
): boolean {
  return imports.some(
    (imp) =>
      imp.source === 'next/headers' &&
      imp.kind === 'static' &&
      imp.typeOnly !== true &&
      (imp.specifiers ?? []).includes('headers'),
  );
}

function nextRouteCallSource(
  parameters: string[],
  memberCallSites: string[],
  enabledSources: Set<string>,
): string | null {
  const calls = new Set(memberCallSites);
  for (const parameter of parameters) {
    for (const [callee, source] of NEXT_ROUTE_SOURCE_BY_CALLEE) {
      if (enabledSources.has(source) && calls.has(parameter + '.' + callee)) return source;
    }
  }
  return null;
}

function nextRouteReferenceSource(
  parameters: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
): string | null {
  const references = new Set(memberReferences);
  for (const parameter of parameters) {
    for (const [reference, source] of NEXT_ROUTE_SOURCE_BY_REFERENCE) {
      if (enabledSources.has(source) && references.has(parameter + '.' + reference)) return source;
    }
  }
  return null;
}

function isNextRouteHandler(file: string, functionName: string): boolean {
  if (!NEXT_ROUTE_HANDLERS.has(bareName(functionName))) return false;
  const normalized = file.replace(/\\/g, '/');
  return /(?:^|\/)(?:app|src\/app)\/.*\/route\.(?:cjs|mjs|js|jsx|ts|tsx)$/.test(normalized);
}

function bareName(qualified: string): string {
  const dot = qualified.lastIndexOf('.');
  return dot < 0 ? qualified : qualified.slice(dot + 1);
}
