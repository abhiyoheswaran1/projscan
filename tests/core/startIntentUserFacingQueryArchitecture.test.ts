import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Mission Control user-facing intent query architecture', () => {
  it('keeps authorization search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const authorizationPath = path.join(
      process.cwd(),
      'src/core/startIntentAuthorizationQueries.ts',
    );

    expect(targetSource).toContain(
      "import { extractAuthorizationQuery } from './startIntentAuthorizationQueries.js';",
    );
    expect(targetSource).not.toContain('function extractAuthorizationQuery');
    expect(targetSource).not.toContain('login routes');

    expect(existsSync(authorizationPath)).toBe(true);
    const authorizationSource = readFileSync(authorizationPath, 'utf8');
    expect(authorizationSource).toContain('export function extractAuthorizationQuery');
    expect(authorizationSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps style-system search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const stylePath = path.join(process.cwd(), 'src/core/startIntentStyleSystemQueries.ts');

    expect(targetSource).toContain(
      "import { extractStyleSystemQuery } from './startIntentStyleSystemQueries.js';",
    );
    expect(targetSource).not.toContain('function extractStyleSystemQuery');
    expect(targetSource).not.toContain('Tailwind theme');

    expect(existsSync(stylePath)).toBe(true);
    const styleSource = readFileSync(stylePath, 'utf8');
    expect(styleSource).toContain('export function extractStyleSystemQuery');
    expect(styleSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps navigation layout search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const navigationPath = path.join(
      process.cwd(),
      'src/core/startIntentNavigationLayoutQueries.ts',
    );

    expect(targetSource).toContain(
      "import { extractNavigationLayoutQuery } from './startIntentNavigationLayoutQueries.js';",
    );
    expect(targetSource).not.toContain('function extractNavigationLayoutQuery');
    expect(targetSource).not.toContain('Next.js layout');

    expect(existsSync(navigationPath)).toBe(true);
    const navigationSource = readFileSync(navigationPath, 'utf8');
    expect(navigationSource).toContain('export function extractNavigationLayoutQuery');
    expect(navigationSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps frontend page route search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const frontendRoutePath = path.join(
      process.cwd(),
      'src/core/startIntentFrontendPageRouteQueries.ts',
    );

    expect(targetSource).toContain(
      "import { extractFrontendPageRouteQuery } from './startIntentFrontendPageRouteQueries.js';",
    );
    expect(targetSource).not.toContain('function extractFrontendPageRouteQuery');
    expect(targetSource).not.toContain('not-found page');

    expect(existsSync(frontendRoutePath)).toBe(true);
    const frontendRouteSource = readFileSync(frontendRoutePath, 'utf8');
    expect(frontendRouteSource).toContain('export function extractFrontendPageRouteQuery');
    expect(frontendRouteSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps test data search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const testDataPath = path.join(process.cwd(), 'src/core/startIntentTestDataQueries.ts');

    expect(targetSource).toContain(
      "import { extractTestDataQuery } from './startIntentTestDataQueries.js';",
    );
    expect(targetSource).not.toContain('function extractTestDataQuery');
    expect(targetSource).not.toContain('Storybook stories');

    expect(existsSync(testDataPath)).toBe(true);
    const testDataSource = readFileSync(testDataPath, 'utf8');
    expect(testDataSource).toContain('export function extractTestDataQuery');
    expect(testDataSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps background work search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const backgroundWorkPath = path.join(
      process.cwd(),
      'src/core/startIntentBackgroundWorkQueries.ts',
    );

    expect(targetSource).toContain(
      "import { extractBackgroundWorkQuery } from './startIntentBackgroundWorkQueries.js';",
    );
    expect(targetSource).not.toContain('function extractBackgroundWorkQuery');
    expect(targetSource).not.toContain('function isBackgroundWorkTarget');

    expect(existsSync(backgroundWorkPath)).toBe(true);
    const backgroundWorkSource = readFileSync(backgroundWorkPath, 'utf8');
    expect(backgroundWorkSource).toContain('export function extractBackgroundWorkQuery');
    expect(backgroundWorkSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps observability search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const observabilityPath = path.join(
      process.cwd(),
      'src/core/startIntentObservabilityQueries.ts',
    );

    expect(targetSource).toContain(
      "import { extractObservabilityQuery } from './startIntentObservabilityQueries.js';",
    );
    expect(targetSource).not.toContain('function extractObservabilityQuery');
    expect(targetSource).not.toContain('function isObservabilityTarget');

    expect(existsSync(observabilityPath)).toBe(true);
    const observabilitySource = readFileSync(observabilityPath, 'utf8');
    expect(observabilitySource).toContain('export function extractObservabilityQuery');
    expect(observabilitySource).not.toContain("from './startIntentTargets.js'");
  });
});
