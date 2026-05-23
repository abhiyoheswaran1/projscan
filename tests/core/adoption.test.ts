import path from 'node:path';
import { expect, test } from 'vitest';
import { computeFirstRunDiagnostics } from '../../src/core/adoption.js';

const repoRoot = path.resolve(__dirname, '..', '..');

test('first-run diagnostics recognize the built Tree-sitter runtime', async () => {
  const report = await computeFirstRunDiagnostics(repoRoot);
  const treeSitter = report.diagnostics.find((diagnostic) => diagnostic.id === 'tree-sitter');

  expect(treeSitter?.status).toBe('pass');
});
