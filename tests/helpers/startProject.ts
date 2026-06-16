import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach } from 'vitest';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

export async function makeTempProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-start-'));
  tempRoots.push(root);
  await fs.writeFile(
    path.join(root, 'package.json'),
    `${JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }, null, 2)}\n`,
  );
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}
