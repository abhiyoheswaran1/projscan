/**
 * Tool/command deprecation primitives (3.8 deprecation pass).
 *
 * projscan ships a 1.0 stability contract: tools and CLI commands are not
 * removed or renamed within a major. The 4.0 surface consolidation removes a
 * long tail of tools, so 3.8 introduces a *deprecation* signal first — a
 * non-breaking, reversible marker that tells agents and humans "this still
 * works today, but is going away; here is the replacement". Removal happens in
 * {@link REMOVAL_VERSION}, never before.
 *
 * This module is the single source of truth for how a deprecation renders, so
 * the MCP tool surface (description prefix) and the CLI (stderr notice) stay
 * in lockstep. See docs/MIGRATION-4.0.md.
 */

import type { ToolDeprecation } from '../types.js';

export type { ToolDeprecation };

/** The major release in which deprecated tools/commands are actually removed. */
export const REMOVAL_VERSION = '4.0';

/**
 * Prefix prepended to a deprecated MCP tool's description. Machine-greppable
 * (`[DEPRECATED`) and human-readable, with a trailing space so it composes
 * cleanly in front of the existing description.
 */
export function deprecationDescriptionPrefix(dep: ToolDeprecation): string {
  return `[DEPRECATED since ${dep.since}, removed in ${REMOVAL_VERSION} — use ${dep.replacedBy}] `;
}

/**
 * One-line stderr notice for a deprecated CLI command. `command` is the bare
 * subcommand name (e.g. "explain"); `replacedBy` should read as the
 * replacement invocation (e.g. "projscan file").
 */
export function formatCliDeprecationNotice(command: string, dep: ToolDeprecation): string {
  const base = `projscan ${command} is deprecated (since ${dep.since}) and will be removed in ${REMOVAL_VERSION} — use ${dep.replacedBy} instead.`;
  return dep.note ? `${base} ${dep.note}` : base;
}
