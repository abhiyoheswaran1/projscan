import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { routesForIntent } from '../../src/core/startMode.js';
import { actionPlanFromRoute } from '../../src/core/startRouteActions.js';
import { makeTempProject } from '../helpers/startProject.js';

function primaryActionForIntent(intent: string) {
  const route = routesForIntent(intent)[0];
  if (!route) throw new Error(`Expected a route for intent: ${intent}`);
  const action = actionPlanFromRoute('before_edit', intent, route)[0];
  if (!action) throw new Error(`Expected an action for intent: ${intent}`);
  return { action, route };
}

test('start report routes generic lookup intents to search rather than bug hunt', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'find the PR template',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toContain('find the PR template');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_search',
      confidence: 'medium',
      matchedKeywords: ['find'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "the PR template" --format json',
      tool: 'projscan_search',
      args: { query: 'the PR template' },
    }),
  );
  expect(report.missionControl.alternatives?.map((route) => route.tool)).toContain(
    'projscan_bug_hunt',
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_bug_hunt'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'low',
      matchedKeywords: ['find', 'pr'],
    }),
  );
});

test('start report turns documentation lookup questions into search', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'find documentation for auth',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: ['find', 'documentation'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "documentation for auth" --format json',
      tool: 'projscan_search',
      args: { query: 'documentation for auth' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Search results identify the target files or symbols with enough confidence to choose the next tool.',
    ]),
  );
});

