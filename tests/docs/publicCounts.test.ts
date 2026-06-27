import fs from 'node:fs';
import { expect, test } from 'vitest';

test('public copy reconciles AST adapters and named language count', () => {
  const readme = fs.readFileSync('README.md', 'utf8');
  const registry = JSON.parse(fs.readFileSync('.github/mcp-registry/server.json', 'utf8')) as {
    description: string;
  };
  const websitePrompt = fs.readFileSync('docs/WEBSITE-UPDATE-PROMPT.md', 'utf8');

  expect(readme).toContain('11 AST adapters covering 12 named languages');
  expect(registry.description).toContain('11 AST adapters, 12 named languages, 49 tools');
  expect(websitePrompt).toContain('11 AST adapters covering 12 named languages');
  expect(readme).not.toContain('full AST analysis for all 11');
  expect(registry.description).not.toContain('11 langs');
  expect(websitePrompt).not.toContain('11 langs');
});
