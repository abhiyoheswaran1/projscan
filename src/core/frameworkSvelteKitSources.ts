import { sourceFromPrefixedMembers } from './frameworkSourceMatching.js';

const SVELTEKIT_REQUEST_SOURCE_BY_MEMBER_CALL = new Map<string, string>([
  ['json', 'sveltekit.request.json'],
  ['formData', 'sveltekit.request.formData'],
  ['text', 'sveltekit.request.text'],
  ['arrayBuffer', 'sveltekit.request.arrayBuffer'],
  ['headers.get', 'sveltekit.request.headers'],
]);

const SVELTEKIT_REQUEST_SOURCE_BY_MEMBER_REFERENCE = new Map<string, string>([
  ['url', 'sveltekit.request.url'],
  ['headers', 'sveltekit.request.headers'],
]);

const SVELTEKIT_URL_SOURCE_BY_MEMBER_CALL = new Map<string, string>([
  ['searchParams.get', 'sveltekit.url.searchParams'],
]);

const SVELTEKIT_URL_SOURCE_BY_MEMBER_REFERENCE = new Map<string, string>([
  ['searchParams', 'sveltekit.url.searchParams'],
  ['pathname', 'sveltekit.url.pathname'],
]);

const SVELTEKIT_COOKIES_SOURCE_BY_MEMBER_CALL = new Map<string, string>([
  ['get', 'sveltekit.cookies.get'],
  ['getAll', 'sveltekit.cookies.getAll'],
]);

const SVELTEKIT_ROUTE_HANDLERS = new Set([
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT',
]);
const SVELTEKIT_EVENT_PARAM_NAMES = new Set(['event', 'requestEvent']);

export const SVELTEKIT_REQUEST_SOURCES = [
  ...SVELTEKIT_REQUEST_SOURCE_BY_MEMBER_CALL.values(),
  ...SVELTEKIT_REQUEST_SOURCE_BY_MEMBER_REFERENCE.values(),
  ...SVELTEKIT_URL_SOURCE_BY_MEMBER_CALL.values(),
  ...SVELTEKIT_URL_SOURCE_BY_MEMBER_REFERENCE.values(),
  ...SVELTEKIT_COOKIES_SOURCE_BY_MEMBER_CALL.values(),
  'sveltekit.params',
];

export function svelteKitRequestSource(
  file: string,
  functionName: string,
  parameters: string[],
  memberCallSites: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
): string | null {
  if (!isSvelteKitRequestFunction(file, functionName)) return null;
  const eventParams = parameters.filter((parameter) => SVELTEKIT_EVENT_PARAM_NAMES.has(parameter));

  return (
    svelteKitRequestReaderSource(parameters, eventParams, memberCallSites, memberReferences, enabledSources) ??
    svelteKitParamsSource(parameters, eventParams, memberReferences, enabledSources) ??
    svelteKitUrlSource(parameters, eventParams, memberCallSites, memberReferences, enabledSources) ??
    svelteKitCookiesSource(parameters, eventParams, memberCallSites, enabledSources)
  );
}

function svelteKitRequestReaderSource(
  parameters: string[],
  eventParams: string[],
  memberCallSites: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
): string | null {
  const prefixes = [
    ...directPrefixes(parameters, 'request'),
    ...eventParams.map((parameter) => `${parameter}.request.`),
  ];
  return (
    sourceFromPrefixedMembers(prefixes, memberCallSites, SVELTEKIT_REQUEST_SOURCE_BY_MEMBER_CALL, enabledSources) ??
    sourceFromPrefixedMembers(
      prefixes,
      memberReferences,
      SVELTEKIT_REQUEST_SOURCE_BY_MEMBER_REFERENCE,
      enabledSources,
    )
  );
}

function svelteKitParamsSource(
  parameters: string[],
  eventParams: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
): string | null {
  if (!enabledSources.has('sveltekit.params')) return null;
  const prefixes = [
    ...directPrefixes(parameters, 'params'),
    ...eventParams.map((parameter) => `${parameter}.params.`),
  ];
  return memberReferences.some((reference) =>
    prefixes.some((prefix) => reference.startsWith(prefix)),
  )
    ? 'sveltekit.params'
    : null;
}

function svelteKitUrlSource(
  parameters: string[],
  eventParams: string[],
  memberCallSites: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
): string | null {
  const prefixes = [
    ...directPrefixes(parameters, 'url'),
    ...eventParams.map((parameter) => `${parameter}.url.`),
  ];
  return (
    sourceFromPrefixedMembers(prefixes, memberCallSites, SVELTEKIT_URL_SOURCE_BY_MEMBER_CALL, enabledSources) ??
    sourceFromPrefixedMembers(
      prefixes,
      memberReferences,
      SVELTEKIT_URL_SOURCE_BY_MEMBER_REFERENCE,
      enabledSources,
    )
  );
}

function svelteKitCookiesSource(
  parameters: string[],
  eventParams: string[],
  memberCallSites: string[],
  enabledSources: Set<string>,
): string | null {
  const prefixes = [
    ...directPrefixes(parameters, 'cookies'),
    ...eventParams.map((parameter) => `${parameter}.cookies.`),
  ];
  return sourceFromPrefixedMembers(
    prefixes,
    memberCallSites,
    SVELTEKIT_COOKIES_SOURCE_BY_MEMBER_CALL,
    enabledSources,
  );
}

function directPrefixes(parameters: string[], parameterName: string): string[] {
  return parameters.includes(parameterName) ? [`${parameterName}.`] : [];
}

function isSvelteKitRequestFunction(file: string, functionName: string): boolean {
  return (
    isSvelteKitServerHandler(file, functionName) ||
    isSvelteKitServerLoad(file, functionName) ||
    isSvelteKitHook(file, functionName)
  );
}

function isSvelteKitServerHandler(file: string, functionName: string): boolean {
  return SVELTEKIT_ROUTE_HANDLERS.has(bareName(functionName)) && isSvelteKitServerFile(file);
}

function isSvelteKitServerLoad(file: string, functionName: string): boolean {
  return bareName(functionName) === 'load' && isSvelteKitServerLoadFile(file);
}

function isSvelteKitHook(file: string, functionName: string): boolean {
  return bareName(functionName) === 'handle' && isSvelteKitHooksFile(file);
}

function isSvelteKitServerFile(file: string): boolean {
  return /(?:^|\/)(?:src\/)?routes\/(?:.*\/)?\+server\.(?:cjs|mjs|js|ts)$/.test(
    normalizePath(file),
  );
}

function isSvelteKitServerLoadFile(file: string): boolean {
  return /(?:^|\/)(?:src\/)?routes\/(?:.*\/)?\+(?:layout|page)\.server\.(?:cjs|mjs|js|ts)$/.test(
    normalizePath(file),
  );
}

function isSvelteKitHooksFile(file: string): boolean {
  return /(?:^|\/)(?:src\/)?hooks\.server\.(?:cjs|mjs|js|ts)$/.test(normalizePath(file));
}

function normalizePath(file: string): string {
  return file.replace(/\\/g, '/');
}

function bareName(qualified: string): string {
  const dot = qualified.lastIndexOf('.');
  return dot < 0 ? qualified : qualified.slice(dot + 1);
}