test('start report turns code-location questions into focused search', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what code handles billing',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: ['code', 'handles'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "billing" --format json',
      tool: 'projscan_search',
      args: { query: 'billing' },
    }),
  );
  expect(report.missionControl.proofCommands).toContain('projscan search "billing" --format json');

  const cases: Array<{
    intent: string;
    command: string;
    tool?: string;
    args: Record<string, unknown>;
    route?: {
      category?: string;
      confidence?: 'high' | 'medium' | 'low';
      matchedKeywords?: string[];
    };
  }> = [
    {
      intent: 'find the handler for POST /api/users',
      command: 'projscan search "POST /api/users" --format json',
      args: { query: 'POST /api/users' },
      route: {
        category: 'Search',
        confidence: 'high',
        matchedKeywords: ['find', 'handler', 'api'],
      },
    },
    {
      intent: 'where is the /checkout route handled',
      command: 'projscan search "/checkout" --format json',
      args: { query: '/checkout' },
    },
    {
      intent: 'where is /settings page rendered',
      command: 'projscan search "/settings page" --format json',
      args: { query: '/settings page' },
    },
    {
      intent: 'which page renders /billing',
      command: 'projscan search "/billing page" --format json',
      args: { query: '/billing page' },
    },
    {
      intent: 'where is route segment for dashboard',
      command: 'projscan search "dashboard route segment" --format json',
      args: { query: 'dashboard route segment' },
    },
    {
      intent: 'where is not-found page handled',
      command: 'projscan search "not-found page" --format json',
      args: { query: 'not-found page' },
    },
    {
      intent: 'why is /settings returning 404',
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    },
    {
      intent: 'which feature flags exist',
      command: 'projscan search "feature flags" --format json',
      args: { query: 'feature flags' },
      route: { category: 'Search', confidence: 'high', matchedKeywords: ['feature', 'flags'] },
    },
    {
      intent: 'which migrations exist',
      command: 'projscan search "migrations" --format json',
      args: { query: 'migrations' },
      route: { category: 'Search', confidence: 'high', matchedKeywords: ['migrations', 'exist'] },
    },
    {
      intent: 'show me generated files',
      command: 'projscan search "generated files" --format json',
      args: { query: 'generated files' },
      route: { category: 'Search', confidence: 'high', matchedKeywords: ['generated', 'files'] },
    },
    {
      intent: 'where is eslint config',
      command: 'projscan search "eslint config" --format json',
      args: { query: 'eslint config' },
      route: { category: 'Search', confidence: 'high', matchedKeywords: ['where', 'config'] },
    },
    {
      intent: 'which config file defines aliases',
      command: 'projscan search "aliases config" --format json',
      args: { query: 'aliases config' },
      route: {
        category: 'Search',
        confidence: 'high',
        matchedKeywords: ['config', 'file', 'defines', 'aliases'],
      },
    },
    {
      intent: 'where is tsconfig path aliases configured',
      command: 'projscan search "tsconfig path aliases" --format json',
      args: { query: 'tsconfig path aliases' },
    },
    {
      intent: 'where is Vitest config',
      command: 'projscan search "Vitest config" --format json',
      args: { query: 'Vitest config' },
    },
    {
      intent: 'find Babel config',
      command: 'projscan search "Babel config" --format json',
      args: { query: 'Babel config' },
    },
    {
      intent: 'where is package manager configured',
      command: 'projscan search "package manager" --format json',
      args: { query: 'package manager' },
    },
    {
      intent: 'where is pnpm workspace file',
      command: 'projscan search "pnpm workspace" --format json',
      args: { query: 'pnpm workspace' },
    },
    {
      intent: 'why is vitest failing',
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    },
    {
      intent: 'where is NEXT_PUBLIC_API_URL used',
      command: 'projscan search "NEXT_PUBLIC_API_URL" --format json',
      args: { query: 'NEXT_PUBLIC_API_URL' },
      route: { category: 'Search', confidence: 'high', matchedKeywords: ['where', 'used'] },
    },
    {
      intent: 'which env var controls auth',
      command: 'projscan search "auth env var" --format json',
      args: { query: 'auth env var' },
      route: {
        category: 'Search',
        confidence: 'high',
        matchedKeywords: ['env', 'var', 'controls'],
      },
    },
    {
      intent: 'where is "Invalid token" thrown',
      command: 'projscan search "Invalid token" --format json',
      args: { query: 'Invalid token' },
      route: { category: 'Search', confidence: 'high', matchedKeywords: ['where', 'thrown'] },
    },
    {
      intent: 'find error message "Payment failed"',
      command: 'projscan search "Payment failed" --format json',
      args: { query: 'Payment failed' },
      route: {
        category: 'Search',
        confidence: 'high',
        matchedKeywords: ['find', 'error', 'message'],
      },
    },
    {
      intent: 'where do we log "could not connect"',
      command: 'projscan search "could not connect" --format json',
      args: { query: 'could not connect' },
    },
    {
      intent: 'what background jobs exist',
      command: 'projscan search "background jobs" --format json',
      args: { query: 'background jobs' },
      route: {
        category: 'Search',
        confidence: 'high',
        matchedKeywords: ['background', 'jobs', 'exist'],
      },
    },
    {
      intent: 'find the email queue processor',
      command: 'projscan search "email queue processor" --format json',
      args: { query: 'email queue processor' },
    },
    {
      intent: 'where are scheduled tasks defined',
      command: 'projscan search "scheduled tasks" --format json',
      args: { query: 'scheduled tasks' },
    },
    {
      intent: 'where are metrics emitted',
      command: 'projscan search "metrics" --format json',
      args: { query: 'metrics' },
      route: {
        category: 'Search',
        confidence: 'high',
        matchedKeywords: ['where', 'metrics', 'emitted'],
      },
    },
    {
      intent: 'where do we initialize Sentry',
      command: 'projscan search "Sentry" --format json',
      args: { query: 'Sentry' },
    },
    {
      intent: 'what logs should I check for checkout',
      command: 'projscan search "checkout logs" --format json',
      args: { query: 'checkout logs' },
    },
    {
      intent: 'find the dashboard for payments',
      command: 'projscan search "payments dashboard" --format json',
      args: { query: 'payments dashboard' },
    },
    {
      intent: 'where is seed data defined',
      command: 'projscan search "seed data" --format json',
      args: { query: 'seed data' },
      route: {
        category: 'Search',
        confidence: 'high',
        matchedKeywords: ['where', 'seed', 'data', 'defined'],
      },
    },
    {
      intent: 'find fixtures for checkout',
      command: 'projscan search "checkout fixtures" --format json',
      args: { query: 'checkout fixtures' },
    },
    {
      intent: 'which mocks are used for payments',
      command: 'projscan search "payments mocks" --format json',
      args: { query: 'payments mocks' },
    },
    {
      intent: 'where are Storybook stories for Button',
      command: 'projscan search "Button Storybook stories" --format json',
      args: { query: 'Button Storybook stories' },
    },
    {
      intent: 'which story renders checkout',
      command: 'projscan search "checkout story" --format json',
      args: { query: 'checkout story' },
    },
    {
      intent: 'where are permissions checked for checkout',
      command: 'projscan search "checkout permissions" --format json',
      args: { query: 'checkout permissions' },
      route: {
        category: 'Search',
        confidence: 'high',
        matchedKeywords: ['where', 'permissions', 'checked'],
      },
    },
    {
      intent: 'which role can access admin',
      command: 'projscan search "admin role access" --format json',
      args: { query: 'admin role access' },
    },
    {
      intent: 'where is RBAC defined',
      command: 'projscan search "RBAC" --format json',
      args: { query: 'RBAC' },
    },
    {
      intent: 'what routes require login',
      command: 'projscan search "login routes" --format json',
      args: { query: 'login routes' },
    },
    {
      intent: 'where is rate limiting configured',
      command: 'projscan search "rate limiting" --format json',
      args: { query: 'rate limiting' },
    },
    {
      intent: 'what rate limits protect checkout',
      command: 'projscan search "checkout rate limits" --format json',
      args: { query: 'checkout rate limits' },
    },
    {
      intent: 'where is cache invalidated for products',
      command: 'projscan search "products cache invalidation" --format json',
      args: { query: 'products cache invalidation' },
    },
    {
      intent: 'which code retries failed requests',
      command: 'projscan search "failed requests retries" --format json',
      args: { query: 'failed requests retries' },
    },
    {
      intent: 'what sets request timeout',
      command: 'projscan search "request timeout" --format json',
      args: { query: 'request timeout' },
    },
    {
      intent: 'find idempotency key handling',
      command: 'projscan search "idempotency key handling" --format json',
      args: { query: 'idempotency key handling' },
    },
    {
      intent: 'where is webhook signature verified',
      command: 'projscan search "webhook signature verification" --format json',
      args: { query: 'webhook signature verification' },
    },
    {
      intent: 'where is input validation for signup',
      command: 'projscan search "signup input validation" --format json',
      args: { query: 'signup input validation' },
    },
    {
      intent: 'which schema validates checkout',
      command: 'projscan search "checkout validation schema" --format json',
      args: { query: 'checkout validation schema' },
    },
    {
      intent: 'where are request params parsed',
      command: 'projscan search "request params parsing" --format json',
      args: { query: 'request params parsing' },
    },
    {
      intent: 'what serializes API response',
      command: 'projscan search "API response serialization" --format json',
      args: { query: 'API response serialization' },
    },
    {
      intent: 'where is database transaction started',
      command: 'projscan search "database transaction" --format json',
      args: { query: 'database transaction' },
    },
    {
      intent: 'where do we lock the order row',
      command: 'projscan search "order row lock" --format json',
      args: { query: 'order row lock' },
    },
    {
      intent: 'what validates email uniqueness',
      command: 'projscan search "email uniqueness validation" --format json',
      args: { query: 'email uniqueness validation' },
    },
    {
      intent: 'what builds pagination cursors',
      command: 'projscan search "pagination cursors" --format json',
      args: { query: 'pagination cursors' },
    },
    {
      intent: 'where is the signup form submitted',
      command: 'projscan search "signup form submit" --format json',
      args: { query: 'signup form submit' },
    },
    {
      intent: 'where is loading state for dashboard',
      command: 'projscan search "dashboard loading state" --format json',
      args: { query: 'dashboard loading state' },
    },
    {
      intent: 'what renders empty state for search results',
      command: 'projscan search "search results empty state" --format json',
      args: { query: 'search results empty state' },
    },
    {
      intent: 'where is error boundary for settings',
      command: 'projscan search "settings error boundary" --format json',
      args: { query: 'settings error boundary' },
    },
    {
      intent: 'where is toast shown after checkout',
      command: 'projscan search "checkout toast" --format json',
      args: { query: 'checkout toast' },
    },
    {
      intent: 'where is keyboard shortcut for save',
      command: 'projscan search "save keyboard shortcut" --format json',
      args: { query: 'save keyboard shortcut' },
    },
    {
      intent: 'find command palette actions',
      command: 'projscan search "command palette actions" --format json',
      args: { query: 'command palette actions' },
    },
    {
      intent: 'what component renders the billing page',
      command: 'projscan search "billing page component" --format json',
      args: { query: 'billing page component' },
    },
    {
      intent: 'where are i18n translations for checkout',
      command: 'projscan search "checkout translations" --format json',
      args: { query: 'checkout translations' },
    },
    {
      intent: 'where is aria label for submit button',
      command: 'projscan search "submit button aria label" --format json',
      args: { query: 'submit button aria label' },
    },
    {
      intent: 'where is focus trap implemented',
      command: 'projscan search "focus trap" --format json',
      args: { query: 'focus trap' },
    },
    {
      intent: 'where are design tokens defined',
      command: 'projscan search "design tokens" --format json',
      args: { query: 'design tokens' },
    },
    {
      intent: 'where is Tailwind theme configured',
      command: 'projscan search "Tailwind theme" --format json',
      args: { query: 'Tailwind theme' },
    },
    {
      intent: 'where is global CSS imported',
      command: 'projscan search "global CSS" --format json',
      args: { query: 'global CSS' },
    },
    {
      intent: 'which CSS module styles Button',
      command: 'projscan search "Button CSS module" --format json',
      args: { query: 'Button CSS module' },
    },
    {
      intent: 'where is dark mode configured',
      command: 'projscan search "dark mode" --format json',
      args: { query: 'dark mode' },
    },
    {
      intent: 'what breakpoints are defined',
      command: 'projscan search "breakpoints" --format json',
      args: { query: 'breakpoints' },
    },
    {
      intent: 'why is dark mode failing',
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    },
    {
      intent: 'where is sidebar nav item for billing',
      command: 'projscan search "billing sidebar nav item" --format json',
      args: { query: 'billing sidebar nav item' },
    },
    {
      intent: 'which breadcrumb renders settings',
      command: 'projscan search "settings breadcrumb" --format json',
      args: { query: 'settings breadcrumb' },
    },
    {
      intent: 'where is page title set for checkout',
      command: 'projscan search "checkout page title" --format json',
      args: { query: 'checkout page title' },
    },
    {
      intent: 'where is Next.js layout for dashboard',
      command: 'projscan search "dashboard Next.js layout" --format json',
      args: { query: 'dashboard Next.js layout' },
    },
    {
      intent: 'where is auth state stored',
      command: 'projscan search "auth state store" --format json',
      args: { query: 'auth state store' },
    },
    {
      intent: 'find Redux slice for cart',
      command: 'projscan search "cart Redux slice" --format json',
      args: { query: 'cart Redux slice' },
    },
    {
      intent: 'where is Zustand store for user settings',
      command: 'projscan search "user settings Zustand store" --format json',
      args: { query: 'user settings Zustand store' },
    },
    {
      intent: 'which context provider supplies theme',
      command: 'projscan search "theme context provider" --format json',
      args: { query: 'theme context provider' },
    },
    {
      intent: 'which hook fetches invoices',
      command: 'projscan search "invoices hook" --format json',
      args: { query: 'invoices hook' },
    },
    {
      intent: 'where is React Query mutation for checkout',
      command: 'projscan search "checkout React Query mutation" --format json',
      args: { query: 'checkout React Query mutation' },
    },
    {
      intent: 'where is Prisma model for User',
      command: 'projscan search "User Prisma model" --format json',
      args: { query: 'User Prisma model' },
    },
    {
      intent: 'find Drizzle schema for invoices',
      command: 'projscan search "invoices Drizzle schema" --format json',
      args: { query: 'invoices Drizzle schema' },
    },
    {
      intent: 'where is SQL query for invoices',
      command: 'projscan search "invoices SQL query" --format json',
      args: { query: 'invoices SQL query' },
    },
    {
      intent: 'which repository saves orders',
      command: 'projscan search "orders repository" --format json',
      args: { query: 'orders repository' },
    },
    {
      intent: 'find DAO for payments',
      command: 'projscan search "payments DAO" --format json',
      args: { query: 'payments DAO' },
    },
    {
      intent: 'where do we call Stripe',
      command: 'projscan search "Stripe API" --format json',
      args: { query: 'Stripe API' },
    },
    {
      intent: 'which code sends email through SendGrid',
      command: 'projscan search "SendGrid email" --format json',
      args: { query: 'SendGrid email' },
    },
    {
      intent: 'where is S3 upload implemented',
      command: 'projscan search "S3 upload" --format json',
      args: { query: 'S3 upload' },
    },
    {
      intent: 'find GitHub API client',
      command: 'projscan search "GitHub API client" --format json',
      args: { query: 'GitHub API client' },
    },
    {
      intent: 'where is GraphQL query for invoices',
      command: 'projscan search "invoices GraphQL query" --format json',
      args: { query: 'invoices GraphQL query' },
    },
    {
      intent: 'where is websocket connection opened',
      command: 'projscan search "websocket connection" --format json',
      args: { query: 'websocket connection' },
    },
    {
      intent: 'where is OpenAPI spec defined',
      command: 'projscan search "OpenAPI spec" --format json',
      args: { query: 'OpenAPI spec' },
    },
    {
      intent: 'where is Swagger docs configured',
      command: 'projscan search "Swagger docs" --format json',
      args: { query: 'Swagger docs' },
    },
    {
      intent: 'where is tRPC router for billing',
      command: 'projscan search "billing tRPC router" --format json',
      args: { query: 'billing tRPC router' },
    },
    {
      intent: 'which GraphQL resolver handles invoices',
      command: 'projscan search "invoices GraphQL resolver" --format json',
      args: { query: 'invoices GraphQL resolver' },
    },
    {
      intent: 'which protobuf defines user service',
      command: 'projscan search "user service protobuf" --format json',
      args: { query: 'user service protobuf' },
    },
    {
      intent: 'where is gRPC client for payments',
      command: 'projscan search "payments gRPC client" --format json',
      args: { query: 'payments gRPC client' },
    },
    {
      intent: 'where is the Dockerfile',
      command: 'projscan search "Dockerfile" --format json',
      args: { query: 'Dockerfile' },
    },
    {
      intent: 'where is docker compose for local dev',
      command: 'projscan search "local dev docker compose" --format json',
      args: { query: 'local dev docker compose' },
    },
    {
      intent: 'where are Kubernetes manifests',
      command: 'projscan search "Kubernetes manifests" --format json',
      args: { query: 'Kubernetes manifests' },
    },
    {
      intent: 'find Helm chart for payments',
      command: 'projscan search "payments Helm chart" --format json',
      args: { query: 'payments Helm chart' },
    },
    {
      intent: 'where is Terraform module for S3',
      command: 'projscan search "S3 Terraform module" --format json',
      args: { query: 'S3 Terraform module' },
    },
    {
      intent: 'which GitHub workflow deploys staging',
      command: 'projscan search "staging GitHub workflow" --format json',
      args: { query: 'staging GitHub workflow' },
    },
    {
      intent: 'where is Vercel config',
      command: 'projscan search "Vercel config" --format json',
      args: { query: 'Vercel config' },
    },
    {
      intent: 'where is password reset handled',
      command: 'projscan search "password reset" --format json',
      args: { query: 'password reset' },
    },
    {
      intent: 'where is team invite flow',
      command: 'projscan search "team invite flow" --format json',
      args: { query: 'team invite flow' },
    },
    {
      intent: 'where is onboarding flow implemented',
      command: 'projscan search "onboarding flow" --format json',
      args: { query: 'onboarding flow' },
    },
    {
      intent: 'find CSV export for users',
      command: 'projscan search "users CSV export" --format json',
      args: { query: 'users CSV export' },
    },
    {
      intent: 'what creates audit log entries',
      command: 'projscan search "audit log entries" --format json',
      args: { query: 'audit log entries' },
    },
    {
      intent: 'where is refund handling for payments',
      command: 'projscan search "payments refund handling" --format json',
      args: { query: 'payments refund handling' },
    },
    {
      intent: 'where is subscription renewal handled',
      command: 'projscan search "subscription renewal" --format json',
      args: { query: 'subscription renewal' },
    },
    {
      intent: 'where is welcome email template',
      command: 'projscan search "welcome email template" --format json',
      args: { query: 'welcome email template' },
    },
    {
      intent: 'find password reset email copy',
      command: 'projscan search "password reset email copy" --format json',
      args: { query: 'password reset email copy' },
    },
    {
      intent: 'where is push notification copy for invites',
      command: 'projscan search "invites push notification copy" --format json',
      args: { query: 'invites push notification copy' },
    },
    {
      intent: 'where is SMS verification template',
      command: 'projscan search "SMS verification template" --format json',
      args: { query: 'SMS verification template' },
    },
    {
      intent: 'which template sends receipt email',
      command: 'projscan search "receipt email template" --format json',
      args: { query: 'receipt email template' },
    },
    {
      intent: 'where is invoice PDF generated',
      command: 'projscan search "invoice PDF" --format json',
      args: { query: 'invoice PDF' },
    },
  ];

  for (const { intent, command, tool = 'projscan_search', args, route: expectedRoute } of cases) {
    const { action, route } = primaryActionForIntent(intent);
    if (expectedRoute) {
      expect(route).toEqual(
        expect.objectContaining({
          category: expectedRoute.category,
          tool,
          confidence: expectedRoute.confidence,
          matchedKeywords: expectedRoute.matchedKeywords
            ? expect.arrayContaining(expectedRoute.matchedKeywords)
            : undefined,
        }),
      );
    }
    expect(action).toEqual(expect.objectContaining({ command, tool, args }));
  }
});
