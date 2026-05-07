import { copyFile, mkdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/**
 * Some tree-sitter grammar packages (e.g., tree-sitter-kotlin@0.3.x) ship
 * grammar source but do NOT include a prebuilt `.wasm`. For those we
 * invoke `tree-sitter build --wasm` from the package directory at install
 * time. tree-sitter-cli is a devDependency of projscan, so it's available
 * during npm install (when `prepare: npm run build` runs the build).
 */
async function ensureBuiltWasm(pkgDir, wasmName) {
  const target = path.join(pkgDir, wasmName);
  try {
    await stat(target);
    return; // Already built (or shipped).
  } catch {
    // Need to build.
  }
  console.log(`building ${wasmName} (tree-sitter build --wasm in ${path.basename(pkgDir)})…`);
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['--no-install', 'tree-sitter', 'build', '--wasm'],
      { cwd: pkgDir, stdio: 'inherit' },
    );
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`tree-sitter build --wasm exited with code ${code}`));
    });
  });
  await stat(target);
}

await ensureBuiltWasm(
  path.join(root, 'node_modules/tree-sitter-kotlin'),
  'tree-sitter-kotlin.wasm',
);

const targets = [
  {
    from: path.join(root, 'node_modules/web-tree-sitter/web-tree-sitter.wasm'),
    to: path.join(root, 'dist/grammars/web-tree-sitter.wasm'),
  },
  {
    from: path.join(root, 'node_modules/tree-sitter-python/tree-sitter-python.wasm'),
    to: path.join(root, 'dist/grammars/tree-sitter-python.wasm'),
  },
  {
    from: path.join(root, 'node_modules/tree-sitter-go/tree-sitter-go.wasm'),
    to: path.join(root, 'dist/grammars/tree-sitter-go.wasm'),
  },
  {
    from: path.join(root, 'node_modules/tree-sitter-java/tree-sitter-java.wasm'),
    to: path.join(root, 'dist/grammars/tree-sitter-java.wasm'),
  },
  {
    from: path.join(root, 'node_modules/tree-sitter-ruby/tree-sitter-ruby.wasm'),
    to: path.join(root, 'dist/grammars/tree-sitter-ruby.wasm'),
  },
  {
    from: path.join(root, 'node_modules/tree-sitter-rust/tree-sitter-rust.wasm'),
    to: path.join(root, 'dist/grammars/tree-sitter-rust.wasm'),
  },
  {
    from: path.join(root, 'node_modules/tree-sitter-php/tree-sitter-php.wasm'),
    to: path.join(root, 'dist/grammars/tree-sitter-php.wasm'),
  },
  {
    from: path.join(root, 'node_modules/tree-sitter-c-sharp/tree-sitter-c_sharp.wasm'),
    to: path.join(root, 'dist/grammars/tree-sitter-c_sharp.wasm'),
  },
  {
    from: path.join(root, 'node_modules/tree-sitter-kotlin/tree-sitter-kotlin.wasm'),
    to: path.join(root, 'dist/grammars/tree-sitter-kotlin.wasm'),
  },
  {
    from: path.join(root, 'node_modules/tree-sitter-cpp/tree-sitter-cpp.wasm'),
    to: path.join(root, 'dist/grammars/tree-sitter-cpp.wasm'),
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
