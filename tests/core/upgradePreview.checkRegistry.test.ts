import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { previewUpgrade } from '../../src/core/upgradePreview.js';
import type { FileEntry } from '../../src/types.js';

let tmp: string;
let server: http.Server;
let registryUrl: string;
let lastRequestPath: string | null = null;
let mockResponse: { status: number; body: unknown } = {
  status: 200,
  body: { version: '99.0.0' },
};

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-registry-'));
  lastRequestPath = null;
  mockResponse = { status: 200, body: { version: '99.0.0' } };

  // Stub registry running on a free port — the code under test connects to
  // it instead of registry.npmjs.org.
  server = http.createServer((req, res) => {
    lastRequestPath = req.url ?? null;
    res.statusCode = mockResponse.status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(mockResponse.body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  registryUrl = `http://127.0.0.1:${addr.port}`;

  // Set up a project that has `lodash@4.17.20` declared and installed.
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ dependencies: { lodash: '^4.17.20' } }),
  );
  await fs.mkdir(path.join(tmp, 'node_modules', 'lodash'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, 'node_modules', 'lodash', 'package.json'),
    JSON.stringify({ name: 'lodash', version: '4.17.20' }),
  );
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await fs.rm(tmp, { recursive: true, force: true });
});

const NO_FILES: FileEntry[] = [];

describe('previewUpgrade with checkRegistry (1.3+)', () => {
  it('default (no flag) keeps offline behavior — latest = installed, no latestSource', async () => {
    const preview = await previewUpgrade(tmp, 'lodash', NO_FILES);
    expect(preview.available).toBe(true);
    expect(preview.installed).toBe('4.17.20');
    expect(preview.latest).toBe('4.17.20');
    expect(preview.latestSource).toBeUndefined();
    expect(preview.registryError).toBeUndefined();
    expect(lastRequestPath).toBeNull(); // never reached the network
  });

  it('checkRegistry: true populates latest from the registry', async () => {
    mockResponse = { status: 200, body: { version: '4.17.21' } };
    const preview = await previewUpgrade(tmp, 'lodash', NO_FILES, {
      checkRegistry: true,
      registryUrl,
    });
    expect(preview.available).toBe(true);
    expect(preview.installed).toBe('4.17.20');
    expect(preview.latest).toBe('4.17.21');
    expect(preview.latestSource).toBe('registry');
    expect(preview.registryError).toBeUndefined();
    expect(lastRequestPath).toBe('/lodash/latest');
  });

  it('falls back to installed when the registry returns non-2xx', async () => {
    mockResponse = { status: 503, body: { error: 'service down' } };
    const preview = await previewUpgrade(tmp, 'lodash', NO_FILES, {
      checkRegistry: true,
      registryUrl,
    });
    expect(preview.latest).toBe('4.17.20'); // fell back to installed
    expect(preview.latestSource).toBe('installed');
    expect(preview.registryError).toContain('HTTP 503');
  });

  it('encodes scoped package names correctly in the registry URL', async () => {
    // Set up @scope/pkg
    await fs.writeFile(
      path.join(tmp, 'package.json'),
      JSON.stringify({ dependencies: { '@scope/pkg': '^1.0.0' } }),
    );
    await fs.mkdir(path.join(tmp, 'node_modules', '@scope', 'pkg'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'node_modules', '@scope', 'pkg', 'package.json'),
      JSON.stringify({ name: '@scope/pkg', version: '1.0.0' }),
    );
    mockResponse = { status: 200, body: { version: '1.2.0' } };

    const preview = await previewUpgrade(tmp, '@scope/pkg', NO_FILES, {
      checkRegistry: true,
      registryUrl,
    });
    expect(preview.latest).toBe('1.2.0');
    expect(lastRequestPath).toBe('/@scope%2Fpkg/latest');
  });
});
