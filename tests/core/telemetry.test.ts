import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  recordToolCall,
  resolveTelemetryConfig,
  describeTelemetryConfig,
  aggregateTelemetry,
  _resetTelemetryConfigForTests,
} from '../../src/core/telemetry.js';

let tmp: string;
let originalEnv: string | undefined;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-tel-'));
  originalEnv = process.env.PROJSCAN_TELEMETRY;
  delete process.env.PROJSCAN_TELEMETRY;
  _resetTelemetryConfigForTests();
});

afterEach(async () => {
  if (originalEnv === undefined) delete process.env.PROJSCAN_TELEMETRY;
  else process.env.PROJSCAN_TELEMETRY = originalEnv;
  _resetTelemetryConfigForTests();
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('resolveTelemetryConfig', () => {
  it('disabled by default with no rc and no env', () => {
    const cfg = resolveTelemetryConfig();
    expect(cfg.enabled).toBe(false);
  });

  it('rc opt-in is honoured', () => {
    const cfg = resolveTelemetryConfig({ enabled: true });
    expect(cfg.enabled).toBe(true);
  });

  it('PROJSCAN_TELEMETRY=1 enables even when rc is unset', () => {
    process.env.PROJSCAN_TELEMETRY = '1';
    _resetTelemetryConfigForTests();
    const cfg = resolveTelemetryConfig();
    expect(cfg.enabled).toBe(true);
  });

  it('PROJSCAN_TELEMETRY=0 kills switch over rc opt-in', () => {
    process.env.PROJSCAN_TELEMETRY = '0';
    _resetTelemetryConfigForTests();
    const cfg = resolveTelemetryConfig({ enabled: true });
    expect(cfg.enabled).toBe(false);
  });

  it('rc.sink overrides default', () => {
    const cfg = resolveTelemetryConfig({ enabled: true, sink: '/tmp/foo.jsonl' });
    expect(cfg.sink).toBe('/tmp/foo.jsonl');
  });
});

describe('recordToolCall', () => {
  it('does NOT write the file when disabled', async () => {
    const sink = path.join(tmp, 'tel.jsonl');
    await recordToolCall('projscan_doctor', 12, true, undefined, { enabled: false, sink });
    await expect(fs.access(sink)).rejects.toBeDefined();
  });

  it('writes a JSONL line when enabled', async () => {
    const sink = path.join(tmp, 'tel.jsonl');
    await recordToolCall('projscan_doctor', 42, true, undefined, { enabled: true, sink });
    const content = await fs.readFile(sink, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);
    const event = JSON.parse(lines[0]);
    expect(event.tool).toBe('projscan_doctor');
    expect(event.durationMs).toBe(42);
    expect(event.ok).toBe(true);
    expect(typeof event.ts).toBe('string');
    expect(typeof event.version).toBe('string');
    // Privacy: no fields beyond what we documented.
    expect(Object.keys(event).sort()).toEqual(['durationMs', 'ok', 'tool', 'ts', 'version'].sort());
  });

  it('records errorCode on failure', async () => {
    const sink = path.join(tmp, 'tel.jsonl');
    await recordToolCall('projscan_audit', 5, false, 'TimeoutError', { enabled: true, sink });
    const event = JSON.parse((await fs.readFile(sink, 'utf-8')).trim());
    expect(event.ok).toBe(false);
    expect(event.errorCode).toBe('TimeoutError');
  });

  it('appends across calls (JSONL grows)', async () => {
    const sink = path.join(tmp, 'tel.jsonl');
    await recordToolCall('a', 1, true, undefined, { enabled: true, sink });
    await recordToolCall('b', 2, true, undefined, { enabled: true, sink });
    const content = await fs.readFile(sink, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
  });

  it('silently swallows sink-write failures (telemetry must never throw)', async () => {
    // Point sink at a directory that cannot be created (root-owned would
    // throw; safer cross-platform: use a path with a file component as its
    // parent dir).
    const blocked = path.join(tmp, 'a-file');
    await fs.writeFile(blocked, 'x');
    const sink = path.join(blocked, 'inside.jsonl');
    await expect(
      recordToolCall('projscan_doctor', 1, true, undefined, { enabled: true, sink }),
    ).resolves.toBeUndefined();
  });
});

describe('describeTelemetryConfig', () => {
  it('surfaces effective state + env override + default sink', () => {
    process.env.PROJSCAN_TELEMETRY = '1';
    _resetTelemetryConfigForTests();
    const desc = describeTelemetryConfig();
    expect(desc.enabled).toBe(true);
    expect(desc.envOverride).toBe('1');
    expect(desc.defaultSink).toContain('.projscan');
    expect(desc.defaultSink).toContain('telemetry.jsonl');
  });
});

describe('aggregateTelemetry', () => {
  it('returns available:false when sink does not exist', async () => {
    const sink = path.join(tmp, 'never-written.jsonl');
    const agg = await aggregateTelemetry({ enabled: true, sink });
    expect(agg.available).toBe(false);
    expect(agg.reason).toContain('No telemetry sink');
  });

  it('aggregates a small recorded set into per-tool histograms', async () => {
    const sink = path.join(tmp, 'tel.jsonl');
    // Three calls of doctor, two of audit, one failure.
    await recordToolCall('projscan_doctor', 100, true, undefined, { enabled: true, sink });
    await recordToolCall('projscan_doctor', 200, true, undefined, { enabled: true, sink });
    await recordToolCall('projscan_doctor', 300, true, undefined, { enabled: true, sink });
    await recordToolCall('projscan_audit', 500, true, undefined, { enabled: true, sink });
    await recordToolCall('projscan_audit', 1500, false, 'TimeoutError', { enabled: true, sink });

    const agg = await aggregateTelemetry({ enabled: true, sink });
    expect(agg.available).toBe(true);
    expect(agg.totalEvents).toBe(5);
    const doctor = agg.byTool.find((t) => t.tool === 'projscan_doctor')!;
    expect(doctor.count).toBe(3);
    expect(doctor.errorCount).toBe(0);
    expect(doctor.minMs).toBe(100);
    expect(doctor.maxMs).toBe(300);
    expect(doctor.p50Ms).toBe(200); // median of 100/200/300
    expect(doctor.meanMs).toBe(200);

    const audit = agg.byTool.find((t) => t.tool === 'projscan_audit')!;
    expect(audit.count).toBe(2);
    expect(audit.errorCount).toBe(1);
    expect(audit.errorRate).toBe(0.5);
  });

  it('orders byTool by count descending', async () => {
    const sink = path.join(tmp, 'tel.jsonl');
    await recordToolCall('rare', 10, true, undefined, { enabled: true, sink });
    for (let i = 0; i < 5; i++) {
      await recordToolCall('common', 10, true, undefined, { enabled: true, sink });
    }
    const agg = await aggregateTelemetry({ enabled: true, sink });
    expect(agg.byTool[0].tool).toBe('common');
    expect(agg.byTool[1].tool).toBe('rare');
  });

  it('skips malformed JSONL lines without throwing', async () => {
    const sink = path.join(tmp, 'tel.jsonl');
    await fs.writeFile(
      sink,
      [
        JSON.stringify({ ts: '2026-04-25T00:00:00Z', tool: 'projscan_doctor', durationMs: 50, ok: true, version: '0.11.0' }),
        '{not valid json',
        '',
        JSON.stringify({ ts: '2026-04-25T00:01:00Z', tool: 'projscan_doctor', durationMs: 70, ok: true, version: '0.11.0' }),
      ].join('\n'),
    );
    const agg = await aggregateTelemetry({ enabled: true, sink });
    expect(agg.available).toBe(true);
    expect(agg.totalEvents).toBe(2);
  });
});
