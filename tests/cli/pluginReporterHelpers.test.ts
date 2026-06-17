import { describe, expect, it } from 'vitest';
import {
  isPluginReporterName,
  pluginReporterDiagnosticLines,
  pluginReporterFormatError,
} from '../../src/cli/pluginReporter.js';

describe('plugin reporter CLI helpers', () => {
  it('accepts only non-empty reporter names', () => {
    expect(isPluginReporterName('team-summary')).toBe(true);
    expect(isPluginReporterName('')).toBe(false);
    expect(isPluginReporterName(undefined)).toBe(false);
  });

  it('formats reporter conflict and diagnostic messages', () => {
    expect(pluginReporterFormatError('json')).toBe(
      '--reporter cannot be combined with --format json',
    );
    expect(
      pluginReporterDiagnosticLines({
        code: 'plugin-untrusted',
        message: 'not trusted',
        hint: 'projscan plugin trust team-summary',
      }),
    ).toEqual(['[plugin-untrusted] not trusted', 'hint: projscan plugin trust team-summary']);
    expect(
      pluginReporterDiagnosticLines({
        code: 'reporter-load-error',
        message: 'unable to load reporter',
      }),
    ).toEqual(['[reporter-load-error] unable to load reporter']);
  });
});
