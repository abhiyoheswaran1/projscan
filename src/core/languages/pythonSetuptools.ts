import fs from 'node:fs/promises';
import path from 'node:path';
import { extractListValues, offsetToLine } from './pythonManifestText.js';
import { splitPep508 } from './pythonPep508.js';
import type { PythonDeclaredDep } from './pythonProjectTypes.js';

export interface PythonSetuptoolsEvidence {
  manifestFiles: string[];
  declared: PythonDeclaredDep[];
}

export async function readSetuptoolsEvidence(rootPath: string): Promise<PythonSetuptoolsEvidence> {
  const manifestFiles: string[] = [];
  const declared: PythonDeclaredDep[] = [];

  const setupCfgContent = await tryRead(path.join(rootPath, 'setup.cfg'));
  if (setupCfgContent !== null) {
    manifestFiles.push('setup.cfg');
    declared.push(...parseSetupCfg(setupCfgContent));
  }

  const setupPyContent = await tryRead(path.join(rootPath, 'setup.py'));
  if (setupPyContent !== null) {
    manifestFiles.push('setup.py');
    declared.push(...parseSetupPyInstallRequires(setupPyContent));
  }

  return { manifestFiles, declared };
}

async function tryRead(absolutePath: string): Promise<string | null> {
  try {
    return await fs.readFile(absolutePath, 'utf-8');
  } catch {
    return null;
  }
}

function parseSetupPyInstallRequires(content: string): PythonDeclaredDep[] {
  const out: PythonDeclaredDep[] = [];
  const m = /install_requires\s*=\s*\[([\s\S]*?)\]/.exec(content);
  if (!m) return out;
  const inside = m[1];
  const baseLine = offsetToLine(content, m.index + m[0].indexOf('['));
  for (const { name, versionSpec, line } of extractListValues(inside, baseLine)) {
    out.push({ name, versionSpec, source: 'setup.py', line, scope: 'main' });
  }
  return out;
}

function parseSetupCfg(content: string): PythonDeclaredDep[] {
  const out: PythonDeclaredDep[] = [];
  const m = /\[options\][\s\S]*?install_requires\s*=\s*([\s\S]*?)(?=\n\[|\n\n|$)/.exec(content);
  if (!m) return out;
  const baseLine = offsetToLine(content, m.index + m[0].indexOf('install_requires'));
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].replace(/#.*$/, '').trim();
    if (!stripped) continue;
    const { name, versionSpec } = splitPep508(stripped);
    if (!name) continue;
    out.push({ name, versionSpec, source: 'setup.cfg', line: baseLine + i + 1, scope: 'main' });
  }
  return out;
}
