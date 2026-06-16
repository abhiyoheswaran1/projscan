import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';

import {
  buildFeedbackTelemetry,
  disableTelemetry,
  enableTelemetry,
  explainTelemetryPolicy,
  getTelemetryStatus,
  recordCommandTelemetry,
} from '../../src/core/telemetry.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-telemetry-core-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('telemetry is disabled by default and explains the privacy boundary', async () => {
  const status = await getTelemetryStatus({ configDir: tmp });

  expect(status.enabled).toBe(false);
  expect(status.anonymousId).toBeNull();
  expect(status.queueLength).toBe(0);
  await expect(fs.stat(path.join(tmp, 'telemetry.json'))).rejects.toThrow();
  expect(status.neverCollected).toEqual(
    expect.arrayContaining([
      'source_code',
      'file_paths',
      'repo_names',
      'branch_names',
      'package_names',
      'raw_findings',
      'secrets',
    ]),
  );

  const policy = explainTelemetryPolicy();
  expect(policy.default).toBe('off');
  expect(policy.collected).toContain('command_category');
  expect(policy.neverCollected).toContain('source_code');
});

test('enable, record, and disable use anonymous sanitized product-health events only', async () => {
  const enabled = await enableTelemetry({ configDir: tmp });
  expect(enabled.enabled).toBe(true);
  expect(enabled.anonymousId).toMatch(/^psn_/);

  const sent: unknown[][] = [];
  const result = await recordCommandTelemetry(
    {
      commandName: 'evidence-pack --pr-comment',
      status: 'success',
      durationMs: 1420,
      version: '3.0.9',
      rootPath: path.join(tmp, 'repo-with-sensitive-name'),
    },
    {
      configDir: tmp,
      sender: async (batch) => {
        sent.push(batch);
        return { ok: true, status: 202 };
      },
    },
  );

  expect(result.status).toBe('sent');
  expect(sent).toHaveLength(1);
  const expectedCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  expect(sent[0][0]).toMatchObject({
    eventType: 'command_run',
    commandCategory: 'evidence',
    commandName: 'evidence-pack --pr-comment',
    version: '3.0.9',
    status: 'success',
    durationBucket: '1-5s',
    platform: process.platform,
    ci: expectedCi,
  });
  const serialized = JSON.stringify(sent);
  expect(serialized).not.toContain(tmp);
  expect(serialized).not.toContain('repo-with-sensitive-name');
  expect(serialized).not.toContain('packageNames');
  expect(serialized).not.toContain('rawFindings');

  const disabled = await disableTelemetry({ configDir: tmp });
  expect(disabled.enabled).toBe(false);
  expect(disabled.queueLength).toBe(0);
});

test('offline mode suppresses telemetry sending even when explicitly enabled', async () => {
  const previous = process.env.PROJSCAN_OFFLINE;
  process.env.PROJSCAN_OFFLINE = '1';
  try {
    await enableTelemetry({ configDir: tmp });
    let sent = false;
    const result = await recordCommandTelemetry(
      { commandName: 'doctor', status: 'success', durationMs: 10, version: '3.0.9', rootPath: tmp },
      {
        configDir: tmp,
        sender: async () => {
          sent = true;
          return { ok: true, status: 202 };
        },
      },
    );

    expect(result).toEqual({ status: 'skipped', reason: 'PROJSCAN_OFFLINE' });
    expect(sent).toBe(false);
  } finally {
    if (previous === undefined) delete process.env.PROJSCAN_OFFLINE;
    else process.env.PROJSCAN_OFFLINE = previous;
  }
});

test('feedback telemetry buckets explicit outcomes without leaking repo, PR, or reviewer identity', () => {
  const feedback = buildFeedbackTelemetry({
    repo: 'secret-api',
    pr: 'https://github.com/acme/secret-api/pull/42',
    reviewer: '@alice',
    useful: true,
    minutesSaved: 14,
    preventedBadEdit: true,
    falsePositiveRules: ['owner:vague'],
  });

  expect(feedback).toEqual({
    useful: true,
    minutesSavedBucket: '10-20',
    preventedBadEdit: true,
    falsePositiveReported: true,
  });
  expect(JSON.stringify(feedback)).not.toContain('secret-api');
  expect(JSON.stringify(feedback)).not.toContain('@alice');
  expect(JSON.stringify(feedback)).not.toContain('github.com');
});
