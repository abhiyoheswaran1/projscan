interface PackageTargetPattern {
  pattern: RegExp;
  skip?: (target: string, intent: string) => boolean;
}

const PACKAGE_TARGET_PATTERNS: PackageTargetPattern[] = [
  { pattern: /[`'"](@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)[`'"]/ },
  {
    pattern:
      /\b(?:bump|upgrade|update|remove|drop|uninstall)\s+(?:the\s+)?(?:(?:package|dependency)\s+)?(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)(?=\s|$)/i,
    skip: isPythonUpgradeCoverageTopic,
  },
  {
    pattern:
      /\b(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\s+(?:safe\s+to\s+)?(?:remove|drop|uninstall)\b/i,
  },
  {
    pattern:
      /\b(?:package|dependency)\s+(?:named\s+|called\s+)?(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)(?=\s|$)/i,
  },
];

export function extractPackageTarget(intent: string): string | undefined {
  return firstPackageTarget(compactIntentTargetText(intent), PACKAGE_TARGET_PATTERNS);
}

export function extractAuditPackageTarget(intent: string): string | undefined {
  const packageName = extractPackageTarget(intent);
  if (packageName) return packageName;

  const compactIntent = compactIntentTargetText(intent);
  const subject = compactIntent.match(
    /\b(?:does|is|can)\s+(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\s+(?:have|has|contain|contains|affected|vulnerable|secure|safe)\b/i,
  );
  if (subject?.[1] && isPackageNameTarget(subject[1])) return normalizePackageName(subject[1]);

  const command = compactIntent.match(
    /\b(?:audit|check|scan)\s+(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\s+(?:for\s+)?(?:cve|cves|vulnerabilities|vulnerability|security)\b/i,
  );
  if (command?.[1] && isPackageNameTarget(command[1])) return normalizePackageName(command[1]);

  return undefined;
}

function compactIntentTargetText(intent: string): string {
  return intent.trim().replace(/[?!\s]+$/g, '');
}

function firstPackageTarget(
  compactIntent: string,
  patterns: PackageTargetPattern[],
): string | undefined {
  for (const { pattern, skip } of patterns) {
    const target = compactIntent.match(pattern)?.[1];
    if (!target || skip?.(target, compactIntent) || !isPackageNameTarget(target)) continue;
    return normalizePackageName(target);
  }
  return undefined;
}

function isPythonUpgradeCoverageTopic(target: string, intent: string): boolean {
  return (
    target.toLowerCase() === 'coverage' &&
    /\b(?:upgrade|upgrading|bump|update)\s+coverage\b/i.test(intent) &&
    /\b(?:python|poetry|pyproject|requirements?|pip|pipenv|pinned)\b/i.test(intent)
  );
}

export function isPackageNameTarget(target: string): boolean {
  const lower = target.toLowerCase();
  if (
    [
      'package',
      'dependency',
      'dependencies',
      'version',
      'latest',
      'upgrade',
      'bump',
      'update',
      'for',
      'doc',
      'docs',
      'document',
      'documentation',
      'documented',
      'readme',
      'changelog',
      'example',
      'examples',
      'guide',
      'should',
      'could',
      'would',
      'can',
      'what',
      'which',
      'the',
      'this',
      'that',
      'it',
      'my',
    ].includes(lower)
  )
    return false;
  if (target.length === 0 || target.length > 214 || target !== target.trim()) return false;
  if (target.includes('..') || target.includes('\\')) return false;
  return /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i.test(target);
}

export function normalizePackageName(target: string): string {
  return target.toLowerCase();
}
