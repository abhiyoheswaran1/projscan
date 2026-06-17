import { expect, it } from 'vitest';
import fs from 'node:fs';

it('keeps bridge dataflow coverage in a focused companion suite', () => {
  const genericSuite = fs.readFileSync('tests/core/dataflow.test.ts', 'utf8');
  const bridgeSuite = fs.readFileSync('tests/core/dataflowBridge.test.ts', 'utf8');

  expect(genericSuite.split('\n').length).toBeLessThanOrEqual(80);
  expect(genericSuite).not.toContain('detects bridge functions that source and sink through callees');
  expect(bridgeSuite).toContain('detects bridge functions that source and sink through callees');
});
