import {
  isKnownHandlerCall,
  matchingParameters,
  sourceFromExactMembers,
  sourceFromPrefixedMembers,
} from './frameworkSourceMatching.js';

const EXPRESS_REQUEST_SOURCE_BY_REFERENCE = new Map<string, string>([
  ['body', 'express.req.body'],
  ['query', 'express.req.query'],
  ['params', 'express.req.params'],
  ['headers', 'express.req.headers'],
  ['cookies', 'express.req.cookies'],
  ['ip', 'express.req.ip'],
]);

const EXPRESS_REQUEST_SOURCE_BY_MEMBER = new Map<string, string>([
  ['originalUrl', 'express.req.originalUrl'],
  ['url', 'express.req.url'],
  ['path', 'express.req.path'],
]);

const EXPRESS_REQUEST_SOURCE_BY_MEMBER_CALL = new Map<string, string>([
  ['get', 'express.req.get'],
  ['header', 'express.req.header'],
  ['param', 'express.req.param'],
]);

const EXPRESS_REQUEST_PARAM_NAMES = new Set(['req', 'request']);
const EXPRESS_HANDLER_METHODS = new Set([
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

export const EXPRESS_REQUEST_SOURCES = [
  ...EXPRESS_REQUEST_SOURCE_BY_REFERENCE.values(),
  ...EXPRESS_REQUEST_SOURCE_BY_MEMBER.values(),
  ...EXPRESS_REQUEST_SOURCE_BY_MEMBER_CALL.values(),
];

export function expressRequestSource(
  parameters: string[],
  references: string[],
  memberReferences: string[],
  memberCallSites: string[],
  enabledSources: Set<string>,
  contextualCallSite: string | undefined,
  imports: Array<{ source: string }>,
): string | null {
  if (!isExpressFile(imports)) return null;
  if (!isExpressHandlerCall(contextualCallSite)) return null;
  const requestParams = expressRequestParams(parameters);
  if (requestParams.length === 0) return null;
  return expressMatchedSource(requestParams, references, memberReferences, memberCallSites, enabledSources);
}

function expressRequestParams(parameters: string[]): string[] {
  return matchingParameters(parameters, EXPRESS_REQUEST_PARAM_NAMES);
}

function expressMatchedSource(
  requestParams: string[],
  references: string[],
  memberReferences: string[],
  memberCallSites: string[],
  enabledSources: Set<string>,
): string | null {
  return (
    expressMemberReferenceSource(requestParams, memberReferences, enabledSources) ??
    expressReferenceSource(references, enabledSources) ??
    expressMemberCallSource(requestParams, memberCallSites, enabledSources)
  );
}

function expressReferenceSource(references: string[], enabledSources: Set<string>): string | null {
  return sourceFromExactMembers(references, EXPRESS_REQUEST_SOURCE_BY_REFERENCE, enabledSources);
}

function expressMemberReferenceSource(
  requestParams: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
): string | null {
  return sourceFromPrefixedMembers(
    requestParams.map((parameter) => `${parameter}.`),
    memberReferences,
    EXPRESS_REQUEST_SOURCE_BY_MEMBER,
    enabledSources,
  );
}

function expressMemberCallSource(
  requestParams: string[],
  memberCallSites: string[],
  enabledSources: Set<string>,
): string | null {
  return sourceFromPrefixedMembers(
    requestParams.map((parameter) => `${parameter}.`),
    memberCallSites,
    EXPRESS_REQUEST_SOURCE_BY_MEMBER_CALL,
    enabledSources,
  );
}

function isExpressFile(imports: Array<{ source: string }>): boolean {
  return imports.some((imp) => imp.source === 'express');
}

function isExpressHandlerCall(contextualCallSite: string | undefined): boolean {
  return isKnownHandlerCall(contextualCallSite, EXPRESS_HANDLER_METHODS);
}
