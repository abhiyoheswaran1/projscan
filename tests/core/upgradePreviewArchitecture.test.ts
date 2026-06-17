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
});
