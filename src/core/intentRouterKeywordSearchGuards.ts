import { claimContextMatches } from './intentRouterCoordinationSignals.js';
import type { KeywordMatchContext, KeywordMatchDecision } from './intentRouterKeywordContext.js';
import { doctorCleanupDiscoveryContextMatches } from './intentRouterRiskSignals.js';
import { searchApiContractContextMatches } from './intentRouterSearchApiSignals.js';
import { searchBackgroundWorkContextMatches } from './intentRouterSearchBackgroundSignals.js';
import { searchCommunicationArtifactContextMatches } from './intentRouterSearchCommunicationSignals.js';
import {
  searchDataAccessContextMatches,
  searchDataContractContextMatches,
} from './intentRouterSearchDataSignals.js';
import { searchDomainWorkflowContextMatches } from './intentRouterSearchDomainSignals.js';
import { searchInfraArtifactContextMatches } from './intentRouterSearchInfraSignals.js';
import { searchIntegrationContextMatches } from './intentRouterSearchIntegrationSignals.js';
import {
  searchAuthorizationContextMatches,
  searchConfigLookupContextMatches,
  searchDocumentationContextMatches,
  searchEnvLookupContextMatches,
  searchFeatureFlagContextMatches,
  searchGeneratedContextMatches,
  searchMigrationLookupContextMatches,
  searchObservabilityContextMatches,
  searchQuotedDebugTextContextMatches,
  searchRouteHandlerContextMatches,
} from './intentRouterSearchLookupSignals.js';
import { searchNavigationLayoutContextMatches } from './intentRouterSearchNavigationSignals.js';
import { searchOwnershipContextMatches } from './intentRouterSearchOwnershipSignals.js';
import { searchFrontendPageRouteContextMatches } from './intentRouterSearchPageSignals.js';
import { searchReliabilityContextMatches } from './intentRouterSearchReliabilitySignals.js';
import { searchStateManagementContextMatches } from './intentRouterSearchStateSignals.js';
import { searchStyleSystemContextMatches } from './intentRouterSearchStyleSignals.js';
import { searchTestDataContextMatches } from './intentRouterSearchTestSignals.js';
import { searchToolingConfigContextMatches } from './intentRouterSearchToolingSignals.js';
import { searchUiInteractionContextMatches } from './intentRouterSearchUiSignals.js';
import {
  searchCodeLocationContextMatches,
  searchTestLocationContextMatches,
} from './intentRouterVerificationSignals.js';
import { structuralReviewWorkflowContextMatches } from './intentRouterReviewSignals.js';

type SearchKeywordGuardRule = {
  keywords: readonly string[];
  allows: (context: KeywordMatchContext) => boolean;
};

type TokenContextMatcher = (tokens: Set<string>) => boolean;

function keywordList(words: string): readonly string[] {
  return words.split(' ');
}

export function routeKeywordSearchGuardDecision(
  context: KeywordMatchContext,
): KeywordMatchDecision {
  if (context.entry.tool !== 'projscan_search') return undefined;
  return searchKeywordDecision(context);
}

function searchKeywordDecision(context: KeywordMatchContext): KeywordMatchDecision {
  const shouldReject = SEARCH_KEYWORD_GUARD_RULES.some(
    (rule) => rule.keywords.includes(context.keyword) && !rule.allows(context),
  );
  return shouldReject ? false : undefined;
}

function anyTokenContext(tokens: Set<string>, matchers: readonly TokenContextMatcher[]): boolean {
  return matchers.some((matches) => matches(tokens));
}

