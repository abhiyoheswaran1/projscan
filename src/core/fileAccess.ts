import fs from 'node:fs/promises';
import path from 'node:path';

export interface ProjectFileRead {
  resolvedRoot: string;
  absolutePath: string;
  relativePath: string;
  content: string;
  sizeBytes: number;
}

export type ProjectFileReadResult =
  | { ok: true; file: ProjectFileRead }
  | { ok: false; relativePath: string; reason: string };

export async function readProjectFile(
  rootPath: string,
  relOrAbsFile: string,
): Promise<ProjectFileReadResult> {
  // Reject absolute paths up-front. The MCP `projscan_file` tool's docs
  // describe `path` as "relative to the project root", but the prior
  // implementation silently honored absolute paths. Refusing them removes
  // an attack vector where a hostile MCP client passes /etc/passwd directly.
  if (path.isAbsolute(relOrAbsFile)) {
    return {
      ok: false,
      relativePath: relOrAbsFile,
      reason: 'Absolute paths are not accepted; pass a path relative to the project root.',
    };
  }

  // Canonicalize BOTH the root and the target via realpath before the
  // inside-root check. macOS's tmpdir lives at `/var/folders/...` which
  // is itself a symlink to `/private/var/folders/...`; without canonical-
  // izing the root, the resolved target's `/private/...` form would fail
  // the prefix check. Realpath of the root fails ENOENT only if the user
  // pointed at a non-existent root (caller error); fall back to the
  // resolved-without-realpath form in that case so the user gets a clear
  // downstream "File not found" error rather than a misleading "outside
  // the project root".
  const resolvedRoot = path.resolve(rootPath);
  let canonicalRoot = resolvedRoot;
  try {
    canonicalRoot = await fs.realpath(resolvedRoot);
  } catch {
    // root doesn't exist; use the unresolved form
  }
  const absolutePath = path.resolve(canonicalRoot, relOrAbsFile);

  // Resolve symlinks on the target. Without this, a symlink under the repo
  // (e.g. `cache/keys.pem` to `/etc/passwd`) passes the prefix check but
  // reads attacker-chosen content. realpath collapses the symlink so the
  // inside-root check sees the real target. ENOENT (path doesn't exist)
  // means fall back to the unresolved path; downstream stat will surface the
  // real error.
  let realPath = absolutePath;
  try {
    realPath = await fs.realpath(absolutePath);
  } catch {
    // missing path; use the unresolved form for the inside-root check.
    // path.resolve already collapsed any '..' so we won't admit traversal.
  }

  if (!isInsideRoot(realPath, canonicalRoot)) {
    return { ok: false, relativePath: relOrAbsFile, reason: 'File is outside the project root' };
  }

  let content: string;
  let sizeBytes: number;
  try {
    const stat = await fs.stat(realPath);
    if (!stat.isFile()) {
      return { ok: false, relativePath: relOrAbsFile, reason: 'Path is not a file' };
    }
    sizeBytes = stat.size;
    content = await fs.readFile(realPath, 'utf-8');
  } catch (err) {
    const reason = (err as NodeJS.ErrnoException).code === 'ENOENT' ? 'File not found' : String(err);
    return { ok: false, relativePath: relOrAbsFile, reason };
  }

  return {
    ok: true,
    file: {
      resolvedRoot,
      absolutePath,
      relativePath: path.relative(canonicalRoot, absolutePath).split(path.sep).join('/'),
      content,
      sizeBytes,
    },
  };
}

function isInsideRoot(absolutePath: string, resolvedRoot: string): boolean {
  return absolutePath === resolvedRoot || absolutePath.startsWith(resolvedRoot + path.sep);
}
