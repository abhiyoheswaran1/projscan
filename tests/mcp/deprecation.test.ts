import { describe, it, expect } from 'vitest';
import { getToolDefinitions } from '../../src/mcp/tools.js';

const defs = getToolDefinitions();
const names = defs.map((d) => d.name);

describe('4.0 tool removals', () => {
  it('removes projscan_explain (folded into projscan_file)', () => {
    expect(names).not.toContain('projscan_explain');
    expect(names).toContain('projscan_file');
  });

  it('removes projscan_graph (folded into projscan_semantic_graph)', () => {
    expect(names).not.toContain('projscan_graph');
    expect(names).toContain('projscan_semantic_graph');
  });
});

describe('deprecation mechanism (retained for future deprecations)', () => {
  it('no tool ships a deprecation marker in 4.0 (the deprecated tools were removed)', () => {
    const deprecated = defs.filter((d) => d.deprecated);
    expect(deprecated).toEqual([]);
  });

  it('no live tool description carries a [DEPRECATED] prefix', () => {
    expect(defs.every((d) => !d.description.startsWith('[DEPRECATED'))).toBe(true);
  });
});
