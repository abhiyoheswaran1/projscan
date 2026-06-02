import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd, _args, _opts, callback) => {
    callback(null, { stdout: JSON.stringify({ vulnerabilities: {}, metadata: { vulnerabilities: {} } }), stderr: '' });
  }),
}));

import { runAudit } from '../../src/core/auditRunner.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-audit-offline-'));
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'fixture', version: '0.0.0' }));
  await fs.writeFile(path.join(tmp, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: {} }));
  vi.mocked(execFile).mockClear();
});

afterEach(async () => {
  delete process.env.PROJSCAN_OFFLINE;
  await fs.rm(tmp, { recursive: true, force: true });
});

test('offline mode returns unavailable without spawning npm audit', async () => {
  process.env.PROJSCAN_OFFLINE = '1';

  const report = await runAudit(tmp);

  expect(report.available).toBe(false);
  expect(report.reason).toContain('PROJSCAN_OFFLINE');
  expect(execFile).not.toHaveBeenCalled();
});
