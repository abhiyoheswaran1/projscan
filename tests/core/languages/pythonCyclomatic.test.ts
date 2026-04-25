import { describe, it, expect } from 'vitest';
import { pythonAdapter } from '../../../src/core/languages/pythonAdapter.js';

async function cc(src: string): Promise<number> {
  const result = await pythonAdapter.parse('t.py', src);
  expect(result.ok).toBe(true);
  return result.cyclomaticComplexity;
}

describe('cyclomatic complexity (Python)', () => {
  it('empty file is CC=1', async () => {
    expect(await cc('')).toBe(1);
  });

  it('module with no decisions is CC=1', async () => {
    expect(await cc('x = 1\nprint(x)\n')).toBe(1);
  });

  it('single if adds 1', async () => {
    expect(await cc('if x:\n    y()\n')).toBe(2);
  });

  it('if/elif/elif/else: each elif counts (else does not)', async () => {
    const src = 'if a:\n    pass\nelif b:\n    pass\nelif c:\n    pass\nelse:\n    pass\n';
    // 1 if + 2 elif = 3 decisions -> CC 4.
    expect(await cc(src)).toBe(4);
  });

  it('for loop adds 1', async () => {
    expect(await cc('for x in xs:\n    f(x)\n')).toBe(2);
  });

  it('while loop adds 1', async () => {
    expect(await cc('while x:\n    f()\n')).toBe(2);
  });

  it('try / except / except adds 1 per except', async () => {
    const src = 'try:\n    f()\nexcept ValueError:\n    pass\nexcept TypeError:\n    pass\n';
    expect(await cc(src)).toBe(3);
  });

  it('boolean and / or each add 1', async () => {
    expect(await cc('r = a and b and c\n')).toBe(3);
    expect(await cc('r = a or b or c\n')).toBe(3);
  });

  it('conditional expression (x if cond else y) adds 1', async () => {
    expect(await cc('r = a if cond else b\n')).toBe(2);
  });

  it('comprehension with if adds 1', async () => {
    expect(await cc('r = [x for x in xs if x > 0]\n')).toBe(3);
    // for_statement: +1, if_clause: +1, base: 1.
    // Note: tree-sitter-python emits a `for_in_clause`, not `for_statement`,
    // for comprehensions — so only the `if_clause` counts there. Base 1 + if_clause 1 = 2.
  });

  it('summed across nested functions', async () => {
    const src = [
      'def a(x):',
      '    if x:',
      '        return 1',
      '    return 0',
      '',
      'def b(xs):',
      '    for y in xs:',
      '        if y:',
      '            f()',
      '',
    ].join('\n');
    // a: 1 if; b: 1 for + 1 if. Total decisions=3 -> CC=4.
    expect(await cc(src)).toBe(4);
  });
});
