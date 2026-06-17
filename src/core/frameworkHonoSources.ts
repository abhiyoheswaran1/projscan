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
  ['valid', 'hono.req.valid'],
]);

const HONO_REQUEST_SOURCE_BY_MEMBER_REFERENCE = new Map<string, string>([
  ['url', 'hono.req.url'],
  ['path', 'hono.req.path'],
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
  const contextParams = parameters.filter((parameter) => HONO_CONTEXT_PARAM_NAMES.has(parameter));
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
  const members = new Set(memberCallSites);
  for (const parameter of contextParams) {
    for (const [callee, source] of HONO_REQUEST_SOURCE_BY_MEMBER_CALL) {
      if (enabledSources.has(source) && members.has(`${parameter}.req.${callee}`)) return source;
    }
  }
  return null;
}

function honoMemberReferenceSource(
  contextParams: string[],
  memberReferences: string[],
  enabledSources: Set<string>,
): string | null {
  const members = new Set(memberReferences);
  for (const parameter of contextParams) {
    for (const [member, source] of HONO_REQUEST_SOURCE_BY_MEMBER_REFERENCE) {
      if (enabledSources.has(source) && members.has(`${parameter}.req.${member}`)) return source;
    }
  }
  return null;
}

function isHonoFile(imports: Array<{ source: string }>): boolean {
  return imports.some((imp) => imp.source === 'hono' || imp.source.startsWith('hono/'));
}

function isHonoHandlerCall(contextualCallSite: string | undefined): boolean {
  if (!contextualCallSite) return false;
  return HONO_HANDLER_METHODS.has(bareName(contextualCallSite));
}

function bareName(qualified: string): string {
  const dot = qualified.lastIndexOf('.');
  return dot < 0 ? qualified : qualified.slice(dot + 1);
}
