import { expectTypeOf, test } from 'vitest';
import type { SimulateReport } from '../../src/types.js';

test('SimulateReport is part of the public type barrel', () => {
  expectTypeOf<SimulateReport>().toMatchTypeOf<{
    schemaVersion: 1;
    plan: string;
    verdict: 'worth-doing' | 'needs-more-evidence' | 'not-worth-it-yet';
    filesLikelyTouched: Array<{ path: string; reasons: string[] }>;
    testsLikelyAffected: string[];
    contractsLikelyAffected: string[];
    rolloutPlan: Array<{ title: string; commands: string[] }>;
    proofCommands: string[];
  }>();
});

