import { beforeEach, expect, test } from 'vitest';
import { getToolHandler } from '../../src/mcp/tools.js';
import type { StartReport } from '../../src/types/start.js';
import { makeTempProject } from '../helpers/startProject.js';

let tmp: string;
beforeEach(async () => {
  tmp = await makeTempProject();
});

test('projscan_start returns alternative routes for mixed intents', async () => {
  const handler = getToolHandler('projscan_start');
  expect(handler).toBeDefined();

  const result = (await handler?.(
    {
      intent: 'is it safe to commit and what breaks if I rename the auth token loader',
    },
    tmp,
  )) as { start: StartReport };

  expect(result.start.missionControl.routedIntent?.tool).toBe('projscan_impact');
  expect(result.start.mode).toBe('before_commit');
  expect(result.start.modeSource).toBe('intent');
  expect(result.start.missionControl.alternatives?.map((route) => route.tool)).toContain(
    'projscan_preflight',
  );
  expect(result.start.missionControl.alternatives?.[0]).toEqual(
    expect.objectContaining({
      tool: 'projscan_preflight',
      cli: 'projscan preflight',
    }),
  );
});
