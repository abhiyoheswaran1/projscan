import { describe, expect, it } from 'vitest';

import { isReviewBlockingFlow } from '../../src/core/reviewDataflow.js';

describe('review dataflow filters', () => {
  const defaultContext = { customSources: new Set<string>(), customSinks: new Set<string>() };

  it('does not block explicit telemetry opt-in config and queue storage flows', () => {
    const files = ['src/cli/commands/init.ts', 'src/core/telemetry.ts', 'src/core/telemetryConfig.ts'];

    expect(
      isReviewBlockingFlow({ source: 'stdin', sink: 'writeFile', files }, defaultContext),
    ).toBe(false);
    expect(isReviewBlockingFlow({ source: 'stdin', sink: 'rm', files }, defaultContext)).toBe(
      false,
    );
  });

  it('still blocks unrelated stdin to filesystem flows', () => {
    expect(
      isReviewBlockingFlow(
        { source: 'stdin', sink: 'writeFile', files: ['src/cli/commands/deploy.ts'] },
        defaultContext,
      ),
    ).toBe(true);
  });
});
