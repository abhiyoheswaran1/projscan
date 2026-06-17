import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('previewUpgrade architecture', () => {
  it('keeps Python upgrade preview helpers isolated from the npm preview flow', () => {
    const previewSource = readFileSync(
      path.join(process.cwd(), 'src/core/upgradePreview.ts'),
      'utf8',
    );

    expect(previewSource).toContain("from './upgradePreviewPython.js'");
    expect(previewSource).not.toContain('function previewPythonUpgrade');
    expect(previewSource).not.toContain('function pythonUpgradePreview');

    const pythonPreviewSource = readFileSync(
      path.join(process.cwd(), 'src/core/upgradePreviewPython.ts'),
      'utf8',
    );
    expect(pythonPreviewSource).toContain('export async function previewPythonUpgrade');
    expect(pythonPreviewSource).toContain('function pythonUpgradePreview');
  });

  it('keeps npm local evidence helpers isolated from the preview orchestrator', () => {
    const previewSource = readFileSync(
      path.join(process.cwd(), 'src/core/upgradePreview.ts'),
      'utf8',
    );

    expect(previewSource).toContain("from './upgradePreviewNpmEvidence.js'");
    expect(previewSource).not.toContain('const CHANGELOG_NAMES');
    expect(previewSource).not.toContain('const BREAKING_MARKERS');
    expect(previewSource).not.toContain('const PACKAGE_NAME_RE');
    expect(previewSource).not.toContain('function readDeclaredVersion');
    expect(previewSource).not.toContain('function readInstalledVersion');

    const npmEvidenceSource = readFileSync(
      path.join(process.cwd(), 'src/core/upgradePreviewNpmEvidence.ts'),
      'utf8',
    );
    expect(npmEvidenceSource).toContain('export function isValidPackageName');
    expect(npmEvidenceSource).toContain('export async function readDeclaredVersion');
    expect(npmEvidenceSource).toContain('export async function readInstalledVersion');
    expect(npmEvidenceSource).toContain('export async function readNpmChangelogEvidence');
  });
});
