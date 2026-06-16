import { describe, expect, it } from 'vitest';
import { buildStartNextActions } from '../../src/core/startNextActions.js';
import type { StartReport } from '../../src/types/start.js';
import type { WorkplanReport } from '../../src/types/workplan.js';
import type { QualityScorecardReport } from '../../src/types/qualityScorecard.js';

describe('buildStartNextActions', () => {
  it('keeps the primary action first and dedupes follow-up commands', () => {
    const nextActions = buildStartNextActions({
      missionControl: {
        primaryAction: {
          label: 'Run routed action',
          command: 'projscan search auth --format json',
        },
      } as StartReport['missionControl'],
      firstTenMinutes: {
        commands: [{ label: 'Safety gate', command: 'projscan preflight --format json' }],
      } as StartReport['firstTenMinutes'],
      workflow: {
        name: 'Before edit',
        commands: ['projscan preflight --format json'],
      } as StartReport['recommendedWorkflow'],
      adoptionLoop: {
        nextCommands: ['projscan evidence-pack --pr-comment'],
      } as StartReport['adoptionLoop'],
      workplan: {
        suggestedNextActions: [
          { label: 'Duplicate primary', command: 'projscan search auth --format json' },
        ],
      } as WorkplanReport,
      quality: {
        suggestedNextActions: [{ label: 'Run quality gate', command: 'projscan doctor' }],
      } as QualityScorecardReport,
    });

    expect(nextActions.map((action) => action.command)).toEqual([
      'projscan search auth --format json',
      'projscan preflight --format json',
      'projscan evidence-pack --pr-comment',
      'projscan doctor',
    ]);
    expect(nextActions[1].label).toBe('First 10 minutes: Safety gate');
  });
});
