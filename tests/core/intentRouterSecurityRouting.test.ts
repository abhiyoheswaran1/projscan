import { describe, expect, it } from 'vitest';
import { routeIntent } from '../../src/core/intentRouter.js';

describe('routeIntent security routing', () => {
  it('routes PII and GDPR data-handling questions to dataflow hardening', () => {
    const pii = routeIntent('where is PII handled');

    expect(pii.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Security',
        tool: 'projscan_dataflow',
        cli: 'projscan dataflow',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['pii', 'handled']),
      }),
    );

    const leak = routeIntent('does this endpoint leak PII');
    expect(leak.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dataflow',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['leak', 'pii']),
      }),
    );

    const gdpr = routeIntent('GDPR compliance check');
    expect(gdpr.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dataflow',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['gdpr', 'compliance']),
      }),
    );
    expect(gdpr.matches.find((match) => match.tool === 'projscan_dependencies')).toBeUndefined();

    const tokens = routeIntent('where do we store access tokens');
    expect(tokens.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dataflow',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['store', 'tokens']),
      }),
    );
  });
});
