import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('MCP Registry descriptor', () => {
  const root = process.cwd();
  const descriptor = JSON.parse(
    readFileSync(join(root, '.github/mcp-registry/server.json'), 'utf8'),
  );
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  const submitGuide = readFileSync(join(root, '.github/mcp-registry/SUBMIT.md'), 'utf8');
  const websitePrompt = readFileSync(join(root, 'docs/WEBSITE-UPDATE-PROMPT.md'), 'utf8');

  it('keeps the registry description within the published API limit', () => {
    expect(descriptor.description.length).toBeLessThanOrEqual(100);
  });

  it('keeps package versions aligned for registry publishing', () => {
    expect(descriptor.version).toBe(pkg.version);
    expect(descriptor.packages[0].identifier).toBe(pkg.name);
    expect(descriptor.packages[0].version).toBe(pkg.version);
  });

  it('keeps registry transport metadata aligned with the npm MCP entrypoint', () => {
    expect(descriptor.name).toBe(pkg.mcpName);
    expect(descriptor.packages[0].transport).toEqual({ type: 'stdio' });
    expect(descriptor.packages[0].runtimeArguments).toContainEqual({
      type: 'positional',
      value: 'mcp',
      isRequired: true,
    });
  });

  it('keeps the registry release guide actionable after auth expiry', () => {
    expect(submitGuide).toContain('~/bin/mcp-publisher validate .github/mcp-registry/server.json');
    expect(submitGuide).toContain('~/bin/mcp-publisher publish .github/mcp-registry/server.json');
    expect(submitGuide).toContain('~/bin/mcp-publisher login github');
  });

  it('keeps README trust copy accurate for local plugin execution', () => {
    expect(readme).not.toContain('No `eval`, no `new Function(...)`');
    expect(readme).toContain('Load local plugins');
    expect(readme).toContain('PROJSCAN_PLUGINS_PREVIEW=1');
    expect(readme).toContain(
      'Run `projscan help` for the generated command-by-command support matrix.',
    );
  });

  it('keeps website update prompt aligned with staged release metadata', () => {
    expect(websitePrompt).toContain(`projscan ${pkg.version}`);
    expect(websitePrompt).toContain(descriptor.name);
    expect(websitePrompt).toContain(descriptor.description);
    expect(websitePrompt).toContain('45 MCP tools');
    expect(websitePrompt).toContain('Node.js >= 18');
  });
});
