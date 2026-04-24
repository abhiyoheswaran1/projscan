import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const targets = [
  {
    from: path.join(root, 'node_modules/web-tree-sitter/web-tree-sitter.wasm'),
    to: path.join(root, 'dist/grammars/web-tree-sitter.wasm'),
  },
  {
    from: path.join(root, 'node_modules/tree-sitter-python/tree-sitter-python.wasm'),
    to: path.join(root, 'dist/grammars/tree-sitter-python.wasm'),
  },
];

await mkdir(path.join(root, 'dist/grammars'), { recursive: true });

for (const { from, to } of targets) {
  try {
    await stat(from);
  } catch {
    throw new Error(`Source wasm not found: ${from}\nRun \`npm install\` first.`);
  }
  await copyFile(from, to);
  const { size } = await stat(to);
  console.log(`copied ${path.basename(to)} (${(size / 1024).toFixed(1)} KB)`);
}
