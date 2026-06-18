import type { StartRoutedIntent } from '../types/start.js';

const DEPENDENCY_LICENSE_KEYWORDS = [
  'license',
  'licenses',
  'gpl',
  'copyleft',
  'notice',
  'notices',
  'third',
  'party',
  'open',
  'source',
  'compliance',
];

const DEPENDENCY_BUNDLE_KEYWORDS = [
  'bundle',
  'bundles',
  'size',
  'sizes',
  'large',
  'heavy',
  'bloat',
  'bloated',
  'weight',
  'footprint',
  'reduce',
  'slim',
];

export function dependencySuccessCriteria(route: StartRoutedIntent): string[] {
  const criteria: string[] = [];
  if (matchesAnyKeyword(route, DEPENDENCY_LICENSE_KEYWORDS)) {
    criteria.push(
      'Dependency license counts, unknown licenses, and copyleft risks are reviewed before third-party notices or compliance sign-off.',
    );
  }
  if (matchesAnyKeyword(route, DEPENDENCY_BUNDLE_KEYWORDS)) {
    criteria.push(
      'Installed package-size totals and largest packages are reviewed before bundle-size or dependency-bloat work starts.',
    );
  }
  criteria.push(
    'Declared production and development dependencies are inventoried before package changes are planned.',
  );
  criteria.push(
    'Any dependency risks, workspace-specific counts, or missing lockfile signal has an owner or follow-up command.',
  );
  return criteria;
}

function matchesAnyKeyword(route: StartRoutedIntent, keywords: string[]): boolean {
  return route.matchedKeywords.some((keyword) => keywords.includes(keyword));
}
