import type { StartRoutedIntent } from '../types/start.js';

interface FileCriteriaRule {
  keywords?: string[];
  matches?: (matched: Set<string>) => boolean;
  criterion: string;
}

const FILE_CRITERIA_RULES: FileCriteriaRule[] = [
  {
    keywords: ['risk', 'risks', 'risky', 'dangerous'],
    criterion:
      'Hotspot reasons, related issues, imports, exports, and ownership explain why the file is risky.',
  },
  {
    keywords: [
      'last',
      'touched',
      'touch',
      'changed',
      'recently',
      'history',
      'author',
      'authors',
      'blame',
    ],
    criterion:
      'Primary author, recent history, and ownership signals are reviewed before routing reviewers or changing the file.',
  },
  {
    keywords: ['coverage', 'covered', 'uncovered', 'test', 'tests'],
    criterion:
      'Coverage, hotspot risk, and related test evidence for the file are reviewed before editing starts.',
  },
  {
    matches: matchesFileTestDesignCriteria,
    criterion:
      'File purpose, risky functions, coverage, and existing test evidence are reviewed before designing a new test.',
  },
  {
    keywords: ['read'],
    criterion:
      'Purpose, imports, exports, ownership, tests, and risk are reviewed before changing the named file.',
  },
  {
    keywords: ['review', 'reviewer', 'reviewers'],
    criterion:
      'Ownership, primary author, hotspot risk, and related issues are reviewed before choosing a reviewer.',
  },
];

export function fileSuccessCriteria(route: StartRoutedIntent): string[] {
  const matched = new Set(route.matchedKeywords);
  return [
    ...FILE_CRITERIA_RULES.filter((rule) => fileCriteriaRuleMatches(rule, matched)).map(
      (rule) => rule.criterion,
    ),
    'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
    'Any follow-up impact, owner, or test command from the file report is added to the workplan.',
  ];
}

function fileCriteriaRuleMatches(rule: FileCriteriaRule, matched: Set<string>): boolean {
  if (rule.matches) return rule.matches(matched);
  return (rule.keywords ?? []).some((keyword) => matched.has(keyword));
}

function matchesFileTestDesignCriteria(matched: Set<string>): boolean {
  const explicitAuthoring = ['add', 'write'].some((keyword) => matched.has(keyword));
  const testWithoutCoverage =
    matched.has('test') &&
    !['coverage', 'covered', 'uncovered'].some((keyword) => matched.has(keyword));
  return explicitAuthoring || testWithoutCoverage;
}
