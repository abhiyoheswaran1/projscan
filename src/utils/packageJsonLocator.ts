import fs from 'node:fs/promises';
import path from 'node:path';

export interface PackageJsonLocations {
  filePath: string;
  lineOfDependency: Map<string, number>;
}

/**
 * Parse package.json and find the line number of each dependency name
 * (within dependencies, devDependencies, peerDependencies, optionalDependencies).
 * Line numbers are 1-based. Uses regex against the raw text - robust enough
 * for typical formatted package.json files.
 */
export async function findDependencyLines(
  rootPath: string,
): Promise<PackageJsonLocations | null> {
  const filePath = path.join(rootPath, 'package.json');
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }

  const lines = raw.split('\n');
  const lineOfDependency = new Map<string, number>();

  const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  let currentSection: string | null = null;
  let braceDepthInSection = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!currentSection) {
      for (const section of sections) {
        if (new RegExp(`["']${section}["']\\s*:\\s*\\{`).test(line)) {
          currentSection = section;
          braceDepthInSection = 1;
          break;
        }
      }
      continue;
    }

    // Track brace depth to know when we exit the section
    for (const ch of line) {
      if (ch === '{') braceDepthInSection++;
      else if (ch === '}') braceDepthInSection--;
    }

    if (braceDepthInSection <= 0) {
      currentSection = null;
      continue;
    }

    // Match "pkg-name": "version" on this line
    const m = trimmed.match(/^["']([^"']+)["']\s*:/);
    if (m) {
      const name = m[1];
      if (!lineOfDependency.has(name)) {
        lineOfDependency.set(name, i + 1);
      }
    }
  }

  return { filePath, lineOfDependency };
}
