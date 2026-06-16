import { expect, test } from 'vitest';
import '../../src/types/workplanHandoff.js';
import type { PreflightVerdict } from '../../src/types/preflight.js';
import type { WorkplanCoordination, WorkplanMode } from '../../src/types/workplan.js';
import type { WorkplanHandoffPayload } from '../../src/types/workplanHandoff.js';
import type {
  WorkplanCoordination as BarrelWorkplanCoordination,
  WorkplanHandoffPayload as BarrelWorkplanHandoffPayload,
} from '../../src/types.js';

const verdict: WorkplanHandoffPayload['verdict'] = 'caution';
const preflightVerdict: PreflightVerdict = verdict;

const mode: WorkplanHandoffPayload['mode'] = 'before_merge';
const workplanMode: WorkplanMode = mode;

const coordination: WorkplanCoordination = {
  touchedFiles: ['src/types.ts'],
  conflicts: [
    {
      kind: 'same-file',
      files: ['src/types.ts'],
      message: 'Workplan handoff public type moved out of the legacy barrel.',
      severity: 'warning',
    },
  ],
  recommendedNextAgent: 'Run public typecheck before handoff.',
};
const payloadCoordination: WorkplanHandoffPayload['coordination'] = coordination;
const moduleCoordination: WorkplanCoordination = payloadCoordination;
const barrelCoordination: BarrelWorkplanCoordination = payloadCoordination;

const payload: WorkplanHandoffPayload = {
  summary: 'Public workplan handoff type compiles from a focused module.',
  verdict,
  mode,
  next: ['Review the focused module import.'],
  verificationCommands: ['npm run typecheck:public-types'],
  coordination,
  markdown: '## Handoff\n\nRun focused type checks before handoff.',
};

const barrelPayload: BarrelWorkplanHandoffPayload = payload;
const modulePayload: WorkplanHandoffPayload = barrelPayload;

void [preflightVerdict, workplanMode, moduleCoordination, barrelCoordination];

test('workplan handoff public type compiles from the module and legacy barrel', () => {
  expect(modulePayload.verdict).toBe('caution');
  expect(modulePayload.mode).toBe('before_merge');
  expect(modulePayload.next).toEqual(['Review the focused module import.']);
  expect(modulePayload.verificationCommands).toEqual(['npm run typecheck:public-types']);
  expect(modulePayload.coordination.recommendedNextAgent).toBe(
    'Run public typecheck before handoff.',
  );
  expect(modulePayload.markdown).toContain('## Handoff');
});
