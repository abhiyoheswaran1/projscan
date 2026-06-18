import fs from 'node:fs/promises';
import path from 'node:path';
import { parsePyproject } from './pythonPyproject.js';
import type { PythonDeclaredDep } from './pythonProjectTypes.js';
import { extractPyprojectRoots } from './pythonRoots.js';

export interface PythonPyprojectEvidence {
  manifestFiles: string[];
  declared: PythonDeclaredDep[];
  roots: string[];
}

export async function readPyprojectEvidence(rootPath: string): Promise<PythonPyprojectEvidence> {
  const content = await tryRead(path.join(rootPath, 'pyproject.toml'));
  if (content === null) return { manifestFiles: [], declared: [], roots: [] };

  return {
    manifestFiles: ['pyproject.toml'],
    declared: parsePyproject(content),
    roots: extractPyprojectRoots(content),
  };
}

async function tryRead(absolutePath: string): Promise<string | null> {
  try {
    return await fs.readFile(absolutePath, 'utf-8');
  } catch {
    return null;
  }
}
