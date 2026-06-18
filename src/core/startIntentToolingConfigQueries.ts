export function extractToolingConfigQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  if (
    /\b(?:why|failing|failed|failure|failures|broken|error|errors|runtime|production|prod|outage|incident)\b/i.test(
      compactIntent,
    )
  ) {
    return undefined;
  }
  return toolingConfigFromRules(compactIntent) ?? lockfileQuery(compactIntent);
}

const TOOLING_CONFIG_RULES: Array<{ pattern: RegExp; query: string }> = [
  {
    pattern: /\btsconfig\b(?=.*\b(?:path|paths|alias|aliases)\b)/i,
    query: 'tsconfig path aliases',
  },
  { pattern: /\bvitest\b(?=.*\bconfig(?:uration)?\b)/i, query: 'Vitest config' },
  { pattern: /\bjest\b(?=.*\bconfig(?:uration)?\b)/i, query: 'Jest config' },
  { pattern: /\bbabel\b(?=.*\bconfig(?:uration)?\b)/i, query: 'Babel config' },
  { pattern: /\bwebpack\b(?=.*\bconfig(?:uration)?\b)/i, query: 'webpack config' },
  { pattern: /\bpackage\s+manager\b/i, query: 'package manager' },
  { pattern: /\bpnpm\s+workspaces?\b/i, query: 'pnpm workspace' },
  { pattern: /\byarn\s+workspaces?\b/i, query: 'yarn workspace' },
];

function toolingConfigFromRules(compactIntent: string): string | undefined {
  return TOOLING_CONFIG_RULES.find((rule) => rule.pattern.test(compactIntent))?.query;
}

function lockfileQuery(compactIntent: string): string | undefined {
  if (/\b(?:npm|pnpm|yarn)\s+lockfiles?\b/i.test(compactIntent)) {
    const manager = compactIntent.match(/\b(npm|pnpm|yarn)\b/i)?.[1]?.toLowerCase();
    return manager ? `${manager} lockfile` : 'lockfile';
  }
  return undefined;
}
