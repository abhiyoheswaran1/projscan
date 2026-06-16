import {
  NEXT_ROUTE_REQUEST_SOURCES,
  nextRouteRequestSource,
} from './frameworkNextRouteSources.js';
import { KOA_REQUEST_SOURCES, koaRequestSource } from './frameworkKoaSources.js';

const HONO_REQUEST_SOURCE_BY_MEMBER = new Map<string, string>([
  ['json', 'hono.req.json'],
  ['parseBody', 'hono.req.parseBody'],
  ['text', 'hono.req.text'],
  ['query', 'hono.req.query'],
  ['param', 'hono.req.param'],
  ['header', 'hono.req.header'],
  ['valid', 'hono.req.valid'],
]);

const EXPRESS_REQUEST_SOURCE_BY_REFERENCE = new Map<string, string>([
  ['body', 'express.req.body'],
  ['query', 'express.req.query'],
  ['params', 'express.req.params'],
  ['headers', 'express.req.headers'],
  ['cookies', 'express.req.cookies'],
  ['ip', 'express.req.ip'],
]);

const EXPRESS_REQUEST_SOURCE_BY_MEMBER_CALL = new Map<string, string>([
  ['get', 'express.req.get'],
  ['header', 'express.req.header'],
  ['param', 'express.req.param'],
]);

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
]);

const EXPRESS_REQUEST_PARAM_NAMES = new Set(['req', 'request']);
const HONO_CONTEXT_PARAM_NAMES = new Set(['c', 'ctx', 'context']);
const FASTIFY_REQUEST_PARAM_NAMES = new Set(['req', 'request']);
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

export const FRAMEWORK_REQUEST_SOURCES = [
  ...NEXT_ROUTE_REQUEST_SOURCES,
  ...HONO_REQUEST_SOURCE_BY_MEMBER.values(),
  ...EXPRESS_REQUEST_SOURCE_BY_REFERENCE.values(),
  ...EXPRESS_REQUEST_SOURCE_BY_MEMBER_CALL.values(),
  ...FASTIFY_REQUEST_SOURCE_BY_REFERENCE.values(),
  ...FASTIFY_REQUEST_SOURCE_BY_MEMBER.values(),
  ...KOA_REQUEST_SOURCES,
];

export function frameworkRequestSourceForFunction(
  file: string,
  functionName: string,
  memberCallSites: string[],
  memberReferences: string[],
  parameters: string[],
  enabledSources: Set<string>,
  references: string[] = [],
  contextualCallSite?: string,
  imports: Array<{ source: string }> = [],
): string | null {
  const nextSource = nextRouteRequestSource(
    file,
    functionName,
    memberCallSites,
    memberReferences,
    parameters,
    enabledSources,
  );
  if (nextSource) return nextSource;
  const honoSource = honoRequestSource(
    parameters,
    memberCallSites,
    enabledSources,
    contextualCallSite,
    imports,
  );
  if (honoSource) return honoSource;
  return (
    expressRequestSource(
      parameters,
      references,
      memberCallSites,
      enabledSources,
      contextualCallSite,
      imports,
    ) ??
    fastifyRequestSource(
      parameters,
      references,
      memberReferences,
      enabledSources,
      contextualCallSite,
      imports,
    ) ??
    koaRequestSource(
      parameters,
      memberReferences,
      memberCallSites,
      enabledSources,
      contextualCallSite,
      imports,
    )
  );
}

function honoRequestSource(
  parameters: string[],
  memberCallSites: string[],
  enabledSources: Set<string>,
  contextualCallSite: string | undefined,
  imports: Array<{ source: string }>,
): string | null {
  if (!isHonoFile(imports)) return null;
  if (!isHonoHandlerCall(contextualCallSite)) return null;
  const contextParams = parameters.filter((parameter) => HONO_CONTEXT_PARAM_NAMES.has(parameter));
  if (contextParams.length === 0) return null;
  const members = new Set(memberCallSites);
  for (const parameter of contextParams) {
    for (const [callee, source] of HONO_REQUEST_SOURCE_BY_MEMBER) {
      if (enabledSources.has(source) && members.has(`${parameter}.req.${callee}`)) return source;
    }
  }
  return null;
}

