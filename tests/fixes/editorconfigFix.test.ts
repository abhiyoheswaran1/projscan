import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import { editorconfigFix } from '../../src/fixes/editorconfigFix.js';

vi.mock('node:fs/promises');

describe('editorconfigFix', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('has correct metadata', () => {
    expect(editorconfigFix.id).toBe('add-editorconfig');
    expect(editorconfigFix.issueId).toBe('missing-editorconfig');
  });

  it('writes .editorconfig file', async () => {
    vi.mocked(fs.writeFile).mockResolvedValue();

    await editorconfigFix.apply('/proj');

    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.editorconfig'),
      expect.stringContaining('root = true'),
      'utf-8',
    );
  });

  it('includes standard settings', async () => {
    vi.mocked(fs.writeFile).mockResolvedValue();

    await editorconfigFix.apply('/proj');

    const content = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    expect(content).toContain('indent_style = space');
    expect(content).toContain('indent_size = 2');
    expect(content).toContain('end_of_line = lf');
    expect(content).toContain('charset = utf-8');
    expect(content).toContain('insert_final_newline = true');
  });

  it('disables trailing whitespace trimming for markdown', async () => {
    vi.mocked(fs.writeFile).mockResolvedValue();

    await editorconfigFix.apply('/proj');

    const content = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    expect(content).toContain('[*.md]');
    expect(content).toContain('trim_trailing_whitespace = false');
  });

  it('uses tabs for Makefiles', async () => {
    vi.mocked(fs.writeFile).mockResolvedValue();

    await editorconfigFix.apply('/proj');

    const content = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    expect(content).toContain('[Makefile]');
    expect(content).toContain('indent_style = tab');
  });
});
