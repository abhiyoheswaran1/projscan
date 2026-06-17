import {
  isKnownHandlerCall,
  matchingParameters,
  sourceFromExactMembers,
  sourceFromPrefixedMembers,
} from './frameworkSourceMatching.js';

const FASTIFY_REQUEST_SOURCE_BY_REFERENCE = new Map<string, string>([
  ['body', 'fastify.request.body'],
  ['query', 'fastify.request.query'],
  ['params', 'fastify.request.params'],
  ['headers', 'fastify.request.headers'],
  ['cookies', 'fastify.request.cookies'],
  ['ip', 'fastify.request.ip'],
]);

const FASTIFY_REQUEST_SOURCE_BY_MEMBER = new Map<string, string>([
  ['raw.headers', 'fastify.request.raw.headers'],
  ['raw.url', 'fastify.request.raw.url'],
  ['host', 'fastify.request.host'],
  ['hostname', 'fastify.request.hostname'],
  ['url', 'fastify.request.url'],
  ['originalUrl', 'fastify.request.originalUrl'],
]);

const FASTIFY_REQUEST_PARAM_NAMES = new Set(['req', 'request']);
const FASTIFY_HANDLER_METHODS = new Set([
  'all',
  'delete',
  'get',
  'head',
  'options',
  'patch',
  'post',
  'put',
  'route',
]);

export const FASTIFY_REQUEST_SOURCES = [
  ...FASTIFY_REQUEST_SOURCE_BY_REFERENCE.values(),
  ...FASTIFY_REQUEST_SOURCE_BY_MEMBER.values(),
];

export function fastifyRequestSource(
  parameters: string[],
  references: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
  contextualCallSite: string | undefined,
  imports: Array<{ source: string }>,
): string | null {
  if (!isFastifyFile(imports)) return null;
  if (!isFastifyHandlerCall(contextualCallSite)) return null;
  const requestParams = matchingParameters(parameters, FASTIFY_REQUEST_PARAM_NAMES);
  if (requestParams.length === 0) return null;
  return (
    fastifyMemberReferenceSource(requestParams, memberReferences, enabledSources) ??
    fastifyReferenceSource(references, enabledSources)
  );
}

function fastifyReferenceSource(references: string[], enabledSources: Set<string>): string | null {
  return sourceFromExactMembers(references, FASTIFY_REQUEST_SOURCE_BY_REFERENCE, enabledSources);
}

function fastifyMemberReferenceSource(
  requestParams: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
): string | null {
  return sourceFromPrefixedMembers(
    requestParams.map((parameter) => `${parameter}.`),
    memberReferences,
    FASTIFY_REQUEST_SOURCE_BY_MEMBER,
    enabledSources,
  );
}

function isFastifyFile(imports: Array<{ source: string }>): boolean {
  return imports.some((imp) => imp.source === 'fastify' || imp.source.startsWith('fastify/'));
}

function isFastifyHandlerCall(contextualCallSite: string | undefined): boolean {
  return isKnownHandlerCall(contextualCallSite, FASTIFY_HANDLER_METHODS);
}
