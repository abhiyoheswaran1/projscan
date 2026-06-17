import { describe, expect, it } from 'vitest';
import {
  configErrorMessage,
  explicitConfigPath,
  projectConfigSourceNotice,
} from '../../src/cli/projectConfig.js';

describe('project config CLI helpers', () => {
  it('accepts only string explicit config paths', () => {
    expect(explicitConfigPath('.projscanrc.json')).toBe('.projscanrc.json');
    expect(explicitConfigPath(undefined)).toBeUndefined();
    expect(explicitConfigPath(false)).toBeUndefined();
  });

  it('formats config source and error notices', () => {
    expect(projectConfigSourceNotice('/repo', '/repo/.projscanrc.json')).toBe(
      '  [config: .projscanrc.json]',
    );
    expect(projectConfigSourceNotice('/repo', undefined)).toBeNull();
    expect(projectConfigSourceNotice('/repo', null)).toBeNull();
    expect(configErrorMessage(new Error('bad config'))).toBe('  Config error: bad config');
    expect(configErrorMessage('not parseable')).toBe('  Config error: not parseable');
  });
});
