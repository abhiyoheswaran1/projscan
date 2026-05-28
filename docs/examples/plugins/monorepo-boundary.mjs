import fs from 'node:fs/promises';
import path from 'node:path';

const PACKAGE_FILE = /^packages\/([^/]+)\/(src|lib)\/.+\.(m?[jt]sx?|cts|mts)$/;
const IMPORT_SOURCE = /(?:from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;

export default {
  check: async (rootPath, files) => {
    const issues = [];

    for (const file of files) {
      const match = file.relativePath.match(PACKAGE_FILE);
      if (!match) continue;
      let content = '';
      try {
        content = await fs.readFile(path.join(rootPath, file.relativePath), 'utf-8');
      } catch {
        continue;
      }
      for (const importMatch of content.matchAll(IMPORT_SOURCE)) {
        const specifier = importMatch[1] ?? importMatch[2] ?? '';
        if (!specifier.startsWith('../..')) continue;
        issues.push({
          id: 'monorepo-deep-relative-boundary',
          title: 'Package crosses a monorepo boundary with a deep relative import',
          description: `${file.relativePath} imports ${specifier}. Prefer the package entrypoint or a declared workspace dependency so ownership and impact stay visible.`,
          severity: 'warning',
          category: 'architecture',
          fixAvailable: false,
          locations: [{ file: file.relativePath, line: 1 }],
        });
      }
    }

    return issues.slice(0, 25);
  },
};
