import type { SemverDrift } from '../types.js';

const PARSE_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

export interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
}

export function parse(version: string): ParsedSemver | null {
  if (!version) return null;
  const cleaned = version.replace(/^[~^>=<]+/, '').trim();
  const m = PARSE_RE.exec(cleaned);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
  };
}

export function compare(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return 0;
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  return pa.patch - pb.patch;
}

/**
 * Classify drift from "from" → "to". Returns 'same' if equal,
 * 'unknown' if either can't be parsed, and 'patch'/'minor'/'major' otherwise.
 */
export function drift(from: string | null, to: string | null): SemverDrift {
  if (!from || !to) return 'unknown';
  const pf = parse(from);
  const pt = parse(to);
  if (!pf || !pt) return 'unknown';
  if (pf.major !== pt.major) return 'major';
  if (pf.minor !== pt.minor) return 'minor';
  if (pf.patch !== pt.patch) return 'patch';
  return 'same';
}
