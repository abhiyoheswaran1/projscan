import fs from 'node:fs/promises';
import path from 'node:path';

const API_ROUTE = /(^|\/)(app\/api|pages\/api|src\/api|api)\//;

export default {
  check: async (rootPath, files) => {
    const ownership = await loadCodeowners(rootPath);
    const issues = [];

    for (const file of files) {
      if (!API_ROUTE.test(file.relativePath)) continue;
      if (ownership(file.relativePath)) continue;
      issues.push({
        id: 'api-route-missing-owner',
        title: 'API route needs an explicit owner',
        description: `${file.relativePath} is an API route but no CODEOWNERS rule routes review for it. Add an owner before the route grows or changes contract.`,
        severity: 'warning',
        category: 'ownership',
        fixAvailable: false,
        locations: [{ file: file.relativePath, line: 1 }],
      });
    }

    return issues;
  },
};

async function loadCodeowners(rootPath) {
  for (const candidate of ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS']) {
    try {
      const content = await fs.readFile(path.join(rootPath, candidate), 'utf-8');
      const rules = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.split(/\s+/)[0])
        .filter(Boolean);
      return (relativePath) => rules.some((rule) => matches(rule, relativePath));
    } catch {
      // Try next candidate.
    }
  }
  return () => false;
}

function matches(pattern, relativePath) {
  const normalized = pattern.replace(/^\/+/, '');
  if (normalized === '*') return true;
  if (normalized.endsWith('/')) return relativePath.startsWith(normalized);
  const escaped = normalized
    .split('**')
    .map((part) => part.split('*').map(escapeRegExp).join('[^/]*'))
    .join('.*');
  return new RegExp(`^${escaped}$`).test(relativePath);
}

function escapeRegExp(value) {
  return value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}
