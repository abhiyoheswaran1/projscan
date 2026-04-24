import { describe, it, expect } from 'vitest';
import { pythonAdapter } from '../../../src/core/languages/pythonAdapter.js';

describe('pythonAdapter.parse — skeleton bring-up', () => {
  it('loads the grammar and parses a trivial module', async () => {
    const result = await pythonAdapter.parse('x.py', 'x = 1\n');
    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.lineCount).toBe(2);
  });

  it('parses a non-trivial module with classes and functions', async () => {
    const src = [
      'import os',
      'from pathlib import Path',
      '',
      'class Greeter:',
      '    def __init__(self, prefix):',
      '        self.prefix = prefix',
      '',
      'def greet(name):',
      '    return name',
      '',
    ].join('\n');
    const result = await pythonAdapter.parse('pkg/core.py', src);
    expect(result.ok).toBe(true);
    expect(result.lineCount).toBe(src.split('\n').length);
  });

  it('handles parse errors without throwing (tree-sitter error recovery)', async () => {
    const result = await pythonAdapter.parse('broken.py', 'def broken(:\n    pass\n');
    expect(result.ok).toBe(true);
    expect(result.lineCount).toBe(3);
  });

  it('handles empty source', async () => {
    const result = await pythonAdapter.parse('empty.py', '');
    expect(result.ok).toBe(true);
    expect(result.lineCount).toBe(0);
  });
});
