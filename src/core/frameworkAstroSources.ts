import { sourceFromPrefixedMembers } from './frameworkSourceMatching.js';

const ASTRO_REQUEST_SOURCE_BY_MEMBER_CALL = new Map<string, string>([
  ['json', 'astro.request.json'],
  ['formData', 'astro.request.formData'],
  ['text', 'astro.request.text'],
  ['arrayBuffer', 'astro.request.arrayBuffer'],
  ['headers.get', 'astro.request.headers'],
]);

const ASTRO_REQUEST_SOURCE_BY_MEMBER_REFERENCE = new Map<string, string>([
  ['url', 'astro.request.url'],
  ['headers', 'astro.request.headers'],
  ['method', 'astro.request.method'],
]);

const ASTRO_ENDPOINT_HANDLERS = new Set([
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT',
]);
const ASTRO_CONTEXT_PARAM_NAMES = new Set(['context', 'apiContext']);

export const ASTRO_REQUEST_SOURCES = [
  ...ASTRO_REQUEST_SOURCE_BY_MEMBER_CALL.values(),
  ...ASTRO_REQUEST_SOURCE_BY_MEMBER_REFERENCE.values(),
  'astro.params',
];

export function astroRequestSource(
  file: string,
  functionName: string,
  parameters: string[],
  memberCallSites: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
): string | null {
  if (!isAstroEndpointHandler(file, functionName)) return null;
  const contextParams = parameters.filter((parameter) => ASTRO_CONTEXT_PARAM_NAMES.has(parameter));

  return (
    astroRequestReaderSource(parameters, contextParams, memberCallSites, memberReferences, enabledSources) ??
    astroParamsSource(parameters, contextParams, memberReferences, enabledSources)
  );
}

function astroRequestReaderSource(
  parameters: string[],
  contextParams: string[],
  memberCallSites: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
): string | null {
  const prefixes = [
    ...directPrefixes(parameters, 'request'),
    ...contextParams.map((parameter) => `${parameter}.request.`),
  ];
  return (
    sourceFromPrefixedMembers(prefixes, memberCallSites, ASTRO_REQUEST_SOURCE_BY_MEMBER_CALL, enabledSources) ??
    sourceFromPrefixedMembers(
      prefixes,
      memberReferences,
      ASTRO_REQUEST_SOURCE_BY_MEMBER_REFERENCE,
      enabledSources,
    )
  );
}

function astroParamsSource(
  parameters: string[],
  contextParams: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
): string | null {
  if (!enabledSources.has('astro.params')) return null;
  const prefixes = [
    ...directPrefixes(parameters, 'params'),
    ...contextParams.map((parameter) => `${parameter}.params.`),
  ];
  return memberReferences.some((reference) =>
    prefixes.some((prefix) => reference.startsWith(prefix)),
  )
    ? 'astro.params'
    : null;
}

function directPrefixes(parameters: string[], parameterName: string): string[] {
  return parameters.includes(parameterName) ? [`${parameterName}.`] : [];
}

function isAstroEndpointHandler(file: string, functionName: string): boolean {
  return ASTRO_ENDPOINT_HANDLERS.has(bareName(functionName)) && isAstroEndpointFile(file);
}

function isAstroEndpointFile(file: string): boolean {
  return /(?:^|\/)(?:src\/)?pages\/.*\.(?:cjs|mjs|js|ts)$/.test(normalizePath(file));
}

function normalizePath(file: string): string {
  return file.replace(/\\/g, '/');
}

function bareName(qualified: string): string {
  const dot = qualified.lastIndexOf('.');
  return dot < 0 ? qualified : qualified.slice(dot + 1);
}
