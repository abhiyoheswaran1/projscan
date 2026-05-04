import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../types.js';

export interface RustProjectInfo {
  /**
   * Crate name from `[package] name = "..."` in Cargo.toml. Local imports
   * starting with this name (or `crate::`, `self::`, `super::`) resolve into
   * the repo. For workspace members, this is the member's own crate name.
   */
  crateName: string;
  /** Absolute directory containing Cargo.toml. Imports resolve relative to its `src/`. */
  crateRoot: string;
  /** When the manifest is `[workspace]`, the relative paths of member crates. Empty for single-crate. */
  workspaceMembers: string[];
}

/**
 * Find the closest Cargo.toml and read the crate name. Mirrors goManifests
 * shape: tries repo root first, then walks up from any directory containing
 * a `.rs` file. Returns null when no Cargo.toml exists; .rs files outside
 * any crate are valid (snippets, build-script outputs) but their `use`
 * imports can't be resolved to local files.
 *
 * Workspace handling: a `[workspace]`-only Cargo.toml has no `[package]`
 * name. We surface that as `crateName = ""` plus a populated
 * `workspaceMembers` so the adapter can route imports against each member's
 * own Cargo.toml as needed.
 */
export async function detectRustProject(
  rootPath: string,
  files: FileEntry[],
): Promise<RustProjectInfo | null> {
  // 1) Try repo root.
  const rootCargo = await readCargo(path.join(rootPath, 'Cargo.toml'));
  if (rootCargo) {
    return {
      crateName: rootCargo.name ?? '',
      crateRoot: rootPath,
      workspaceMembers: rootCargo.workspaceMembers,
    };
  }

  // 2) Walk up from .rs file directories to find any Cargo.toml.
  const candidates = new Set<string>();
  for (const f of files) {
    if (!f.relativePath.endsWith('.rs')) continue;
    let dir = path.posix.dirname(f.relativePath);
    while (dir && dir !== '.' && dir !== '/') {
      candidates.add(dir);
      dir = path.posix.dirname(dir);
    }
  }
  const sorted = [...candidates].sort((a, b) => a.length - b.length);
  for (const dir of sorted) {
    const cargo = await readCargo(path.join(rootPath, dir, 'Cargo.toml'));
    if (cargo) {
      return {
        crateName: cargo.name ?? '',
        crateRoot: path.join(rootPath, dir),
        workspaceMembers: cargo.workspaceMembers,
      };
    }
  }

  return null;
}

interface ParsedCargo {
  name: string | null;
  workspaceMembers: string[];
}

async function readCargo(absPath: string): Promise<ParsedCargo | null> {
  let content: string;
  try {
    content = await fs.readFile(absPath, 'utf-8');
  } catch {
    return null;
  }

  // Tiny TOML reader: scan section headers and a few keys. Cargo.toml is
  // small and structurally simple; we don't need a full TOML parser.
  let section = '';
  let name: string | null = null;
  const workspaceMembers: string[] = [];
  let inMembersArray = false;

  for (const raw of content.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;

    const sec = /^\[([^\]]+)\]$/.exec(line);
    if (sec) {
      section = sec[1].trim();
      inMembersArray = false;
      continue;
    }

    if (section === 'package' && /^name\s*=/.test(line)) {
      const m = /^name\s*=\s*"([^"]+)"/.exec(line);
      if (m) name = m[1];
    }

    if (section === 'workspace') {
      // members = [ "crate-a", "crate-b", ... ]   OR   members = [ \n "..." \n ]
      if (/^members\s*=\s*\[/.test(line)) {
        inMembersArray = !line.includes(']');
        const inline = /\[([^\]]*)\]/.exec(line);
        if (inline) {
          for (const m of inline[1].matchAll(/"([^"]+)"/g)) workspaceMembers.push(m[1]);
        }
        continue;
      }
      if (inMembersArray) {
        for (const m of line.matchAll(/"([^"]+)"/g)) workspaceMembers.push(m[1]);
        if (line.includes(']')) inMembersArray = false;
      }
    }
  }

  return { name, workspaceMembers };
}
