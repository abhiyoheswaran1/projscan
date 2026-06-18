import type {
  FrameworkRequestSourceContext,
  FrameworkRequestSourceResolver,
} from './frameworkSourceContext.js';
import { expressRequestSource } from './frameworkExpressSources.js';
import { fastifyRequestSource } from './frameworkFastifySources.js';
import { honoRequestSource } from './frameworkHonoSources.js';
import { koaRequestSource } from './frameworkKoaSources.js';
import { nextRouteRequestSource } from './frameworkNextRouteSources.js';
import { remixRequestSource } from './frameworkRemixSources.js';

export const FRAMEWORK_REQUEST_SOURCE_RESOLVERS: FrameworkRequestSourceResolver[] = [
  resolveNextRouteSource,
  resolveRemixSource,
  resolveHonoSource,
  resolveExpressSource,
  resolveFastifySource,
  resolveKoaSource,
];

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
