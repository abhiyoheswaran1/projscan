import type { Issue, IssueLocation, IssueSeverity } from '../types.js';

const TOOL_INFO = {
  name: 'projscan',
  informationUri: 'https://github.com/abhiyoheswaran1/projscan',
  shortDescription: {
    text: 'Instant codebase insights — doctor, x-ray, and architecture map.',
  },
};

const SEVERITY_TO_LEVEL: Record<IssueSeverity, 'error' | 'warning' | 'note'> = {
  error: 'error',
  warning: 'warning',
  info: 'note',
};

export interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  helpUri?: string;
  defaultConfiguration?: { level: 'error' | 'warning' | 'note' };
}

export interface SarifResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note';
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region?: { startLine: number; startColumn?: number; endLine?: number; endColumn?: number };
    };
  }>;
  properties?: Record<string, unknown>;
}

export interface SarifRun {
  tool: {
    driver: {
      name: string;
      version: string;
      informationUri: string;
      shortDescription: { text: string };
      rules: SarifRule[];
    };
  };
  results: SarifResult[];
}

export interface SarifLog {
  $schema: string;
  version: '2.1.0';
  runs: SarifRun[];
}

/**
 * Convert projscan issues into a SARIF 2.1.0 log. GitHub Code Scanning
 * requires every result to have at least one location, so issues without
 * explicit `locations` are anchored to the repository root (".").
 */
export function issuesToSarif(issues: Issue[], version: string): SarifLog {
  const rules = buildRules(issues);
  const results = issues.map((issue) => toResult(issue));

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: TOOL_INFO.name,
            version,
            informationUri: TOOL_INFO.informationUri,
            shortDescription: TOOL_INFO.shortDescription,
            rules,
          },
        },
        results,
      },
    ],
  };
}

function buildRules(issues: Issue[]): SarifRule[] {
  const byId = new Map<string, SarifRule>();
  for (const issue of issues) {
    if (byId.has(issue.id)) continue;
    byId.set(issue.id, {
      id: issue.id,
      name: toRuleName(issue.id),
      shortDescription: { text: issue.title },
      defaultConfiguration: { level: SEVERITY_TO_LEVEL[issue.severity] },
    });
  }
  return [...byId.values()];
}

function toRuleName(id: string): string {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function toResult(issue: Issue): SarifResult {
  const locations = (issue.locations && issue.locations.length > 0
    ? issue.locations
    : [{ file: '.' } as IssueLocation]
  ).map((loc) => ({
    physicalLocation: {
      artifactLocation: { uri: toPosix(loc.file) },
      ...(loc.line !== undefined
        ? {
            region: {
              startLine: loc.line,
              ...(loc.column !== undefined ? { startColumn: loc.column } : {}),
              ...(loc.endLine !== undefined ? { endLine: loc.endLine } : {}),
              ...(loc.endColumn !== undefined ? { endColumn: loc.endColumn } : {}),
            },
          }
        : {}),
    },
  }));

  return {
    ruleId: issue.id,
    level: SEVERITY_TO_LEVEL[issue.severity],
    message: { text: issue.description || issue.title },
    locations,
    properties: {
      category: issue.category,
      ...(issue.fixAvailable ? { fixAvailable: true, fixId: issue.fixId } : {}),
    },
  };
}

function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

export function reportAnalysisSarif(issues: Issue[], version: string): void {
  console.log(JSON.stringify(issuesToSarif(issues, version), null, 2));
}

export function reportHealthSarif(issues: Issue[], version: string): void {
  console.log(JSON.stringify(issuesToSarif(issues, version), null, 2));
}

export function reportCiSarif(issues: Issue[], version: string): void {
  console.log(JSON.stringify(issuesToSarif(issues, version), null, 2));
}
