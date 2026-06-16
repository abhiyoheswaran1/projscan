import { describe, it, expect } from 'vitest';
import {
  REMOVAL_VERSION,
  deprecationDescriptionPrefix,
  formatCliDeprecationNotice,
} from '../../src/core/deprecations.js';

describe('deprecationDescriptionPrefix', () => {
  it('renders a machine-and-human readable [DEPRECATED ...] prefix with a trailing space', () => {
    const prefix = deprecationDescriptionPrefix({ since: '3.8.0', replacedBy: 'projscan_file' });
    expect(prefix).toBe(
      `[DEPRECATED since 3.8.0, removed in ${REMOVAL_VERSION} — use projscan_file] `,
    );
    expect(prefix.endsWith(' ')).toBe(true);
  });
});

describe('formatCliDeprecationNotice', () => {
  it('names the command, the since/removal versions, and the replacement', () => {
    const notice = formatCliDeprecationNotice('explain', {
      since: '3.8.0',
      replacedBy: 'projscan file',
    });
    expect(notice).toMatch(/projscan explain/);
    expect(notice).toMatch(/deprecated/i);
    expect(notice).toMatch(/3\.8\.0/);
    expect(notice).toMatch(new RegExp(REMOVAL_VERSION.replace('.', '\\.')));
    expect(notice).toMatch(/projscan file/);
  });

  it('appends the note when present', () => {
    const notice = formatCliDeprecationNotice('explain', {
      since: '3.8.0',
      replacedBy: 'projscan file',
      note: 'file is a strict superset.',
    });
    expect(notice).toMatch(/file is a strict superset\./);
  });
});
