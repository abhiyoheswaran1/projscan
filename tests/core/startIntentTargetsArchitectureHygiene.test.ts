import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Mission Control intent target architecture hygiene', () => {
  it('keeps the main architecture guard file small enough to review', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'tests/core/startIntentTargetsArchitecture.test.ts'),
      'utf8',
    );

    expect(source.split(/\r?\n/).length).toBeLessThanOrEqual(450);
  });
});
