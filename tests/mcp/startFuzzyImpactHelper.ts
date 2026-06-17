import { getToolHandler } from '../../src/mcp/tools.js';
import type { StartReport } from '../../src/types/start.js';

export const expectedReviewDecisionReplies = [
  'Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version.',
  'Changes requested: address the review feedback first, update proof, then stop for another review.',
  'Prepare a version-candidate review only. Do not publish, deploy, push, merge, or bump the version.',
];

export async function runFuzzyImpactStart(rootPath: string): Promise<StartReport> {
  const handler = getToolHandler('projscan_start');
  if (!handler) {
    throw new Error('projscan_start handler is not registered');
  }

  const result = (await handler(
    {
      intent: 'what breaks if I rename the auth token loader',
    },
    rootPath,
  )) as { start: StartReport };

  return result.start;
}
