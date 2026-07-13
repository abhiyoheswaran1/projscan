import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  appendProofLedgerRecord,
  changedFileFingerprint,
  normalizeProofCommand,
  readProofLedger,
  readLatestProofLedgerRecords,
  redactProofCommand,
  redactProofOutput,
} from '../../src/core/proofLedger.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-proof-ledger-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('proof ledger latest lookup', () => {
  it('returns only the newest requested proof records', async () => {
    await appendProofLedgerRecord(tmp, undefined, {
      command: 'npm test -- tests/core/prove.test.ts',
      exitCode: 1,
      durationMs: 100,
      changedFiles: ['src/core/prove.ts'],
      outputSummary: 'old failure',
      completedAt: '2026-06-24T10:00:00.000Z',
    });
    await appendProofLedgerRecord(tmp, undefined, {
      command: 'npm run lint',
      exitCode: 0,
      durationMs: 200,
      changedFiles: ['src/core/prove.ts'],
      outputSummary: 'irrelevant success',
      completedAt: '2026-06-24T10:01:00.000Z',
    });
    await appendProofLedgerRecord(tmp, undefined, {
      command: 'npm test -- tests/core/prove.test.ts',
      exitCode: 0,
      durationMs: 300,
      changedFiles: ['src/core/prove.ts'],
      outputSummary: 'new success',
      completedAt: '2026-06-24T10:02:00.000Z',
    });
    await fs.appendFile(path.join(tmp, '.projscan/proof-ledger.jsonl'), '{not json}\n', 'utf-8');

    const records = await readLatestProofLedgerRecords(tmp, undefined, [
      'npm   test   --   tests/core/prove.test.ts',
      'npm run build',
    ]);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      command: 'npm test -- tests/core/prove.test.ts',
      exitCode: 0,
      outputSummary: 'new success',
    });
  });

  it('rejects symlinked proof ledger reads', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-proof-ledger-outside-'));
    const outsideLedger = path.join(outside, 'proof-ledger.jsonl');
    await fs.mkdir(path.join(tmp, '.projscan'), { recursive: true });
    await fs.writeFile(
      outsideLedger,
      `${JSON.stringify({
        schemaVersion: 1,
        id: 'proof-ledger-forged',
        command: 'npm test',
        normalizedCommand: 'npm test',
        cwd: '.',
        exitCode: 0,
        status: 'passed',
        startedAt: '2026-06-24T10:00:00.000Z',
        completedAt: '2026-06-24T10:00:01.000Z',
        durationMs: 1000,
        changedFileFingerprint: 'forged',
        changedFiles: ['src/core/prove.ts'],
        outputSummary: 'forged',
        source: 'external',
      })}\n`,
      'utf-8',
    );
    await fs.symlink(outsideLedger, path.join(tmp, '.projscan', 'proof-ledger.jsonl'));

    try {
      await expect(readProofLedger(tmp, undefined)).rejects.toThrow(
        'Proof artifact paths must not contain symlinks',
      );
      await expect(readLatestProofLedgerRecords(tmp, undefined, ['npm test'])).rejects.toThrow(
        'Proof artifact paths must not contain symlinks',
      );
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
});

