import {
  NEXT_ROUTE_REQUEST_SOURCES,
  nextRouteRequestSource,
} from './frameworkNextRouteSources.js';
import { EXPRESS_REQUEST_SOURCES, expressRequestSource } from './frameworkExpressSources.js';
import { FASTIFY_REQUEST_SOURCES, fastifyRequestSource } from './frameworkFastifySources.js';
import { HONO_REQUEST_SOURCES, honoRequestSource } from './frameworkHonoSources.js';
import { KOA_REQUEST_SOURCES, koaRequestSource } from './frameworkKoaSources.js';

export const FRAMEWORK_REQUEST_SOURCES = [
  ...NEXT_ROUTE_REQUEST_SOURCES,
  ...HONO_REQUEST_SOURCES,
  ...EXPRESS_REQUEST_SOURCES,
  ...FASTIFY_REQUEST_SOURCES,
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
      memberReferences,
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
