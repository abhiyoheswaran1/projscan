import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Security regression guard (Finding 3).
 *
 * The mechanical apply layer — `executePlan` (core/applyFix) reached through
 * the `projscan_apply_fix` MCP tool via `buildApplyPlanForIssue`
 * (core/fixSuggest) — is the one fix path an MCP agent can trigger without a
 * human at the keyboard. It is intentionally restricted to file create /
 * modify / delete with rollback: it must NEVER gain the ability to spawn a
 * subprocess. A prompt-injection-compromised agent could otherwise reach
 * arbitrary command execution.
 *
 * `node:child_process` is the only door to spawning a process, so we pin the
 * invariant at the import: none of these modules may import it. This catches a
 * future refactor that quietly wires command execution into the agent-reachable
 * apply path. (The interactive `projscan fix` CLI path lives in src/fixes/* and
 * is deliberately out of scope here — it is human-driven, not agent-driven.)
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const AGENT_REACHABLE_APPLY_MODULES = [
  'src/core/applyFix.ts',
  'src/mcp/tools/applyFix.ts',
  'src/core/fixSuggest.ts',
];

const CHILD_PROCESS_IMPORT =
  /(?:import|require)\s*(?:[^;]*?from\s*)?\(?\s*['"](?:node:)?child_process['"]/;

describe('apply layer — no subprocess execution (security guard)', () => {
  for (const rel of AGENT_REACHABLE_APPLY_MODULES) {
    it(`${rel} never imports node:child_process`, async () => {
      const source = await fs.readFile(path.join(repoRoot, rel), 'utf-8');
      expect(source).not.toMatch(CHILD_PROCESS_IMPORT);
    });
  }
});