describe('proof command normalization', () => {
  it('strips package-runner prefixes so equivalent invocations match', () => {
    expect(normalizeProofCommand('npx projscan assess --mode fix-first --format json')).toBe(
      'projscan assess --mode fix-first --format json',
    );
    expect(normalizeProofCommand('npx -y projscan assess --format json')).toBe(
      'projscan assess --format json',
    );
    expect(normalizeProofCommand('npx --yes projscan assess')).toBe('projscan assess');
    expect(normalizeProofCommand('pnpm exec projscan assess')).toBe('projscan assess');
    expect(normalizeProofCommand('pnpm dlx projscan assess')).toBe('projscan assess');
    expect(normalizeProofCommand('yarn exec projscan assess')).toBe('projscan assess');
    expect(normalizeProofCommand('npm exec -- projscan assess')).toBe('projscan assess');
    expect(normalizeProofCommand('bunx projscan assess')).toBe('projscan assess');
    expect(normalizeProofCommand('./node_modules/.bin/projscan assess')).toBe('projscan assess');
    expect(normalizeProofCommand('node_modules/.bin/projscan assess')).toBe('projscan assess');
  });

  it('leaves non-runner commands and bare runner names untouched', () => {
    expect(normalizeProofCommand('npm test -- tests/core/prove.test.ts')).toBe(
      'npm test -- tests/core/prove.test.ts',
    );
    expect(normalizeProofCommand('npx')).toBe('npx');
    expect(normalizeProofCommand('echo npx projscan')).toBe('echo npx projscan');
  });

  it('matches runner-prefixed ledger records against plain contract commands', async () => {
    await appendProofLedgerRecord(tmp, undefined, {
      command: 'npx projscan assess --mode fix-first --format json',
      exitCode: 0,
      durationMs: 100,
      changedFiles: ['src/core/prove.ts'],
      outputSummary: 'assess passed',
      completedAt: '2026-06-24T10:00:00.000Z',
    });

    const records = await readLatestProofLedgerRecords(tmp, undefined, [
      'projscan assess --mode fix-first --format json',
    ]);

    expect(records).toHaveLength(1);
    expect(records[0]?.exitCode).toBe(0);
  });

  it('matches ledger rows recorded before runner-prefix normalization existed', async () => {
    await fs.mkdir(path.join(tmp, '.projscan'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, '.projscan/proof-ledger.jsonl'),
      `${JSON.stringify({
        schemaVersion: 1,
        id: 'proof-ledger-legacy',
        command: 'npx projscan assess --mode fix-first --format json',
        normalizedCommand: 'npx projscan assess --mode fix-first --format json',
        cwd: '.',
        exitCode: 0,
        status: 'passed',
        startedAt: '2026-06-24T10:00:00.000Z',
        completedAt: '2026-06-24T10:00:01.000Z',
        durationMs: 1000,
        changedFileFingerprint: 'legacy',
        changedFiles: ['src/core/prove.ts'],
        outputSummary: 'assess passed',
        source: 'prove-record',
      })}\n`,
      'utf-8',
    );

    const records = await readLatestProofLedgerRecords(tmp, undefined, [
      'projscan assess --mode fix-first --format json',
    ]);

    expect(records).toHaveLength(1);
    expect(records[0]?.exitCode).toBe(0);
  });
});

describe('proof ledger redaction', () => {
  it('redacts quoted secret values that contain spaces', () => {
    const spacedValue = ['alpha', 'beta', 'gamma'].join(' ');
    const keyA = ['pass', 'word'].join('');
    const keyB = ['to', 'ken'].join('');
    const flag = `--${keyA}`;

    expect(redactProofOutput(`${keyA}="${spacedValue}"`)).toBe(`${keyA}=[redacted]`);
    expect(redactProofOutput(`${keyB}='${spacedValue}'`)).toBe(`${keyB}=[redacted]`);
    expect(redactProofCommand(`deploy ${flag} "${spacedValue}"`)).toBe(
      `deploy ${flag}=[redacted]`,
    );
  });

  it('redacts standalone token and private-key shapes in proof output', () => {
    const privateKeyLabel = ['PRIVATE', 'KEY'].join(' ');
    const pem = [
      `-----BEGIN ${privateKeyLabel}-----`,
      'synthetic-proof-fixture-value',
      `-----END ${privateKeyLabel}-----`,
    ].join('\n');
    const jwt = [
      ['eyJ', 'hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'].join(''),
      ['eyJ', 'zdWIiOiJwcm9qc2Nhbi10ZXN0In0'].join(''),
      ['signature', 'fixture', 'only'].join(''),
    ].join('.');
    const slack = ['xoxb', '111111111111', '222222222222', 'syntheticfixturetoken'].join('-');

    const redacted = redactProofOutput([pem, jwt, slack].join('\n'));

    expect(redacted).toContain('[redacted]');
    expect(redacted).not.toContain(pem);
    expect(redacted).not.toContain(jwt);
    expect(redacted).not.toContain(slack);
  });
});

describe('changed-file fingerprints', () => {
  it('does not follow changed symlinks outside the project root', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-proof-ledger-outside-'));
    const target = path.join(outside, 'target.txt');
    const link = path.join(tmp, 'link.txt');
    await fs.writeFile(target, 'first placeholder value\n');
    await fs.symlink(target, link);

    try {
      const before = await changedFileFingerprint(tmp, ['link.txt']);
      await fs.writeFile(target, 'second placeholder value\n');
      const after = await changedFileFingerprint(tmp, ['link.txt']);

      expect(after).toBe(before);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
});
