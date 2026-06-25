import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('session resource scan performance', () => {
  it('skips ignored-file counting when loading project signals', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/core/sessionResources.ts'),
      'utf8',
    );

    expect(source).toMatch(
      /scanRepository\(rootPath,\s*\{\s*countIgnoredFiles:\s*false\s*\}\s*\)/s,
    );
  });
});
