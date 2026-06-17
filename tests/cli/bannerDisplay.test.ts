import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { bannerErrorMessage, renderCliBanner, shouldRenderCliBanner } from '../../src/cli/bannerDisplay.js';

describe('bannerDisplay', () => {
  it('renders banners only for non-quiet console output', () => {
    expect(shouldRenderCliBanner({ quiet: false, format: 'console' })).toBe(true);
    expect(shouldRenderCliBanner({ quiet: true, format: 'console' })).toBe(false);
    expect(shouldRenderCliBanner({ quiet: false, format: 'json' })).toBe(false);
  });

  it('delegates rendering when the banner should be shown', () => {
    let calls = 0;

    renderCliBanner({ quiet: false, format: 'console' }, () => {
      calls++;
    });

    expect(calls).toBe(1);
  });

  it('writes a compact error when banner rendering fails', () => {
    const errors: string[] = [];

    renderCliBanner(
      { quiet: false, format: 'console' },
      () => {
        throw new Error('no tty');
      },
      (message) => errors.push(message),
    );

    expect(errors).toEqual([expect.stringContaining('[banner error: no tty]')]);
  });

  it('keeps banner error handling out of the shared CLI orchestrator', () => {
    const sharedSource = readFileSync(path.join(process.cwd(), 'src/cli/_shared.ts'), 'utf8');
    expect(sharedSource).not.toContain('[banner error:');
    expect(sharedSource).not.toContain('catch (err)');

    const displaySource = readFileSync(
      path.join(process.cwd(), 'src/cli/bannerDisplay.ts'),
      'utf8',
    );
    expect(displaySource).not.toContain("from './_shared.js'");
  });
});

describe('bannerErrorMessage', () => {
  it('normalizes non-error throws', () => {
    expect(bannerErrorMessage('bad')).toBe('  [banner error: bad]');
  });
});
