import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function readMcpPackageVersion(packageJsonPath = defaultPackageJsonPath()): string {
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return String(pkg.version ?? '0.0.0');
  } catch {
    return '0.0.0';
  }
}

function defaultPackageJsonPath(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(__dirname, '../../package.json');
}
