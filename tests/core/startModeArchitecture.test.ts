import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('start mode architecture', () => {
  it('keeps intent regex policy in a focused helper', () => {
    const startModeSource = readSource('src/core/startMode.ts');
    const intentPolicyPath = path.join(process.cwd(), 'src/core/startModeIntentPolicy.ts');

    expect(startModeSource).toContain("from './startModeIntentPolicy.js';");
    expect(startModeSource).toContain(
      "export { hasProhibitedWorkflowModeAction, preflightModeFromIntent } from './startModeIntentPolicy.js';",
    );
    expect(startModeSource).not.toContain('function preflightModeFromIntent');
    expect(startModeSource).not.toContain('function hasPreflightModeHint');
    expect(startModeSource).not.toContain('function hasProhibitedWorkflowModeAction');
    expect(startModeSource).not.toContain('function releaseCandidateReviewIntentMatches');

    expect(existsSync(intentPolicyPath)).toBe(true);
    const intentPolicySource = readFileSync(intentPolicyPath, 'utf8');
    expect(intentPolicySource).toContain('export function preflightModeFromIntent');
    expect(intentPolicySource).toContain('export function hasProhibitedWorkflowModeAction');
    expect(intentPolicySource).toContain('export function hasPreflightModeHint');
    expect(intentPolicySource).toContain('export function releaseCandidateReviewIntentMatches');
    expect(intentPolicySource).not.toContain("from './startMode.js'");
  });

  it('keeps workflow routing resolvers in a focused helper', () => {
    const startModeSource = readSource('src/core/startMode.ts');
    const routingPolicyPath = path.join(process.cwd(), 'src/core/startModeRoutingPolicy.ts');

    expect(startModeSource).toContain("from './startModeRoutingPolicy.js';");
    expect(startModeSource).not.toContain('function releaseMode');
    expect(startModeSource).not.toContain('function bugHuntMode');
    expect(startModeSource).not.toContain('function evidencePackMode');
    expect(startModeSource).not.toContain('function fallbackPreflightMode');

    expect(existsSync(routingPolicyPath)).toBe(true);
    const routingPolicySource = readFileSync(routingPolicyPath, 'utf8');
    expect(routingPolicySource).toContain('export function inferModeFromStartRoutes');
    expect(routingPolicySource).toContain('export function routesForStartIntent');
    expect(routingPolicySource).toContain('function releaseMode');
    expect(routingPolicySource).toContain('function fallbackPreflightMode');
    expect(routingPolicySource).not.toContain("from './startMode.js'");
  });
});

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}
