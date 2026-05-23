import fs from 'node:fs/promises';
import path from 'node:path';

export default {
  check: async (rootPath, files) => {
    const issues = [];

    for (const file of files) {
      if (/^\.env(\.|$)/.test(path.basename(file.relativePath))) {
        issues.push({
          id: 'committed-env-file',
          title: 'Committed environment file',
          description: `${file.relativePath} looks like a committed environment file. Confirm it contains no secrets before release.`,
          severity: 'warning',
          category: 'security',
          fixAvailable: false,
          locations: [{ file: file.relativePath, line: 1 }],
        });
      }
    }

    const packageJson = files.find((file) => file.relativePath === 'package.json');
    if (!packageJson) return issues;

    try {
      const parsed = JSON.parse(await fs.readFile(path.join(rootPath, 'package.json'), 'utf-8'));
      const scripts = parsed && typeof parsed === 'object' ? parsed.scripts : undefined;
      if (!scripts || typeof scripts !== 'object') return issues;

      for (const [name, command] of Object.entries(scripts)) {
        if (typeof command !== 'string') continue;
        if (/\bcurl\b.*\|\s*(?:sh|bash)|\bwget\b.*\|\s*(?:sh|bash)/.test(command)) {
          issues.push({
            id: `script-fetch-pipe-${name}`,
            title: 'Install script pipes network content to a shell',
            description: `package.json script "${name}" fetches remote content and pipes it into a shell.`,
            severity: 'warning',
            category: 'security',
            fixAvailable: false,
            locations: [{ file: 'package.json', line: 1 }],
          });
        }
      }
    } catch {
      return issues;
    }

    return issues;
  },
};
