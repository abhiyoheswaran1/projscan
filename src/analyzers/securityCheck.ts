import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry, Issue } from '../types.js';

const ENV_FILE_PATTERN = /^\.env(\..+)?$/;
const ENV_SAFE_SUFFIXES = ['.example', '.sample', '.template'];

const PRIVATE_KEY_NAMES = ['id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'];
const PRIVATE_KEY_EXTENSIONS = ['.pem', '.key', '.p12', '.pfx'];

const SCANNABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.java', '.rs', '.php',
  '.json', '.yml', '.yaml', '.toml', '.xml',
  '.cfg', '.conf', '.properties', '.sh', '.bash',
  '.env', '.ini',
]);

const MAX_FILE_SIZE = 512 * 1024; // 512 KB

const SECRET_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub Token', pattern: /gh[ps]_[A-Za-z0-9_]{36,}/ },
  { name: 'Slack Token', pattern: /xox[bpras]-[A-Za-z0-9-]+/ },
  { name: 'Private Key', pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/ },
  {
    name: 'Generic Secret',
    pattern: /(?:password|secret|api_key|apikey|token|auth)\s*[=:]\s*['"][^'"]{8,}['"]/i,
  },
];

export async function check(rootPath: string, files: FileEntry[]): Promise<Issue[]> {
  const issues: Issue[] = [];

  // Detection 1: Sensitive .env files
  for (const file of files) {
    const basename = path.basename(file.relativePath);
    if (ENV_FILE_PATTERN.test(basename)) {
      const suffix = basename.slice(4); // everything after ".env"
      if (suffix && ENV_SAFE_SUFFIXES.includes(suffix)) continue;

      issues.push({
        id: 'env-file-committed',
        title: `Environment file committed: ${file.relativePath}`,
        description: `The file "${file.relativePath}" may contain secrets. Add it to .gitignore.`,
        severity: 'warning',
        category: 'security',
        fixAvailable: false,
      });
    }
  }

  // Detection 2: Private key files
  for (const file of files) {
    const basename = path.basename(file.relativePath).toLowerCase();
    const ext = file.extension.toLowerCase();

    const isKeyFile =
      PRIVATE_KEY_NAMES.includes(basename) ||
      PRIVATE_KEY_EXTENSIONS.includes(ext);

    if (isKeyFile) {
      issues.push({
        id: 'private-key-committed',
        title: `Private key file committed: ${file.relativePath}`,
        description: `The file "${file.relativePath}" appears to be a private key. Remove it and add to .gitignore.`,
        severity: 'error',
        category: 'security',
        fixAvailable: false,
      });
    }
  }

  // Detection 3: Hardcoded secrets in file contents
  const filesToScan = files.filter(
    (f) =>
      f.sizeBytes <= MAX_FILE_SIZE &&
      (SCANNABLE_EXTENSIONS.has(f.extension) ||
        path.basename(f.relativePath).startsWith('.env')),
  );

  const scanResults = await Promise.all(
    filesToScan.map((f) => scanFileForSecrets(f)),
  );

  for (const result of scanResults) {
    if (result) issues.push(result);
  }

  // Detection 4: Missing .gitignore .env pattern
  const gitignorePath = path.join(rootPath, '.gitignore');
  try {
    const content = await fs.readFile(gitignorePath, 'utf-8');
    if (!content.includes('.env')) {
      issues.push({
        id: 'gitignore-missing-env',
        title: '.gitignore does not exclude .env files',
        description: 'Add .env to your .gitignore to prevent accidental secret exposure.',
        severity: 'warning',
        category: 'security',
        fixAvailable: false,
      });
    }
  } catch {
    // No .gitignore at all
    if (files.length > 0) {
      issues.push({
        id: 'gitignore-missing-env',
        title: 'No .gitignore file found',
        description: 'Create a .gitignore and add .env to prevent accidental secret exposure.',
        severity: 'warning',
        category: 'security',
        fixAvailable: false,
      });
    }
  }

  return issues;
}

async function scanFileForSecrets(file: FileEntry): Promise<Issue | null> {
  try {
    const content = await fs.readFile(file.absolutePath, 'utf-8');

    for (const { name, pattern } of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        return {
          id: 'hardcoded-secret',
          title: `Potential ${name} detected in ${file.relativePath}`,
          description: `The file "${file.relativePath}" appears to contain a hardcoded secret. Move it to environment variables.`,
          severity: 'error',
          category: 'security',
          fixAvailable: false,
        };
      }
    }
  } catch {
    // Skip files that can't be read
  }
  return null;
}
