import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { getPromptDefinitions, getPrompt } from '../../src/mcp/prompts.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-prompts-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0' }),
  );
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, 'src', 'a.ts'),
    `export function helper() { return 1; }\nexport const NAME = 'a';\n`,
  );
  await fs.writeFile(
    path.join(tmp, 'src', 'b.ts'),
    `import { helper } from './a.js';\nexport const result = helper();\n`,
  );
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('specialist prompts (1.5+) — definitions', () => {
  it('exposes the four new prompts', () => {
    const names = getPromptDefinitions().map((p) => p.name);
    expect(names).toContain('refactor_hotspot');
    expect(names).toContain('triage_doctor_issues');
    expect(names).toContain('review_this_pr');
    expect(names).toContain('safely_rename_symbol');
  });

  it('still exposes the legacy two prompts', () => {
    const names = getPromptDefinitions().map((p) => p.name);
    expect(names).toContain('prioritize_refactoring');
    expect(names).toContain('investigate_file');
  });

  it('marks file/symbol args as required where appropriate', () => {
    const defs = getPromptDefinitions();
    const refactor = defs.find((p) => p.name === 'refactor_hotspot');
    expect(refactor?.arguments?.find((a) => a.name === 'file')?.required).toBe(true);
    const rename = defs.find((p) => p.name === 'safely_rename_symbol');
    expect(rename?.arguments?.find((a) => a.name === 'symbol')?.required).toBe(true);
  });
});

describe('refactor_hotspot prompt', () => {
  it('throws without a file arg', async () => {
    await expect(getPrompt('refactor_hotspot', {}, tmp)).rejects.toThrow(/file/);
  });

  it('returns a user message with the file embedded', async () => {
    const result = await getPrompt('refactor_hotspot', { file: 'src/a.ts' }, tmp);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].content.text).toContain('src/a.ts');
    expect(result.messages[0].content.text).toContain('refactor');
  });
});

describe('triage_doctor_issues prompt', () => {
  it('returns a triage user message with the score', async () => {
    const result = await getPrompt('triage_doctor_issues', {}, tmp);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].content.text).toMatch(/Project health: \*\*[A-F]/);
  });

  it('honors a severity filter', async () => {
    const result = await getPrompt('triage_doctor_issues', { severity: 'error' }, tmp);
    expect(result.messages[0].content.text).toContain('severity=error');
  });

  it('falls back to all when severity is invalid', async () => {
    const result = await getPrompt('triage_doctor_issues', { severity: 'wibble' }, tmp);
    // Falls back to all-issues view; no severity= tag.
    expect(result.messages[0].content.text).not.toContain('severity=wibble');
  });
});

describe('review_this_pr prompt', () => {
  it('returns a review user message with verdict + base/head', async () => {
    const result = await getPrompt('review_this_pr', {}, tmp);
    const text = result.messages[0].content.text;
    expect(text).toContain('verdict');
    expect(text).toContain('base');
    expect(text).toContain('head');
  });

  it('threads through the package arg', async () => {
    const result = await getPrompt('review_this_pr', { package: 'web' }, tmp);
    expect(result.messages[0].content.text).toContain('scopedToPackage');
  });
});

describe('safely_rename_symbol prompt', () => {
  it('throws without a symbol arg', async () => {
    await expect(getPrompt('safely_rename_symbol', {}, tmp)).rejects.toThrow(/symbol/);
  });

  it('returns a rename plan with the symbol name', async () => {
    const result = await getPrompt('safely_rename_symbol', { symbol: 'helper' }, tmp);
    const text = result.messages[0].content.text;
    expect(text).toContain('helper');
    expect(text).toContain('rename');
  });

  it('includes the new name when `to` is provided', async () => {
    const result = await getPrompt(
      'safely_rename_symbol',
      { symbol: 'helper', to: 'doHelper' },
      tmp,
    );
    expect(result.messages[0].content.text).toContain('doHelper');
    expect(result.description).toContain('doHelper');
  });
});
