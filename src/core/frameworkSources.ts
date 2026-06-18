import {
  NEXT_ROUTE_REQUEST_SOURCES,
} from './frameworkNextRouteSources.js';
import { ASTRO_REQUEST_SOURCES } from './frameworkAstroSources.js';
import { EXPRESS_REQUEST_SOURCES } from './frameworkExpressSources.js';
import { FASTIFY_REQUEST_SOURCES } from './frameworkFastifySources.js';
import { HONO_REQUEST_SOURCES } from './frameworkHonoSources.js';
import { KOA_REQUEST_SOURCES } from './frameworkKoaSources.js';
import { REMIX_REQUEST_SOURCES } from './frameworkRemixSources.js';
import { SVELTEKIT_REQUEST_SOURCES } from './frameworkSvelteKitSources.js';
import type { FrameworkRequestSourceContext } from './frameworkSourceContext.js';
import { FRAMEWORK_REQUEST_SOURCE_RESOLVERS } from './frameworkSourceResolvers.js';

export const FRAMEWORK_REQUEST_SOURCES = [
  ...NEXT_ROUTE_REQUEST_SOURCES,
  ...REMIX_REQUEST_SOURCES,
  ...SVELTEKIT_REQUEST_SOURCES,
  ...ASTRO_REQUEST_SOURCES,
  ...HONO_REQUEST_SOURCES,
  ...EXPRESS_REQUEST_SOURCES,
  ...FASTIFY_REQUEST_SOURCES,
  ...KOA_REQUEST_SOURCES,
];

export type { FrameworkRequestSourceContext } from './frameworkSourceContext.js';

export function frameworkRequestSourceForFunction(
  context: FrameworkRequestSourceContext,
): string | null {
  for (const resolve of FRAMEWORK_REQUEST_SOURCE_RESOLVERS) {
    const source = resolve(context);
    if (source) return source;
  }
  return null;
}
