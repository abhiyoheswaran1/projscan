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
  ...EXPRESS_REQUEST_SOURCE_BY_MEMBER_CALL.values(),
];

export function expressRequestSource(
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

function isExpressFile(imports: Array<{ source: string }>): boolean {
  return imports.some((imp) => imp.source === 'express');
}

function isExpressHandlerCall(contextualCallSite: string | undefined): boolean {
  if (!contextualCallSite) return false;
  const method = bareName(contextualCallSite);
  return EXPRESS_HANDLER_METHODS.has(method);
}

function bareName(qualified: string): string {
  const dot = qualified.lastIndexOf('.');
  return dot < 0 ? qualified : qualified.slice(dot + 1);
}
