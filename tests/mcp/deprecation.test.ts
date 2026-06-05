import { describe, it, expect } from 'vitest';
import { getToolDefinitions } from '../../src/mcp/tools.js';

const defs = getToolDefinitions();
const byName = (name: string) => defs.find((d) => d.name === name);

describe('MCP tool deprecation surfacing', () => {
  it('marks projscan_explain deprecated in favor of projscan_file', () => {
    const explain = byName('projscan_explain');
    expect(explain?.deprecated?.replacedBy).toBe('projscan_file');
    expect(explain?.description.startsWith('[DEPRECATED')).toBe(true);
    expect(explain?.description).toMatch(/use projscan_file/);
  });

  it('marks projscan_graph deprecated in favor of projscan_semantic_graph', () => {
    const graph = byName('projscan_graph');
    expect(graph?.deprecated?.replacedBy).toBe('projscan_semantic_graph');
    expect(graph?.description.startsWith('[DEPRECATED')).toBe(true);
  });

  it('leaves non-deprecated tools untouched', () => {
    const doctor = byName('projscan_doctor');
    expect(doctor?.deprecated).toBeUndefined();
    expect(doctor?.description.startsWith('[DEPRECATED')).toBe(false);
  });

  it('keeps deprecated tools callable (no removal in 3.x)', () => {
    expect(byName('projscan_explain')).toBeDefined();
    expect(byName('projscan_graph')).toBeDefined();
  });
});
