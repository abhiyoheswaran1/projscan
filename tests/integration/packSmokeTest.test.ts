import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Verifies that `npm pack` produces a tarball containing the compiled
 * output AND the vendored tree-sitter wasm files. A regression here
 * would ship a broken package that crashes on first .py file.
 */
describe('npm pack smoke test', () => {
  it('packs dist/ including grammar wasm files', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');

    // Fail loudly if someone forgot to run build first.
    const distGrammars = path.join(repoRoot, 'dist/grammars');
    expect(existsSync(distGrammars), 'dist/grammars missing — run `npm run build`').toBe(true);
    expect(existsSync(path.join(distGrammars, 'web-tree-sitter.wasm'))).toBe(true);
    expect(existsSync(path.join(distGrammars, 'tree-sitter-python.wasm'))).toBe(true);

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'projscan-pack-'));
    try {
      execFileSync('npm', ['pack', '--pack-destination', tmpDir, '--ignore-scripts'], {
        cwd: repoRoot,
        stdio: 'pipe',
      });

      const [tarballName] = readdirSync(tmpDir).filter((f) => f.endsWith('.tgz'));
      expect(tarballName, 'npm pack produced no tarball').toBeTruthy();
      const tarballPath = path.join(tmpDir, tarballName);
      expect(statSync(tarballPath).size).toBeGreaterThan(0);

      const listing = execFileSync('tar', ['-tzf', tarballPath], { encoding: 'utf-8' });
      expect(listing).toContain('package/dist/grammars/web-tree-sitter.wasm');
      expect(listing).toContain('package/dist/grammars/tree-sitter-python.wasm');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 60_000);
});
