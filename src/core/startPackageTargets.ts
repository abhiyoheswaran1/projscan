export function extractPackageTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const wrapped = compactIntent.match(/[`'"](@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)[`'"]/);
  if (wrapped?.[1] && isPackageNameTarget(wrapped[1])) return normalizePackageName(wrapped[1]);

  const actionMatch = compactIntent.match(
    /\b(?:bump|upgrade|update|remove|drop|uninstall)\s+(?:the\s+)?(?:(?:package|dependency)\s+)?(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)(?=\s|$)/i,
  );
  if (actionMatch?.[1] && isPackageNameTarget(actionMatch[1]))
    return normalizePackageName(actionMatch[1]);

  const removalSubject = compactIntent.match(
    /\b(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\s+(?:safe\s+to\s+)?(?:remove|drop|uninstall)\b/i,
  );
  if (removalSubject?.[1] && isPackageNameTarget(removalSubject[1]))
    return normalizePackageName(removalSubject[1]);

  const labeled = compactIntent.match(
    /\b(?:package|dependency)\s+(?:named\s+|called\s+)?(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)(?=\s|$)/i,
  );
  if (labeled?.[1] && isPackageNameTarget(labeled[1])) return normalizePackageName(labeled[1]);

  return undefined;
}

export function extractAuditPackageTarget(intent: string): string | undefined {
  const packageName = extractPackageTarget(intent);
  if (packageName) return packageName;

  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
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
