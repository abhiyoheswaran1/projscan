import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pkg from '../../package.json' with { type: 'json' };

const maybePackedInstallSmoke =
  process.env.PROJSCAN_RUN_PACKED_INSTALL_SMOKE === '1' ? it : it.skip;

const installScriptGrammarPackages = [
  'tree-sitter-c-sharp',
  'tree-sitter-go',
  'tree-sitter-java',
  'tree-sitter-php',
  'tree-sitter-python',
  'tree-sitter-ruby',
  'tree-sitter-rust',
] as const;

const shippedGrammarFiles = [
  'web-tree-sitter.wasm',
  'tree-sitter-c_sharp.wasm',
  'tree-sitter-cpp.wasm',
  'tree-sitter-go.wasm',
  'tree-sitter-java.wasm',
  'tree-sitter-kotlin.wasm',
  'tree-sitter-php.wasm',
  'tree-sitter-python.wasm',
  'tree-sitter-ruby.wasm',
  'tree-sitter-rust.wasm',
  'tree-sitter-swift.wasm',
] as const;

/**
 * Verifies that `npm pack` produces a tarball containing the compiled
 * output AND the vendored tree-sitter wasm files. A regression here
 * would ship a broken package that crashes on first .py file.
 */
describe('npm pack smoke test', () => {
  it('keeps native tree-sitter grammar packages out of runtime dependencies', () => {
    for (const packageName of installScriptGrammarPackages) {
      expect(pkg.dependencies).not.toHaveProperty(packageName);
      expect(pkg.devDependencies).toHaveProperty(packageName);
    }
    expect(pkg.dependencies).toHaveProperty('web-tree-sitter');
    expect(pkg.scripts).not.toHaveProperty('prepare');
    expect(pkg.scripts).not.toHaveProperty('install');
    expect(pkg.scripts).not.toHaveProperty('postinstall');
    expect(pkg.scripts).toHaveProperty('prepack', 'npm run build');
  });

  it('runs packed install smoke through normal npm install and guards allow-scripts warnings', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const script = readFileSync(path.join(repoRoot, 'scripts', 'packed-install-smoke.mjs'), 'utf-8');

    expect(script).toContain('function installPackedTarball');
    expect(script).toContain('allow-scripts');
    for (const packageName of installScriptGrammarPackages) {
      expect(script).toContain(packageName);
    }
    expect(script).not.toMatch(/'install',\s*'--ignore-scripts'/);
  });

  it('keeps npm pack --json stdout parseable when prepack runs', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'projscan-pack-json-'));
    try {
      const stdout = execFileSync(
        'npm',
        ['pack', '--dry-run', '--json', '--pack-destination', tmpDir],
        {
          cwd: repoRoot,
          encoding: 'utf-8',
          env: { ...process.env, npm_config_cache: path.join(tmpDir, '.npm-cache') },
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 120_000,
        },
      );

      const packuments = JSON.parse(stdout) as Array<{ filename?: string; files?: unknown[] }>;
      expect(packuments[0]?.filename).toMatch(/^projscan-\d+\.\d+\.\d+\.tgz$/);
      expect(packuments[0]?.files?.length).toBeGreaterThan(0);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 120_000);

  it('packs dist/ including grammar wasm files', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');

    // Fail loudly if someone forgot to run build first.
    const distGrammars = path.join(repoRoot, 'dist/grammars');
    expect(existsSync(distGrammars), 'dist/grammars missing — run `npm run build`').toBe(true);
    for (const grammarFile of shippedGrammarFiles) {
      expect(existsSync(path.join(distGrammars, grammarFile))).toBe(true);
    }
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
      for (const grammarFile of shippedGrammarFiles) {
        expect(listing).toContain(`package/dist/grammars/${grammarFile}`);
      }
      expect(listing).toContain('package/dist/tool-manifest.json');
      expect(listing).toContain('package/docs/plugin.schema.json');
      expect(listing).toContain('package/docs/PLUGIN-AUTHORING.md');
      expect(listing).toContain('package/docs/2.0-MIGRATION.md');
      expect(listing).toContain('package/docs/examples/plugins/policy.projscan-plugin.json');
      expect(listing).toContain('package/docs/examples/plugins/policy.mjs');
      expect(listing).toContain('package/docs/examples/plugins/team-radar.projscan-plugin.json');
      expect(listing).toContain('package/docs/examples/plugins/team-radar.mjs');
      expect(listing).toContain('package/docs/PLUGIN-GALLERY.md');
      expect(listing).toContain(
        'package/docs/examples/plugins/security-radar.projscan-plugin.json',
      );
      expect(listing).toContain('package/docs/examples/plugins/security-radar.mjs');
      expect(listing).toContain(
        'package/docs/examples/plugins/release-readiness.projscan-plugin.json',
      );
      expect(listing).toContain('package/docs/examples/plugins/release-readiness.mjs');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 60_000);

  maybePackedInstallSmoke(
    'installs the packed tarball into a fresh project and exercises CLI, MCP, and plugins',
    () => {
      const repoRoot = path.resolve(__dirname, '..', '..');
      const script = path.join(repoRoot, 'scripts', 'packed-install-smoke.mjs');

      const output = execFileSync(process.execPath, [script], {
        cwd: repoRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 300_000,
      });

      expect(output).toContain('packed-install-smoke: ok');
    },
    300_000,
  );
});
