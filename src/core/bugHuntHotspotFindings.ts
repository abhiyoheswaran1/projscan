import type { BugHuntFinding, FileHotspot } from '../types.js';

export function hotspotToFinding(hotspot: FileHotspot): BugHuntFinding {
  return {
    id: `bh-hotspot-${slug(hotspot.relativePath)}`,
    priority: hotspot.issueIds.length > 0 ? (hotspot.riskScore >= 70 ? 'p1' : 'p2') : 'p2',
    source: 'hotspot',
    title: `${hotspot.issueIds.length > 0 ? 'Inspect' : 'Watch'} risky hotspot ${hotspot.relativePath}`,
    why: hotspotReviewReason(hotspot),
    files: [hotspot.relativePath],
    evidence: [
      {
        source: 'hotspots',
        message: `risk score ${Math.round(hotspot.riskScore)}`,
        file: hotspot.relativePath,
      },
      ...hotspotOwnershipEvidence(hotspot),
      ...hotspot.issueIds.slice(0, 3).map((issueId) => ({
        source: 'doctor' as const,
        message: `linked issue ${issueId}`,
        issueId,
        file: hotspot.relativePath,
      })),
    ],
    suggestedTools: ['projscan_file', 'projscan_hotspots', 'projscan_impact'],
    verification: {
      commands: [`projscan file ${hotspot.relativePath} --format json`, 'npm test'],
      expected:
        'The hotspot has either lower risk, added regression coverage, or an explicit owner for remaining risk.',
    },
  };
}

function hotspotReviewReason(hotspot: FileHotspot): string {
  const reasons = hotspot.reasons.slice(0, 2);
  const ownershipReason = hotspot.reasons.find((reason) => reason.includes('bus factor'));
  if (ownershipReason && !reasons.includes(ownershipReason)) reasons.push(ownershipReason);
  const owner = formatHotspotOwner(hotspot, { includeBusFactor: !ownershipReason });
  if (owner) reasons.push(owner);
  return (
    [...new Set(reasons)].join('; ') ||
    `Risk score ${Math.round(hotspot.riskScore)} combines churn, complexity, and issue density.`
  );
}

function hotspotOwnershipEvidence(hotspot: FileHotspot): BugHuntFinding['evidence'] {
  const owner = formatHotspotOwner(hotspot);
  if (!owner) return [];
  return [
    {
      source: 'hotspots',
      message: owner,
      file: hotspot.relativePath,
    },
  ];
}

function formatHotspotOwner(
  hotspot: FileHotspot,
  options: { includeBusFactor?: boolean } = {},
): string | null {
  if (!hotspot.primaryAuthor) return null;
  const share =
    hotspot.primaryAuthorShare > 0
      ? ` (${Math.round(hotspot.primaryAuthorShare * 100)}% of hotspot commits)`
      : '';
  const busFactor = options.includeBusFactor && hotspot.busFactorOne ? '; bus factor 1' : '';
  return `primary author ${hotspot.primaryAuthor}${share}${busFactor}`;
}

function slug(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'root'
  );
}
