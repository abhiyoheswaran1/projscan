import {
  NEXT_ROUTE_REQUEST_SOURCES,
  nextRouteRequestSource,
} from './frameworkNextRouteSources.js';
import { EXPRESS_REQUEST_SOURCES, expressRequestSource } from './frameworkExpressSources.js';
import { FASTIFY_REQUEST_SOURCES, fastifyRequestSource } from './frameworkFastifySources.js';
import { HONO_REQUEST_SOURCES, honoRequestSource } from './frameworkHonoSources.js';
import { KOA_REQUEST_SOURCES, koaRequestSource } from './frameworkKoaSources.js';
import { REMIX_REQUEST_SOURCES, remixRequestSource } from './frameworkRemixSources.js';

export const FRAMEWORK_REQUEST_SOURCES = [
  ...NEXT_ROUTE_REQUEST_SOURCES,
  ...REMIX_REQUEST_SOURCES,
  ...HONO_REQUEST_SOURCES,
  ...EXPRESS_REQUEST_SOURCES,
  ...FASTIFY_REQUEST_SOURCES,
  ...KOA_REQUEST_SOURCES,
];

export interface FrameworkRequestSourceContext {
  file: string;
  functionName: string;
  memberCallSites: string[];
  memberReferences: string[];
  parameters: string[];
  enabledSources: Set<string>;
  references?: string[];
  contextualCallSite?: string;
  imports?: Array<{ source: string }>;
  directCallSites?: string[];
}

type FrameworkRequestSourceResolver = (context: FrameworkRequestSourceContext) => string | null;

const FRAMEWORK_REQUEST_SOURCE_RESOLVERS: FrameworkRequestSourceResolver[] = [
  resolveNextRouteSource,
  resolveRemixSource,
  resolveHonoSource,
  resolveExpressSource,
  resolveFastifySource,
  resolveKoaSource,
];

export function frameworkRequestSourceForFunction(
  context: FrameworkRequestSourceContext,
): string | null {
  for (const resolve of FRAMEWORK_REQUEST_SOURCE_RESOLVERS) {
    const source = resolve(context);
    if (source) return source;
  }
  return null;
}

function resolveNextRouteSource(context: FrameworkRequestSourceContext): string | null {
  const {
    file,
    functionName,
    memberCallSites,
    memberReferences,
    parameters,
    enabledSources,
    imports = [],
    directCallSites = [],
  } = context;

  return nextRouteRequestSource(
    file,
    functionName,
    memberCallSites,
    memberReferences,
    parameters,
    enabledSources,
    imports,
    directCallSites,
  );
}

function resolveRemixSource(context: FrameworkRequestSourceContext): string | null {
  const { file, functionName, parameters, memberCallSites, memberReferences, enabledSources } =
    context;
  return remixRequestSource(
    file,
    functionName,
    parameters,
    memberCallSites,
    memberReferences,
    enabledSources,
  );
}

function resolveHonoSource(context: FrameworkRequestSourceContext): string | null {
  const {
    parameters,
    memberCallSites,
    memberReferences,
    enabledSources,
    contextualCallSite,
    imports = [],
  } = context;
  return honoRequestSource(
    parameters,
    memberCallSites,
    memberReferences,
    enabledSources,
    contextualCallSite,
    imports,
  );
}

function resolveExpressSource(context: FrameworkRequestSourceContext): string | null {
  const {
    parameters,
    references = [],
    memberReferences,
    memberCallSites,
    enabledSources,
    contextualCallSite,
    imports = [],
  } = context;
  return expressRequestSource(
    parameters,
    references,
    memberReferences,
    memberCallSites,
    enabledSources,
    contextualCallSite,
    imports,
  );
}

function resolveFastifySource(context: FrameworkRequestSourceContext): string | null {
  const {
    parameters,
    references = [],
    memberReferences,
    enabledSources,
    contextualCallSite,
    imports = [],
  } = context;
  return fastifyRequestSource(
    parameters,
    references,
    memberReferences,
    enabledSources,
    contextualCallSite,
    imports,
  );
}

function resolveKoaSource(context: FrameworkRequestSourceContext): string | null {
  const {
    parameters,
    memberReferences,
    memberCallSites,
    enabledSources,
    contextualCallSite,
    imports = [],
  } = context;
  return koaRequestSource(
    parameters,
    memberReferences,
    memberCallSites,
    enabledSources,
    contextualCallSite,
    imports,
  );
}