const SEARCH_KEYWORD_GUARD_RULES: readonly SearchKeywordGuardRule[] = [
  {
    keywords: keywordList('search find locate where show code'),
    allows: ({ tokens }) =>
      !doctorCleanupDiscoveryContextMatches(tokens) &&
      !structuralReviewWorkflowContextMatches(tokens),
  },
  {
    keywords: keywordList('test tests spec specs cover covers covering'),
    allows: ({ tokens, hasFilePath }) => searchTestLocationContextMatches(tokens, hasFilePath),
  },
  {
    keywords: keywordList('feature features flag flags'),
    allows: ({ tokens }) => searchFeatureFlagContextMatches(tokens),
  },
  {
    keywords: keywordList('env var vars variable variables process used controls control'),
    allows: ({ tokens, hasEnvVar }) =>
      searchEnvLookupContextMatches(tokens, hasEnvVar) || searchTestDataContextMatches(tokens),
  },
  {
    keywords: keywordList('error errors message messages throw throws thrown log logs logged logging'),
    allows: ({ tokens, hasQuotedText }) =>
      searchQuotedDebugTextContextMatches(tokens, hasQuotedText) ||
      searchObservabilityContextMatches(tokens) ||
      searchUiInteractionContextMatches(tokens) ||
      searchDomainWorkflowContextMatches(tokens),
  },
  {
    keywords: keywordList('check'),
    allows: ({ tokens }) => searchObservabilityContextMatches(tokens),
  },
  {
    keywords: keywordList('metric metrics prometheus analytics event events alert alerts sentry datadog dashboard dashboards emit emits emitted send sends initialize initialise init'),
    allows: ({ tokens }) =>
      anyTokenContext(tokens, [
        searchObservabilityContextMatches,
        searchIntegrationContextMatches,
        searchCommunicationArtifactContextMatches,
        searchNavigationLayoutContextMatches,
        searchFrontendPageRouteContextMatches,
      ]),
  },
  {
    keywords: keywordList('input validation validate validates validator schema schemas zod params param query queries parsed json serialize serializes serialization response format formats formatting date transaction transactions wrap wraps started database db lock locks locking row optimistic unique uniqueness enforced email pagination cursor cursors builds'),
    allows: ({ tokens }) =>
      anyTokenContext(tokens, [
        searchDataContractContextMatches,
        searchIntegrationContextMatches,
        searchApiContractContextMatches,
        searchCommunicationArtifactContextMatches,
        searchStateManagementContextMatches,
        searchDataAccessContextMatches,
      ]),
  },
  {
    keywords: keywordList('openapi swagger trpc grpc protobuf proto protos router routers resolver resolvers'),
    allows: ({ tokens }) => searchApiContractContextMatches(tokens),
  },
  {
    keywords: keywordList('docker dockerfile compose containerfile kubernetes k8s manifest manifests helm chart charts terraform tf module modules cloudformation cdk pulumi vercel netlify railway fly workflow workflows deploy deploys deployment staging production'),
    allows: ({ tokens }) =>
      searchInfraArtifactContextMatches(tokens) || searchStyleSystemContextMatches(tokens),
  },
  {
    keywords: keywordList('password reset invite invites onboarding flow flows csv export exports audit entries refund handling payments subscription renewal users'),
    allows: ({ tokens }) =>
      searchDomainWorkflowContextMatches(tokens) || searchDataAccessContextMatches(tokens),
  },
  {
    keywords: keywordList('welcome template templates copy push sms verification receipt invoice pdf'),
    allows: ({ tokens }) => searchCommunicationArtifactContextMatches(tokens),
  },
  {
    keywords: keywordList('store stores stored redux slice slices selector selectors zustand jotai recoil context provider providers supplies supplied provides provided hook hooks react mutation mutations fetches fetched invoices'),
    allows: ({ tokens }) =>
      searchStateManagementContextMatches(tokens) || searchDataAccessContextMatches(tokens),
  },
  {
    keywords: keywordList('prisma drizzle typeorm sequelize sql model models entity entities repository repositories dao daos saves save persist persists orders'),
    allows: ({ tokens }) => searchDataAccessContextMatches(tokens),
  },
  {
    keywords: keywordList('sidebar nav navigation menu item items breadcrumb breadcrumbs layout next js title metadata meta billing settings checkout'),
    allows: ({ tokens }) =>
      searchNavigationLayoutContextMatches(tokens) ||
      searchFrontendPageRouteContextMatches(tokens),
  },
  {
    keywords: keywordList('segment segments not found 404'),
    allows: ({ tokens }) => searchFrontendPageRouteContextMatches(tokens),
  },
  {
    keywords: keywordList('design token tokens tailwind theme themes css global imported style styles styled class classes dark mode breakpoint breakpoints color colors'),
    allows: ({ tokens }) =>
      searchStyleSystemContextMatches(tokens) || searchStateManagementContextMatches(tokens),
  },
  {
    keywords: keywordList('form forms submit submits submitted loading state empty results boundary toast notification notifications success keyboard shortcut shortcuts command palette action actions modal opened component page i18n translation translations aria label button buttons focus trap'),
    allows: ({ tokens }) =>
      anyTokenContext(tokens, [
        searchUiInteractionContextMatches,
        searchIntegrationContextMatches,
        searchCommunicationArtifactContextMatches,
        searchStateManagementContextMatches,
        searchNavigationLayoutContextMatches,
        searchFrontendPageRouteContextMatches,
        searchStyleSystemContextMatches,
      ]),
  },
  {
    keywords: keywordList('call calls called client clients sdk sdks integration integrations stripe sendgrid s3 github graphql websocket websockets socket sockets connection connections rest http fetch axios external service services upload uploads uploaded sent opened'),
    allows: ({ tokens }) =>
      anyTokenContext(tokens, [
        searchIntegrationContextMatches,
        searchApiContractContextMatches,
        searchInfraArtifactContextMatches,
        searchStateManagementContextMatches,
      ]),
  },
  {
    keywords: keywordList('rate rates limit limits limiting throttle throttling cache caches cached redis invalidate invalidates invalidated invalidation retry retries retried backoff timeout timeouts request requests failed set sets circuit breaker idempotency idempotent key keys signature signatures verified verify verification debounce debounced protect protects'),
    allows: ({ tokens }) =>
      anyTokenContext(tokens, [
        searchReliabilityContextMatches,
        searchDataContractContextMatches,
        searchCommunicationArtifactContextMatches,
        searchNavigationLayoutContextMatches,
      ]),
  },
  {
    keywords: keywordList('permission permissions checked role roles access admin guard guards authorization authorize authorized policy policies rbac require requires required login'),
    allows: ({ tokens }) => searchAuthorizationContextMatches(tokens),
  },
  {
    keywords: keywordList('seed seeds data fixture fixtures mock mocks factory factories storybook story stories render renders rendered'),
    allows: ({ tokens }) =>
      anyTokenContext(tokens, [
        searchTestDataContextMatches,
        searchUiInteractionContextMatches,
        searchNavigationLayoutContextMatches,
        searchFrontendPageRouteContextMatches,
      ]),
  },
  {
    keywords: keywordList('background job jobs cron scheduled schedule scheduler schedulers worker workers queue queues processor processors task tasks defined processes'),
    allows: ({ tokens }) =>
      anyTokenContext(tokens, [
        searchBackgroundWorkContextMatches,
        searchTestDataContextMatches,
        searchAuthorizationContextMatches,
        searchApiContractContextMatches,
        searchStyleSystemContextMatches,
      ]),
  },
  {
    keywords: keywordList('config configuration alias aliases define defines'),
    allows: ({ tokens }) =>
      anyTokenContext(tokens, [
        searchConfigLookupContextMatches,
        searchToolingConfigContextMatches,
        searchApiContractContextMatches,
        searchInfraArtifactContextMatches,
      ]),
  },
  {
    keywords: keywordList('tsconfig typescript vite vitest jest babel webpack pnpm yarn npm package manager workspace workspaces lockfile lockfiles path paths'),
    allows: ({ tokens }) =>
      searchToolingConfigContextMatches(tokens) || searchConfigLookupContextMatches(tokens),
  },
  {
    keywords: keywordList('api apis route routes endpoint endpoints'),
    allows: ({ tokens }) =>
      anyTokenContext(tokens, [
        searchRouteHandlerContextMatches,
        searchAuthorizationContextMatches,
        searchDataContractContextMatches,
        searchIntegrationContextMatches,
        searchApiContractContextMatches,
        searchNavigationLayoutContextMatches,
        searchFrontendPageRouteContextMatches,
      ]),
  },
  {
    keywords: keywordList('migration migrations generated exist exists ran show file files'),
    allows: ({ tokens }) =>
      !structuralReviewWorkflowContextMatches(tokens) &&
      anyTokenContext(tokens, [
        searchMigrationLookupContextMatches,
        searchGeneratedContextMatches,
        searchConfigLookupContextMatches,
        searchToolingConfigContextMatches,
        searchBackgroundWorkContextMatches,
        searchTestDataContextMatches,
        searchDataContractContextMatches,
        searchCommunicationArtifactContextMatches,
      ]),
  },
  {
    keywords: keywordList('code handles handled handler contains logic implemented configured created creates loaded loader parse parses parsed middleware'),
    allows: ({ tokens }) =>
      !structuralReviewWorkflowContextMatches(tokens) &&
      anyTokenContext(tokens, [
        searchCodeLocationContextMatches,
        searchGeneratedContextMatches,
        searchRouteHandlerContextMatches,
        searchReliabilityContextMatches,
        searchDataContractContextMatches,
        searchUiInteractionContextMatches,
        searchIntegrationContextMatches,
        searchApiContractContextMatches,
        searchDomainWorkflowContextMatches,
        searchDataAccessContextMatches,
        searchFrontendPageRouteContextMatches,
      ]),
  },
  {
    keywords: keywordList('owner owners ownership owns team area ask help knows expert experts contact contacts'),
    allows: ({ tokens, hasFilePath }) =>
      searchOwnershipContextMatches(tokens, hasFilePath, claimContextMatches(tokens)) ||
      searchDomainWorkflowContextMatches(tokens),
  },
  {
    keywords: keywordList('doc docs document documentation documented readme examples example guide'),
    allows: ({ tokens }) =>
      searchDocumentationContextMatches(tokens) || searchApiContractContextMatches(tokens),
  },
];
