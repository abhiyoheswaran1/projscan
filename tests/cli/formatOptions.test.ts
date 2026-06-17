import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertCliFormatSupported,
  resolveCliFormat,
  type CliFormatFailure,
} from '../../src/cli/formatOptions.js';

describe('CLI format options', () => {
  it('resolves known output formats', () => {
    expect(resolveCliFormat('json', failWithMessages)).toBe('json');
    expect(resolveCliFormat('console', failWithMessages)).toBe('console');
  });

  it('reports unsupported global formats with the supported format list', () => {
    expect(() => resolveCliFormat('xml', failWithMessages)).toThrowError(
      'Unsupported --format xml.\nSupported formats: console, json, markdown, sarif, html',
    );
  });

  it('reports command-specific format support', () => {
    expect(assertCliFormatSupported('start', 'json', failWithMessages)).toBe('json');
    expect(() => assertCliFormatSupported('start', 'markdown', failWithMessages)).toThrowError(
      'projscan start does not support --format markdown.\nSupported formats: console, json',
    );
  });

  it('keeps format option logic out of the shared CLI orchestrator', () => {
    const sharedSource = readFileSync(path.join(process.cwd(), 'src/cli/_shared.ts'), 'utf8');
    expect(sharedSource).not.toContain('OUTPUT_FORMATS');
    expect(sharedSource).not.toContain('getCommandFormatSupport');
    expect(sharedSource).toContain("from './formatOptions.js'");

    const formatOptionsSource = readFileSync(
      path.join(process.cwd(), 'src/cli/formatOptions.ts'),
      'utf8',
    );
    expect(formatOptionsSource).not.toContain("from './_shared.js'");
  });
});

const failWithMessages: CliFormatFailure = (messages) => {
  throw new Error(messages.join('\n'));
};
