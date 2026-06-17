import {
  isKnownHandlerCall,
  matchingParameters,
  sourceFromPrefixedMembers,
} from './frameworkSourceMatching.js';

const HONO_REQUEST_SOURCE_BY_MEMBER_CALL = new Map<string, string>([
  ['json', 'hono.req.json'],
  ['parseBody', 'hono.req.parseBody'],
  ['text', 'hono.req.text'],
  ['arrayBuffer', 'hono.req.arrayBuffer'],
  ['blob', 'hono.req.blob'],
  ['formData', 'hono.req.formData'],
  ['query', 'hono.req.query'],
  ['queries', 'hono.req.queries'],
  ['param', 'hono.req.param'],
  ['header', 'hono.req.header'],
  ['raw.headers.get', 'hono.req.raw.headers'],
  ['valid', 'hono.req.valid'],
]);

const HONO_REQUEST_SOURCE_BY_MEMBER_REFERENCE = new Map<string, string>([
  ['url', 'hono.req.url'],
  ['path', 'hono.req.path'],
  ['raw.url', 'hono.req.raw.url'],
  ['raw.headers', 'hono.req.raw.headers'],
]);

const HONO_CONTEXT_PARAM_NAMES = new Set(['c', 'ctx', 'context']);
const HONO_HANDLER_METHODS = new Set([
  'all',
  'delete',
  'get',
  'head',
  'options',
  'patch',
  'post',
  'put',
  'use',
]);

export const HONO_REQUEST_SOURCES = [
  ...HONO_REQUEST_SOURCE_BY_MEMBER_CALL.values(),
  ...HONO_REQUEST_SOURCE_BY_MEMBER_REFERENCE.values(),
];

export function honoRequestSource(
  parameters: string[],
  memberCallSites: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
  contextualCallSite: string | undefined,
  imports: Array<{ source: string }>,
): string | null {
  if (!isHonoFile(imports)) return null;
  if (!isHonoHandlerCall(contextualCallSite)) return null;
  const contextParams = matchingParameters(parameters, HONO_CONTEXT_PARAM_NAMES);
  if (contextParams.length === 0) return null;
  return (
    honoMemberCallSource(contextParams, memberCallSites, enabledSources) ??
    honoMemberReferenceSource(contextParams, memberReferences, enabledSources)
  );
}

function honoMemberCallSource(
  contextParams: string[],
  memberCallSites: string[],
  enabledSources: Set<string>,
): string | null {
  return sourceFromPrefixedMembers(
    contextParams.map((parameter) => `${parameter}.req.`),
    memberCallSites,
    HONO_REQUEST_SOURCE_BY_MEMBER_CALL,
    enabledSources,
  );
}

function honoMemberReferenceSource(
  contextParams: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
): string | null {
  return sourceFromPrefixedMembers(
    contextParams.map((parameter) => `${parameter}.req.`),
    memberReferences,
    HONO_REQUEST_SOURCE_BY_MEMBER_REFERENCE,
    enabledSources,
  );
}

function isHonoFile(imports: Array<{ source: string }>): boolean {
  return imports.some((imp) => imp.source === 'hono' || imp.source.startsWith('hono/'));
}

function isHonoHandlerCall(contextualCallSite: string | undefined): boolean {
  return isKnownHandlerCall(contextualCallSite, HONO_HANDLER_METHODS);
}
