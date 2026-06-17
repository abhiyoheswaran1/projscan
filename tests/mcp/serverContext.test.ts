import { describe, expect, it, vi } from 'vitest';
import { createToolContext } from '../../src/mcp/serverContext.js';

describe('MCP server tool context', () => {
  it('registers watches with crypto-grade UUID ids', () => {
    const toolWatches = new Map<string, () => void>();
    const cancel = vi.fn();
    const context = createToolContext(undefined, toolWatches);

    const watchId = context.registerWatch?.(cancel);

    expect(watchId).toMatch(
      /^watch-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(toolWatches.get(watchId!)).toBe(cancel);
    expect(context.unregisterWatch?.(watchId!)).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(toolWatches.has(watchId!)).toBe(false);
  });
});
