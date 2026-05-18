import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('MCP Registry descriptor', () => {
  const root = process.cwd();
  const descriptor = JSON.parse(
    readFileSync(join(root, '.github/mcp-registry/server.json'), 'utf8')
  );
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

  it('keeps the registry description within the published API limit', () => {
    expect(descriptor.description.length).toBeLessThanOrEqual(100);
  });

  it('keeps package versions aligned for registry publishing', () => {
    expect(descriptor.version).toBe(pkg.version);
    expect(descriptor.packages[0].identifier).toBe(pkg.name);
    expect(descriptor.packages[0].version).toBe(pkg.version);
  });
});
