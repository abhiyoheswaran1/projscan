import { expect, it } from 'vitest';
import fs from 'node:fs';

it('keeps bridge dataflow coverage in a focused companion suite', () => {
  const genericSuite = fs.readFileSync('tests/core/dataflow.test.ts', 'utf8');
  const bridgeSuite = fs.readFileSync('tests/core/dataflowBridge.test.ts', 'utf8');

  expect(genericSuite.split('\n').length).toBeLessThanOrEqual(80);
  expect(genericSuite).not.toContain('detects bridge functions that source and sink through callees');
  expect(bridgeSuite).toContain('detects bridge functions that source and sink through callees');
});

it('keeps Next and Hono framework dataflow coverage in focused companion suites', () => {
  const nextSuite = fs.readFileSync('tests/core/dataflowFrameworkNext.test.ts', 'utf8');
  const honoSuite = fs.readFileSync('tests/core/dataflowFrameworkHono.test.ts', 'utf8');

  expect(nextSuite).toContain('Next route request.json');
  expect(nextSuite).not.toContain('Hono route');
  expect(nextSuite.split('\n').length).toBeLessThanOrEqual(170);
  expect(honoSuite).toContain('Hono route context request JSON');
  expect(honoSuite).toContain('documented Hono body parsers');
});
