import { copyFile, mkdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/**
 * Build a wasm via `tree-sitter build --wasm`. Works for grammars whose
 * single-ABI `src/parser.c + src/scanner.c` layout the cli recognises
 * (e.g., tree-sitter-kotlin). Spawns npx tree-sitter from the package
 * directory; tree-sitter-cli is a devDependency, available at build time.
 */
async function ensureBuiltWasmViaCli(pkgDir, wasmName) {
  const target = path.join(pkgDir, wasmName);
  try {
    await stat(target);
    return;
  } catch {
    // Need to build.
  }
  console.error(`building ${wasmName} (tree-sitter build --wasm in ${path.basename(pkgDir)})…`);
  await spawnAndWait(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['--no-install', 'tree-sitter', 'build', '--wasm'],
    { cwd: pkgDir, stdio: 'inherit' },
  );
  await stat(target);
}

/**
 * Build a wasm by invoking the cached wasi-sdk's clang directly.
 * tree-sitter-cli refuses some grammars (e.g., tree-sitter-swift, whose
 * src/ ships parser_abi13.c + parser_abi14.c alongside parser.c) and
 * demands emcc/docker/podman. The cli's underlying wasi-sdk approach
 * works fine — we just bypass the cli's pre-flight check.
 *
 * Uses the same flags the cli uses internally (extracted from the
 * compiled tree-sitter binary's strings table):
 *   -Os -g --target=wasm32-unknown-wasi -fPIC -shared
 *   -Wl,--allow-undefined -Wl,--no-entry -nostdlib -fno-exceptions
 *   -fvisibility=hidden -Wl,--export=tree_sitter_<name>
 *
 * Requires `~/.cache/tree-sitter/wasi-sdk/` to exist — populated by any
 * prior `tree-sitter build --wasm` invocation. We force-trigger that
 * by building kotlin first (see the call ordering below).
 */
async function ensureBuiltWasmViaWasiSdk(pkgDir, wasmName, exportName) {
  const target = path.join(pkgDir, wasmName);
  try {
    await stat(target);
    return;
  } catch {
    // Need to build.
  }
  const wasiSdkCandidates = treeSitterCacheCandidates();
  let clang = '';
  for (const wasiSdk of wasiSdkCandidates) {
    const probe = path.join(wasiSdk, 'bin', process.platform === 'win32' ? 'clang.exe' : 'clang');
    try {
      await stat(probe);
      clang = probe;
      break;
    } catch {
      // try next
    }
  }
  if (!clang) {
    throw new Error(
      `wasi-sdk clang not found. Searched: ${wasiSdkCandidates.join(', ')}. ` +
        `It is auto-installed by 'tree-sitter build --wasm' (which runs first for tree-sitter-kotlin). ` +
        `If that step succeeded but the cache path differs on your platform, set the TREE_SITTER_WASI_SDK_PATH env var to the wasi-sdk root.`,
    );
  }
  console.error(`building ${wasmName} (wasi-sdk clang in ${path.basename(pkgDir)})…`);
  const sources = ['src/parser.c', 'src/scanner.c'];
  await spawnAndWait(
    clang,
    [
      '-Os',
      '-g',
      '--target=wasm32-unknown-wasi',
      '-fPIC',
      '-shared',
      '-Wl,--allow-undefined',
      '-Wl,--no-entry',
      '-nostdlib',
      '-fno-exceptions',
      '-fvisibility=hidden',
      '-I',
      'src',
      `-Wl,--export=${exportName}`,
      ...sources,
      '-o',
      wasmName,
    ],
    { cwd: pkgDir, stdio: 'inherit' },
  );
  await stat(target);
}

/**
 * Candidate locations for the tree-sitter cli's auto-installed wasi-sdk.
 * Honors TREE_SITTER_WASI_SDK_PATH first (matches the cli's own override),
 * then probes the OS-conventional cache directory (Unix vs. Windows).
 */
function treeSitterCacheCandidates() {
  const out = [];
  if (process.env.TREE_SITTER_WASI_SDK_PATH) out.push(process.env.TREE_SITTER_WASI_SDK_PATH);
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    out.push(path.join(localAppData, 'tree-sitter', 'wasi-sdk'));
  }
  // Unix conventional path — also used as a fallback on Windows because
  // some tooling installs MSYS-style ~/.cache regardless of platform.
  out.push(path.join(os.homedir(), '.cache', 'tree-sitter', 'wasi-sdk'));
  return out;
}

function spawnAndWait(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, opts);
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(cmd)} exited with code ${code}`));
    });
  });
}

// Kotlin is built first via the cli — this also auto-installs wasi-sdk
// at ~/.cache/tree-sitter/wasi-sdk on machines that don't have it yet.
await ensureBuiltWasmViaCli(
  path.join(root, 'node_modules/tree-sitter-kotlin'),
  'tree-sitter-kotlin.wasm',
);

// Swift's parser source layout (parser.c + parser_abi13.c + parser_abi14.c)
// trips a hard "you must have emcc/docker/podman on PATH" check inside the
// tree-sitter cli even when wasi-sdk is locally available. We bypass the
// pre-flight by invoking wasi-sdk's clang directly.
await ensureBuiltWasmViaWasiSdk(
  path.join(root, 'node_modules/tree-sitter-swift'),
  'tree-sitter-swift.wasm',
  'tree_sitter_swift',
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
    from: path.join(root, 'node_modules/tree-sitter-swift/tree-sitter-swift.wasm'),
    to: path.join(root, 'dist/grammars/tree-sitter-swift.wasm'),
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
  console.error(`copied ${path.basename(to)} (${(size / 1024).toFixed(1)} KB)`);
}
