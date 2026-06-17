import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('MCP server test suite structure', () => {
  it('keeps JSON-RPC protocol smoke separate from full tool-call coverage', () => {
    const protocolPath = path.join(process.cwd(), 'tests/mcp/server.test.ts');
    const toolCallPath = path.join(process.cwd(), 'tests/mcp/serverToolCalls.test.ts');
    const protocolSource = readFileSync(protocolPath, 'utf8');

    expect(protocolSource.split(/\r?\n/).length).toBeLessThanOrEqual(180);
    expect(protocolSource).not.toContain('projscan_file tool returns hotspot');
    expect(protocolSource).not.toContain('projscan_file refuses to read paths outside the root');
    expect(protocolSource).not.toContain('error responses short-circuit budget + cost sidecars');
    expect(existsSync(toolCallPath)).toBe(true);

    const toolCallSource = readFileSync(toolCallPath, 'utf8');
    expect(toolCallSource).toContain('projscan_file tool returns hotspot');
    expect(toolCallSource).toContain('projscan_file refuses to read paths outside the root');
    expect(toolCallSource).toContain('error responses short-circuit budget + cost sidecars');
    expect(toolCallSource).not.toContain('responds to initialize with protocol');
  });
});
