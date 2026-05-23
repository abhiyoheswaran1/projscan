import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const maybePackedInstallSmoke = process.env.PROJSCAN_RUN_PACKED_INSTALL_SMOKE === '1' ? it : it.skip;

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
    expect(existsSync(path.join(distGrammars, 'tree-sitter-go.wasm'))).toBe(true);
    expect(existsSync(path.join(distGrammars, 'tree-sitter-java.wasm'))).toBe(true);
    expect(existsSync(path.join(distGrammars, 'tree-sitter-ruby.wasm'))).toBe(true);
    // 0.11+: tool manifest for external consumers (e.g. website docs page).
    expect(existsSync(path.join(repoRoot, 'dist', 'tool-manifest.json'))).toBe(true);

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'projscan-pack-'));
    try {
      execFileSync('npm', ['pack', '--pack-destination', tmpDir, '--ignore-scripts'], {
        cwd: repoRoot,
        env: { ...process.env, npm_config_cache: path.join(tmpDir, '.npm-cache') },
        stdio: 'pipe',
      });

      const [tarballName] = readdirSync(tmpDir).filter((f) => f.endsWith('.tgz'));
      expect(tarballName, 'npm pack produced no tarball').toBeTruthy();
      const tarballPath = path.join(tmpDir, tarballName);
      expect(statSync(tarballPath).size).toBeGreaterThan(0);

      const listing = execFileSync('tar', ['-tzf', tarballPath], { encoding: 'utf-8' });
      expect(listing).toContain('package/dist/grammars/web-tree-sitter.wasm');
      expect(listing).toContain('package/dist/grammars/tree-sitter-python.wasm');
      expect(listing).toContain('package/dist/grammars/tree-sitter-go.wasm');
      expect(listing).toContain('package/dist/grammars/tree-sitter-java.wasm');
      expect(listing).toContain('package/dist/grammars/tree-sitter-ruby.wasm');
      expect(listing).toContain('package/dist/tool-manifest.json');
      expect(listing).toContain('package/docs/plugin.schema.json');
      expect(listing).toContain('package/docs/PLUGIN-AUTHORING.md');
      expect(listing).toContain('package/docs/2.0-MIGRATION.md');
      expect(listing).toContain('package/docs/examples/plugins/policy.projscan-plugin.json');
      expect(listing).toContain('package/docs/examples/plugins/policy.mjs');
      expect(listing).toContain('package/docs/examples/plugins/team-radar.projscan-plugin.json');
      expect(listing).toContain('package/docs/examples/plugins/team-radar.mjs');
      expect(listing).toContain('package/docs/PLUGIN-GALLERY.md');
      expect(listing).toContain('package/docs/examples/plugins/security-radar.projscan-plugin.json');
      expect(listing).toContain('package/docs/examples/plugins/security-radar.mjs');
      expect(listing).toContain('package/docs/examples/plugins/release-readiness.projscan-plugin.json');
      expect(listing).toContain('package/docs/examples/plugins/release-readiness.mjs');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 60_000);

  maybePackedInstallSmoke('installs the packed tarball into a fresh project and exercises CLI, MCP, and plugins', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const script = path.join(repoRoot, 'scripts', 'packed-install-smoke.mjs');

    const output = execFileSync(process.execPath, [script], {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 300_000,
    });

    expect(output).toContain('packed-install-smoke: ok');
  }, 300_000);
});
