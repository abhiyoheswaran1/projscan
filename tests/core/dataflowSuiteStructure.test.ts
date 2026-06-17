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
  expect(nextSuite.split('\n').length).toBeLessThanOrEqual(360);
  expect(honoSuite).toContain('Hono route context request JSON');
  expect(honoSuite).toContain('documented Hono body parsers');
  expect(honoSuite.split('\n').length).toBeLessThanOrEqual(260);
});

it('keeps database sink classification out of the dataflow traversal module', () => {
  const dataflowSource = fs.readFileSync('src/core/dataflow.ts', 'utf8');
  expect(dataflowSource).not.toContain('DEFAULT_DATABASE_SINKS');
  expect(dataflowSource).not.toContain('DATABASE_RECEIVERS');
  expect(dataflowSource).not.toContain('KNOWN_DATABASE_PACKAGES');
  expect(dataflowSource).not.toContain('function isDefaultMisidentifiedDatabaseSink');
  expect(dataflowSource).not.toContain('function isDatabaseMemberCall');
  expect(dataflowSource).not.toContain('function isImportedDatabaseHelper');
  expect(dataflowSource).not.toContain('function isDatabaseModule');
  expect(dataflowSource).not.toContain('function isDatabaseMemberAlias');
  expect(dataflowSource).not.toContain('function isJavaScriptLikeFile');

  const classifierSource = fs.readFileSync('src/core/dataflowDatabaseSinks.ts', 'utf8');
  expect(classifierSource).toContain('export function isDefaultMisidentifiedDatabaseSink');
  expect(classifierSource).not.toContain("from './dataflow.js'");
});

it('keeps function indexing and bridge traversal out of the dataflow entrypoint', () => {
  const dataflowSource = fs.readFileSync('src/core/dataflow.ts', 'utf8');
  expect(dataflowSource).not.toContain('function buildFunctionIndex');
  expect(dataflowSource).not.toContain('function buildImportedFilesByFile');
  expect(dataflowSource).not.toContain('function functionNode');
  expect(dataflowSource).not.toContain('function findReachable');
  expect(dataflowSource).not.toContain('function resolveCalleeTargets');
  expect(dataflowSource).not.toContain('COLLISION_PRONE_CALLEES');
  expect(dataflowSource).not.toContain('function isCollisionProneCallee');
  expect(dataflowSource).not.toContain('function pickSourceHit');
  expect(dataflowSource).not.toContain('function pickSinkHit');
  expect(dataflowSource).not.toContain('function bareName');
  expect(dataflowSource).not.toContain('function uniqueFiles');
  expect(dataflowSource).not.toContain('function compareRisks');

  const traversalSource = fs.readFileSync('src/core/dataflowTraversal.ts', 'utf8');
  expect(traversalSource).toContain('export function buildFunctionIndex');
  expect(traversalSource).toContain('export function findReachable');
  expect(traversalSource).not.toContain("from './dataflow.js'");
});
