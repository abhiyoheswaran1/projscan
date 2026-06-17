const KOA_REQUEST_SOURCE_BY_MEMBER = new Map<string, string>([
  ['request.body', 'koa.ctx.request.body'],
  ['request.query', 'koa.ctx.request.query'],
  ['request.headers', 'koa.ctx.request.headers'],
  ['request.ip', 'koa.ctx.request.ip'],
  ['request.url', 'koa.ctx.request.url'],
  ['request.originalUrl', 'koa.ctx.request.originalUrl'],
  ['request.path', 'koa.ctx.request.path'],
  ['query', 'koa.ctx.query'],
  ['params', 'koa.ctx.params'],
  ['headers', 'koa.ctx.headers'],
  ['ip', 'koa.ctx.ip'],
  ['url', 'koa.ctx.url'],
  ['originalUrl', 'koa.ctx.originalUrl'],
  ['path', 'koa.ctx.path'],
]);

const KOA_REQUEST_SOURCE_BY_MEMBER_CALL = new Map<string, string>([
  ['get', 'koa.ctx.get'],
  ['request.get', 'koa.ctx.request.get'],
  ['cookies.get', 'koa.ctx.cookies.get'],
]);

const KOA_CONTEXT_PARAM_NAMES = new Set(['ctx', 'context']);
const KOA_HANDLER_METHODS = new Set([
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

export const KOA_REQUEST_SOURCES = [
  ...KOA_REQUEST_SOURCE_BY_MEMBER.values(),
  ...KOA_REQUEST_SOURCE_BY_MEMBER_CALL.values(),
];

export function koaRequestSource(
  parameters: string[],
  memberReferences: string[],
  memberCallSites: string[],
  enabledSources: Set<string>,
  contextualCallSite: string | undefined,
  imports: Array<{ source: string }>,
): string | null {
  if (!isKoaFile(imports)) return null;
  if (!isKoaHandlerCall(contextualCallSite)) return null;
  const contextParams = parameters.filter((parameter) => KOA_CONTEXT_PARAM_NAMES.has(parameter));
  if (contextParams.length === 0) return null;
  return (
    koaMemberReferenceSource(contextParams, memberReferences, enabledSources) ??
    koaMemberCallSource(contextParams, memberCallSites, enabledSources)
  );
}

function koaMemberReferenceSource(
  contextParams: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
): string | null {
  const members = new Set(memberReferences);
  for (const parameter of contextParams) {
    for (const [member, source] of KOA_REQUEST_SOURCE_BY_MEMBER) {
      if (enabledSources.has(source) && members.has(`${parameter}.${member}`)) return source;
    }
  }
  return null;
}

function koaMemberCallSource(
  contextParams: string[],
  memberCallSites: string[],
  enabledSources: Set<string>,
): string | null {
  const calls = new Set(memberCallSites);
  for (const parameter of contextParams) {
    for (const [member, source] of KOA_REQUEST_SOURCE_BY_MEMBER_CALL) {
      if (enabledSources.has(source) && calls.has(`${parameter}.${member}`)) return source;
    }
  }
  return null;
}

function isKoaFile(imports: Array<{ source: string }>): boolean {
  return imports.some(
    (imp) => imp.source === 'koa' || imp.source === '@koa/router' || imp.source === 'koa-router',
  );
}

function isKoaHandlerCall(contextualCallSite: string | undefined): boolean {
  if (!contextualCallSite) return false;
  return KOA_HANDLER_METHODS.has(bareName(contextualCallSite));
}

function bareName(qualified: string): string {
  const dot = qualified.lastIndexOf('.');
  return dot < 0 ? qualified : qualified.slice(dot + 1);
}