function expressRequestSource(
  parameters: string[],
  references: string[],
  memberCallSites: string[],
  enabledSources: Set<string>,
  contextualCallSite: string | undefined,
  imports: Array<{ source: string }>,
): string | null {
  if (!isExpressFile(imports)) return null;
  if (!isExpressHandlerCall(contextualCallSite)) return null;
  const requestParams = parameters.filter((parameter) => EXPRESS_REQUEST_PARAM_NAMES.has(parameter));
  if (requestParams.length === 0) return null;
  return (
    expressReferenceSource(references, enabledSources) ??
    expressMemberCallSource(requestParams, memberCallSites, enabledSources)
  );
}

function expressReferenceSource(references: string[], enabledSources: Set<string>): string | null {
  const refs = new Set(references);
  for (const [reference, source] of EXPRESS_REQUEST_SOURCE_BY_REFERENCE) {
    if (enabledSources.has(source) && refs.has(reference)) return source;
  }
  return null;
}

function expressMemberCallSource(
  requestParams: string[],
  memberCallSites: string[],
  enabledSources: Set<string>,
): string | null {
  const calls = new Set(memberCallSites);
  for (const parameter of requestParams) {
    for (const [member, source] of EXPRESS_REQUEST_SOURCE_BY_MEMBER_CALL) {
      if (enabledSources.has(source) && calls.has(`${parameter}.${member}`)) return source;
    }
  }
  return null;
}

function fastifyRequestSource(
  parameters: string[],
  references: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
  contextualCallSite: string | undefined,
  imports: Array<{ source: string }>,
): string | null {
  if (!isFastifyFile(imports)) return null;
  if (!isFastifyHandlerCall(contextualCallSite)) return null;
  const requestParams = parameters.filter((parameter) => FASTIFY_REQUEST_PARAM_NAMES.has(parameter));
  if (requestParams.length === 0) return null;
  return (
    fastifyMemberReferenceSource(requestParams, memberReferences, enabledSources) ??
    fastifyReferenceSource(references, enabledSources)
  );
}

function fastifyReferenceSource(references: string[], enabledSources: Set<string>): string | null {
  const refs = new Set(references);
  for (const [reference, source] of FASTIFY_REQUEST_SOURCE_BY_REFERENCE) {
    if (enabledSources.has(source) && refs.has(reference)) return source;
  }
  return null;
}

function fastifyMemberReferenceSource(
  requestParams: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
): string | null {
  const members = new Set(memberReferences);
  for (const parameter of requestParams) {
    for (const [member, source] of FASTIFY_REQUEST_SOURCE_BY_MEMBER) {
      if (enabledSources.has(source) && members.has(`${parameter}.${member}`)) return source;
    }
  }
  return null;
}

function isExpressFile(imports: Array<{ source: string }>): boolean {
  return imports.some((imp) => imp.source === 'express');
}

function isHonoFile(imports: Array<{ source: string }>): boolean {
  return imports.some((imp) => imp.source === 'hono' || imp.source.startsWith('hono/'));
}

function isFastifyFile(imports: Array<{ source: string }>): boolean {
  return imports.some((imp) => imp.source === 'fastify' || imp.source.startsWith('fastify/'));
}

function isExpressHandlerCall(contextualCallSite: string | undefined): boolean {
  if (!contextualCallSite) return false;
  const method = bareName(contextualCallSite);
  return EXPRESS_HANDLER_METHODS.has(method);
}

function isHonoHandlerCall(contextualCallSite: string | undefined): boolean {
  if (!contextualCallSite) return false;
  return HONO_HANDLER_METHODS.has(bareName(contextualCallSite));
}

function isFastifyHandlerCall(contextualCallSite: string | undefined): boolean {
  if (!contextualCallSite) return false;
  return FASTIFY_HANDLER_METHODS.has(bareName(contextualCallSite));
}

function bareName(qualified: string): string {
  const dot = qualified.lastIndexOf('.');
  return dot < 0 ? qualified : qualified.slice(dot + 1);
}
