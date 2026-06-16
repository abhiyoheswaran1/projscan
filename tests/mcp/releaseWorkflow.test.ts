import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('release workflow metadata', () => {
  const root = process.cwd();
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    version: string;
    scripts: Record<string, string>;
  };
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8')) as {
    version: string;
    packages?: Record<string, { version?: string }>;
  };
  const registry = JSON.parse(
    readFileSync(join(root, '.github/mcp-registry/server.json'), 'utf8'),
  ) as {
    version: string;
    packages: Array<{ version: string }>;
  };
  const workflow = readFileSync(join(root, '.github/workflows/release.yml'), 'utf8');
  const ciWorkflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');

  it('opts JavaScript actions into the Node 24 runtime', () => {
    expect(workflow).toMatch(/FORCE_JAVASCRIPT_ACTIONS_TO_NODE24:\s*true/);
  });

  it('keeps Node 18 in the CI matrix while package engines support Node 18', () => {
    expect(ciWorkflow).toMatch(/node-version:\s*\[18,\s*20,\s*22,\s*24\]/);
  });

  it('keeps release metadata versions in sync', () => {
    expect(lock.version).toBe(pkg.version);
    expect(lock.packages?.['']?.version).toBe(pkg.version);
    expect(registry.version).toBe(pkg.version);
    expect(registry.packages[0]?.version).toBe(pkg.version);
  });

  it('runs the supply-chain release gate in CI and release', () => {
    expect(pkg.scripts['security:release-gate']).toBe('node scripts/release-gate.mjs');
    expect(ciWorkflow).toContain('npm run security:release-gate');
    expect(workflow).toContain('npm run security:release-gate');
  });

  it('exposes a local release readiness check', () => {
    expect(pkg.scripts['release:check']).toBe('node scripts/release-check.mjs');
  });

  it('uses trusted publishing instead of a long-lived npm token', () => {
    expect(workflow).toMatch(/id-token:\s*write/);
    expect(workflow).toMatch(/environment:\s*npm-release/);
    expect(workflow).toMatch(/node-version:\s*24/);
    expect(workflow).toContain('npm publish --provenance --access public');
    expect(workflow).not.toContain('registry-url: https://registry.npmjs.org');
    expect(workflow).not.toContain('NPM_TOKEN');
    expect(workflow).not.toContain('NODE_AUTH_TOKEN');
  });

  it('generates and uploads a release SBOM', () => {
    expect(pkg.scripts['sbom:generate']).toBe('node scripts/generate-sbom.mjs');
    expect(workflow).toContain('npm run sbom:generate');
    expect(workflow).toContain('dist/projscan-sbom.cdx.json');
  });

  it('publishes MCP Registry metadata through GitHub OIDC', () => {
    expect(workflow).toMatch(/id-token:\s*write/);
    expect(workflow).toContain('Check MCP Registry version');
    expect(workflow).toContain('registry.modelcontextprotocol.io/v0/servers?search=projscan');
    expect(workflow).toContain('already_published=');
    expect(workflow).toContain('Install mcp-publisher');
    expect(workflow).toContain(
      'modelcontextprotocol/registry/releases/latest/download/mcp-publisher_',
    );
    expect(workflow).toContain('./mcp-publisher login github-oidc');
    expect(workflow).toContain('./mcp-publisher publish .github/mcp-registry/server.json');
    expect(workflow).not.toContain('Manual follow-up:** republish to the MCP Registry');
  });

  it('names root lockfile packages correctly in the generated SBOM', () => {
    execFileSync(process.execPath, ['scripts/generate-sbom.mjs'], { cwd: root, stdio: 'pipe' });

    const sbom = JSON.parse(readFileSync(join(root, 'dist/projscan-sbom.cdx.json'), 'utf8')) as {
      components: Array<{ name: string }>;
    };
    const componentNames = new Set(sbom.components.map((component) => component.name));

    expect(componentNames.has('node_modules')).toBe(false);
    expect(componentNames.has('@babel/parser')).toBe(true);
  });
});
