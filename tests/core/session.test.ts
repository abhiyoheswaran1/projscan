import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  loadSession,
  recordTouch,
  recordEvent,
  saveSession,
  resetSession,
  SESSION_SCHEMA_VERSION,
} from '../../src/core/session.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-session-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('loadSession', () => {
  it('creates a fresh session when none exists on disk', async () => {
    const { session, created } = await loadSession(tmp);
    expect(created).toBe(true);
    expect(session.schemaVersion).toBe(SESSION_SCHEMA_VERSION);
    expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(session.touchedFiles).toEqual({});
    expect(session.events).toEqual([]);
    expect(typeof session.startedAt).toBe('string');
  });

  it('reuses an existing session within the idle window', async () => {
    const first = await loadSession(tmp);
    recordTouch(first.session, 'src/a.ts', 'tool-result');
    await saveSession(tmp, first.session);

    const second = await loadSession(tmp);
    expect(second.created).toBe(false);
    expect(second.session.id).toBe(first.session.id);
    expect(second.session.touchedFiles['src/a.ts']).toBeDefined();
  });

  it('starts a fresh session when the previous one is past idle timeout', async () => {
    const first = await loadSession(tmp, 60 * 1000);
    recordTouch(first.session, 'src/a.ts', 'tool-result');
    // Hand-edit the on-disk file to backdate lastActivityAt.
    const filePath = path.join(tmp, '.projscan-cache', 'session.json');
    await saveSession(tmp, first.session);
    const raw = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    raw.lastActivityAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await fs.writeFile(filePath, JSON.stringify(raw), 'utf-8');

    const second = await loadSession(tmp, 60 * 1000);
    expect(second.created).toBe(true);
    expect(second.session.id).not.toBe(first.session.id);
    expect(second.session.touchedFiles).toEqual({});
  });

  it('starts a fresh session when the file is corrupt', async () => {
    await fs.mkdir(path.join(tmp, '.projscan-cache'), { recursive: true });
    await fs.writeFile(path.join(tmp, '.projscan-cache', 'session.json'), '{not json', 'utf-8');
    const { session, created } = await loadSession(tmp);
    expect(created).toBe(true);
    expect(session.touchedFiles).toEqual({});
  });

  it('starts a fresh session when the schema version is unknown', async () => {
    await fs.mkdir(path.join(tmp, '.projscan-cache'), { recursive: true });
    const future = {
      schemaVersion: 999,
      id: 'old-id',
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      touchedFiles: {},
      events: [],
    };
    await fs.writeFile(
      path.join(tmp, '.projscan-cache', 'session.json'),
      JSON.stringify(future),
      'utf-8',
    );
    const { session, created } = await loadSession(tmp);
    expect(created).toBe(true);
    expect(session.id).not.toBe('old-id');
  });
});

describe('recordTouch', () => {
  it('inserts a new entry on first touch', async () => {
    const { session } = await loadSession(tmp);
    recordTouch(session, 'src/a.ts', 'tool-result');
    expect(session.touchedFiles['src/a.ts']).toMatchObject({
      file: 'src/a.ts',
      source: 'tool-result',
      count: 1,
    });
  });

  it('increments count on repeat touches', async () => {
    const { session } = await loadSession(tmp);
    recordTouch(session, 'src/a.ts', 'tool-result');
    recordTouch(session, 'src/a.ts', 'fs-watch');
    expect(session.touchedFiles['src/a.ts'].count).toBe(2);
  });

  it('updates lastActivityAt on every touch', async () => {
    const { session } = await loadSession(tmp);
    const before = session.lastActivityAt;
    await new Promise((r) => setTimeout(r, 10));
    recordTouch(session, 'src/a.ts', 'tool-result');
    expect(session.lastActivityAt).not.toBe(before);
  });

  it('rejects path traversal', async () => {
    const { session } = await loadSession(tmp);
    recordTouch(session, '../escape.ts', 'tool-result');
    expect(session.touchedFiles).toEqual({});
  });

  it('rejects absolute paths', async () => {
    const { session } = await loadSession(tmp);
    recordTouch(session, '/etc/passwd', 'tool-result');
    expect(session.touchedFiles).toEqual({});
  });

  it('normalizes Windows backslashes to forward slashes', async () => {
    const { session } = await loadSession(tmp);
    recordTouch(session, 'src\\nested\\a.ts', 'tool-result');
    expect(session.touchedFiles['src/nested/a.ts']).toBeDefined();
  });
});

describe('recordEvent', () => {
  it('appends events with timestamp and kind', async () => {
    const { session } = await loadSession(tmp);
    recordEvent(session, 'tool-call:projscan_hotspots', { limit: 5 });
    expect(session.events).toHaveLength(1);
    expect(session.events[0].kind).toBe('tool-call:projscan_hotspots');
    expect(session.events[0].data).toEqual({ limit: 5 });
  });

  it('caps events at MAX_EVENTS', async () => {
    const { session } = await loadSession(tmp);
    for (let i = 0; i < 600; i++) {
      recordEvent(session, `event-${i}`);
    }
    expect(session.events.length).toBe(500);
    // Oldest dropped, newest retained.
    expect(session.events[0].kind).toBe('event-100');
    expect(session.events[499].kind).toBe('event-599');
  });
});

describe('saveSession + reload roundtrip', () => {
  it('round-trips touchedFiles and events', async () => {
    const { session } = await loadSession(tmp);
    recordTouch(session, 'src/a.ts', 'tool-result');
    recordTouch(session, 'src/b.ts', 'fs-watch');
    recordEvent(session, 'tool-call:projscan_review');
    await saveSession(tmp, session);

    const reloaded = await loadSession(tmp);
    expect(reloaded.session.id).toBe(session.id);
    expect(Object.keys(reloaded.session.touchedFiles).sort()).toEqual(['src/a.ts', 'src/b.ts']);
    expect(reloaded.session.events.map((e) => e.kind)).toEqual(['tool-call:projscan_review']);
  });
});

describe('resetSession', () => {
  it('discards the existing session and returns a fresh one', async () => {
    const first = await loadSession(tmp);
    recordTouch(first.session, 'src/a.ts', 'tool-result');
    await saveSession(tmp, first.session);

    const reset = await resetSession(tmp);
    expect(reset.id).not.toBe(first.session.id);
    expect(reset.touchedFiles).toEqual({});

    const reloaded = await loadSession(tmp);
    expect(reloaded.session.id).toBe(reset.id);
  });
});
