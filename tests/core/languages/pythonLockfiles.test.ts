import { describe, it, expect } from 'vitest';
import {
  parseCondaLock,
  parsePdmLock,
  parsePipfileLock,
  parsePoetryLock,
  parseUvLock,
} from '../../../src/core/languages/pythonManifests.js';

describe('parsePoetryLock', () => {
  it('reads package versions from poetry.lock package blocks', () => {
    const lock = [
      '[[package]]',
      'name = "requests"',
      'version = "2.31.0"',
      'description = "Python HTTP for Humans."',
      '',
      '[[package]]',
      'name = "Django"',
      'version = "4.2.1"',
    ].join('\n');

    expect(parsePoetryLock(lock, 'poetry.lock')).toEqual([
      { name: 'requests', version: '2.31.0', source: 'poetry.lock', line: 3 },
      { name: 'Django', version: '4.2.1', source: 'poetry.lock', line: 8 },
    ]);
  });
});

describe('parsePipfileLock', () => {
  it('reads exact package versions from default and develop sections', () => {
    const lock = JSON.stringify({
      default: {
        requests: { version: '==2.31.0' },
        flask: { version: '==3.0.0' },
      },
      develop: {
        pytest: { version: '==8.2.0' },
        loose: { version: '>=1.0' },
      },
    });

    expect(parsePipfileLock(lock, 'Pipfile.lock')).toEqual([
      { name: 'requests', version: '2.31.0', source: 'Pipfile.lock', line: 0 },
      { name: 'flask', version: '3.0.0', source: 'Pipfile.lock', line: 0 },
      { name: 'pytest', version: '8.2.0', source: 'Pipfile.lock', line: 0 },
    ]);
  });

  it('returns no locked dependencies for malformed Pipfile.lock JSON', () => {
    expect(parsePipfileLock('{not json', 'Pipfile.lock')).toEqual([]);
  });
});

describe('parseUvLock', () => {
  it('reads package versions from uv.lock package blocks', () => {
    const lock = [
      'version = 1',
      '[[package]]',
      'name = "requests"',
      'version = "2.31.0"',
      'source = { registry = "https://pypi.org/simple" }',
      '[[package]]',
      'name = "Django"',
      'version = "4.2.1"',
    ].join('\n');

    expect(parseUvLock(lock, 'uv.lock')).toEqual([
      { name: 'requests', version: '2.31.0', source: 'uv.lock', line: 4 },
      { name: 'Django', version: '4.2.1', source: 'uv.lock', line: 8 },
    ]);
  });
});

describe('parsePdmLock', () => {
  it('reads package versions from pdm.lock package blocks', () => {
    const lock = [
      '[metadata]',
      'lock_version = "4.5.0"',
      '[[package]]',
      'name = "requests"',
      'version = "2.31.0"',
      '[[package]]',
      'name = "Django"',
      'version = "4.2.1"',
    ].join('\n');

    expect(parsePdmLock(lock, 'pdm.lock')).toEqual([
      { name: 'requests', version: '2.31.0', source: 'pdm.lock', line: 5 },
      { name: 'Django', version: '4.2.1', source: 'pdm.lock', line: 8 },
    ]);
  });
});

describe('parseCondaLock', () => {
  it('reads package versions from conda-lock package entries', () => {
    const lock = [
      'version: 1',
      'metadata:',
      '  platforms:',
      '    - linux-64',
      'package:',
      '  - name: requests',
      '    version: "2.31.0"',
      '    manager: conda',
      '  - manager: pip',
      '    name: charset-normalizer',
      '    version: 3.3.2',
    ].join('\n');

    expect(parseCondaLock(lock, 'conda-lock.yml')).toEqual([
      { name: 'requests', version: '2.31.0', source: 'conda-lock.yml', line: 7 },
      {
        name: 'charset-normalizer',
        version: '3.3.2',
        source: 'conda-lock.yml',
        line: 11,
      },
    ]);
  });
});
