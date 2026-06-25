import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Mission Control user-facing intent query architecture', () => {
  it('keeps user-facing domain search query parsing in focused helpers', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const searchSource = readFileSync(
      path.join(process.cwd(), 'src/core/startSearchQueryTargets.ts'),
      'utf8',
    );
    const domainSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentDomainSearchQueries.ts'),
      'utf8',
    );

    expect(searchSource).toContain(
      "import { searchQueryFromDomainSignals } from './startIntentDomainSearchQueries.js';",
    );
    expect(targetSource).not.toContain('searchQueryFromDomainSignals');

    const helperCases = [
      {
        module: 'startIntentAuthorizationQueries',
        exportName: 'extractAuthorizationQuery',
        forbidden: ['login routes'],
      },
      {
        module: 'startIntentStyleSystemQueries',
        exportName: 'extractStyleSystemQuery',
        forbidden: ['Tailwind theme'],
      },
      {
        module: 'startIntentNavigationLayoutQueries',
        exportName: 'extractNavigationLayoutQuery',
        forbidden: ['Next.js layout'],
      },
      {
        module: 'startIntentFrontendPageRouteQueries',
        exportName: 'extractFrontendPageRouteQuery',
        forbidden: ['not-found page'],
      },
      {
        module: 'startIntentTestDataQueries',
        exportName: 'extractTestDataQuery',
        forbidden: ['Storybook stories'],
      },
      {
        module: 'startIntentBackgroundWorkQueries',
        exportName: 'extractBackgroundWorkQuery',
        forbidden: ['function isBackgroundWorkTarget'],
      },
      {
        module: 'startIntentObservabilityQueries',
        exportName: 'extractObservabilityQuery',
        forbidden: ['function isObservabilityTarget'],
      },
    ];

    for (const helper of helperCases) {
      const helperPath = path.join(process.cwd(), 'src/core', `${helper.module}.ts`);
      expect(domainSource).toContain(
        `import { ${helper.exportName} } from './${helper.module}.js';`,
      );
      expect(targetSource).not.toContain(`function ${helper.exportName}`);
      for (const forbidden of helper.forbidden) expect(targetSource).not.toContain(forbidden);

      expect(existsSync(helperPath)).toBe(true);
      const helperSource = readFileSync(helperPath, 'utf8');
      expect(helperSource).toContain(`export function ${helper.exportName}`);
      expect(helperSource).not.toContain("from './startIntentTargets.js'");
    }
  });
});
