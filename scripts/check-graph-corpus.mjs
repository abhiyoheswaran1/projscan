#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_BASELINE = 'docs/graph-corpus-baseline.json';
const DEFAULT_FIXTURES = [
  'tests/fixtures/cpp-small',
  'tests/fixtures/csharp-small',
  'tests/fixtures/go-small',
  'tests/fixtures/kotlin-small',
  'tests/fixtures/php-small',
  'tests/fixtures/python-small',
  'tests/fixtures/rust-small',
  'tests/fixtures/swift-small',
];

const MINIMUM_METRICS = ['files', 'functions', 'packages', 'symbols', 'importEdges', 'callEdges'];
const MAXIMUM_METRICS = ['dataflowRisks'];

export function compareGraphCorpus(baseline, current) {
  const failures = [];
  const currentByName = new Map((current.fixtures ?? []).map((fixture) => [fixture.name, fixture]));

  for (const expected of baseline.fixtures ?? []) {
    const actual = currentByName.get(expected.name);
    if (!actual) {
      failures.push({
        fixture: expected.name,
        metric: 'fixture',
        expected: 'present',
        actual: 'missing',
        direction: 'missing',
      });
      continue;
    }

    for (const metric of MINIMUM_METRICS) {
      if ((actual[metric] ?? 0) < (expected[metric] ?? 0)) {
        failures.push({
          fixture: expected.name,
          metric,
          expected: expected[metric],
          actual: actual[metric],
          direction: 'below-minimum',
        });
      }
    }

    for (const metric of MAXIMUM_METRICS) {
      if ((actual[metric] ?? 0) > (expected[metric] ?? 0)) {
        failures.push({
          fixture: expected.name,
          metric,
          expected: expected[metric],
          actual: actual[metric],
          direction: 'above-maximum',
        });
      }
    }
  }

  return {
    schemaVersion: 1,
    status: failures.length === 0 ? 'pass' : 'fail',
    baselineFixtures: (baseline.fixtures ?? []).length,
    currentFixtures: (current.fixtures ?? []).length,
    failures,
  };
}

export async function createGraphCorpusCheckReport(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const baselinePath = path.resolve(root, options.baseline ?? DEFAULT_BASELINE);
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  const fixtures = baseline.fixtures?.map((fixture) => fixture.fixture) ?? DEFAULT_FIXTURES;
  const moduleUrl = pathToFileURL(path.join(root, 'dist/core/graphCorpus.js')).href;
  const { computeGraphCorpus } = await import(moduleUrl);
  const current = await computeGraphCorpus(root, { fixtures });
  return {
    ...compareGraphCorpus(baseline, current),
    baselinePath: path.relative(root, baselinePath),
    totals: current.totals,
  };
}

async function runCli() {
  const baselineArgIndex = process.argv.indexOf('--baseline');
  const baseline = baselineArgIndex >= 0 ? process.argv[baselineArgIndex + 1] : DEFAULT_BASELINE;
  try {
    const report = await createGraphCorpusCheckReport({ baseline });
    if (process.argv.includes('--format=json')) {
      console.log(JSON.stringify(report, null, 2));
    } else if (report.status === 'pass') {
      console.log(`graph corpus check passed: ${report.currentFixtures} fixture(s) meet baseline`);
    } else {
      console.error(`graph corpus check failed: ${report.failures.length} regression(s)`);
      for (const failure of report.failures) {
        const op = failure.direction === 'above-maximum' ? '<=' : '>=';
        console.error(
          `  ${failure.fixture} ${failure.metric}: expected ${op} ${failure.expected}, got ${failure.actual}`,
        );
      }
    }
    process.exitCode = report.status === 'pass' ? 0 : 1;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
