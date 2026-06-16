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

function isFastifyFile(imports: Array<{ source: string }>): boolean {
  return imports.some((imp) => imp.source === 'fastify' || imp.source.startsWith('fastify/'));
}

function isFastifyHandlerCall(contextualCallSite: string | undefined): boolean {
  if (!contextualCallSite) return false;
  return FASTIFY_HANDLER_METHODS.has(bareName(contextualCallSite));
}

function bareName(qualified: string): string {
  const dot = qualified.lastIndexOf('.');
  return dot < 0 ? qualified : qualified.slice(dot + 1);
}
