import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = process.cwd();
const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'projscan-packed-install-'));
const packDir = path.join(tmpRoot, 'pack');
const projectDir = path.join(tmpRoot, 'project');
const trustHome = path.join(tmpRoot, 'plugin-trust');
const npmCacheDir =
  process.env.PROJSCAN_NPM_CACHE ?? path.join(os.tmpdir(), 'projscan-packed-install-npm-cache');
const installScriptGrammarPackages = [
  'tree-sitter-c-sharp',
  'tree-sitter-go',
  'tree-sitter-java',
  'tree-sitter-php',
  'tree-sitter-python',
  'tree-sitter-ruby',
  'tree-sitter-rust',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function exec(cmd, args, options = {}) {
  const { env, ...rest } = options;
  return execFileSync(cmd, args, {
    cwd: repoRoot,
    encoding: 'utf-8',
    env: { ...process.env, npm_config_cache: npmCacheDir, ...env },
    maxBuffer: 20 * 1024 * 1024,
    timeout: 300_000,
    ...rest,
  });
}

function spawn(cmd, args, options = {}) {
  const { env, ...rest } = options;
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    encoding: 'utf-8',
    env: { ...process.env, npm_config_cache: npmCacheDir, ...env },
    maxBuffer: 20 * 1024 * 1024,
    timeout: 300_000,
    ...rest,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed with exit ${result.status}\n${output}`);
  }
  return output;
}

function assertNoInstallScriptApprovalWarnings(output) {
  if (/allow-scripts/i.test(output)) {
    throw new Error(`packed npm install emitted allow-scripts warning\n${output}`);
  }
  const nativeGrammarWarning = installScriptGrammarPackages.some(
    (packageName) => output.includes(packageName) && /install scripts|node-gyp-build/i.test(output),
  );
  if (nativeGrammarWarning) {
    throw new Error(`packed npm install emitted native tree-sitter install-script warning\n${output}`);
  }
}

function installPackedTarball(tarballPath) {
  const output = spawn('npm', ['install', '--no-audit', '--no-fund', tarballPath], {
    cwd: projectDir,
    timeout: 180_000,
  });
  assertNoInstallScriptApprovalWarnings(output);
  return output;
}

function runProjscan(binPath, args, options = {}) {
  const { env, ...rest } = options;
  return exec(binPath, args, {
    cwd: projectDir,
    ...rest,
    env: { ...process.env, NO_COLOR: '1', ...env },
  });
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch (err) {
    throw new Error(
      `${label} did not emit valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function writeFixtureProject() {
  writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify({ name: 'projscan-packed-smoke-fixture', version: '0.0.0' }, null, 2),
  );
  mkdirSync(path.join(projectDir, 'src'), { recursive: true });
  writeFileSync(path.join(projectDir, 'src', 'index.ts'), 'export const value = 1;\n');
}

function writePluginFixture() {
  const pluginDir = path.join(projectDir, '.projscan-plugins');
  mkdirSync(pluginDir, { recursive: true });
  writeFileSync(
    path.join(pluginDir, 'policy.projscan-plugin.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        name: 'policy',
        kind: 'analyzer',
        module: './policy.mjs',
        category: 'custom',
      },
      null,
      2,
    ),
  );
  writeFileSync(
    path.join(pluginDir, 'policy.mjs'),
    [
      'export default {',
      '  check: async () => [{',
      "    id: 'packed-install-rule',",
      "    title: 'Packed install plugin rule',",
      "    description: 'Verifies file-based plugins load from the packed package.',",
      "    severity: 'warning',",
      "    category: '',",
      '    fixAvailable: false,',
      "    locations: [{ file: 'src/index.ts', line: 1 }],",
      '  }],',
      '};',
      '',
    ].join('\n'),
  );
}

function verifyMcp(binPath, expectedVersion) {
  const input =
    [
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-03-26' },
      },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'shutdown' },
    ]
      .map((line) => JSON.stringify(line))
      .join('\n') + '\n';

  const stdout = runProjscan(binPath, ['mcp'], { input, timeout: 20_000 });
  const responses = stdout
    .trim()
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => parseJson(line, 'projscan mcp'));
  const init = responses.find((response) => response.id === 1);
  const tools = responses.find((response) => response.id === 2);

  assert(
    init?.result?.serverInfo?.name === 'projscan',
    'MCP initialize did not return projscan serverInfo',
  );
  assert(
    init?.result?.serverInfo?.version === expectedVersion,
    `MCP initialize version mismatch: expected ${expectedVersion}, got ${init?.result?.serverInfo?.version}`,
  );
  assert(
    tools?.result?.tools?.some((tool) => tool.name === 'projscan_doctor'),
    'MCP tools/list did not include projscan_doctor',
  );
}

try {
  assert(
    existsSync(path.join(repoRoot, 'dist', 'cli', 'index.js')),
    'dist/ missing; run npm run build first',
  );
  mkdirSync(packDir, { recursive: true });
  mkdirSync(projectDir, { recursive: true });

  const pkg = parseJson(
    exec('node', ['-e', 'process.stdout.write(JSON.stringify(require("./package.json")))']),
    'package.json',
  );
  const packOut = exec('npm', ['pack', '--pack-destination', packDir, '--ignore-scripts']).trim();
  const tarballName = packOut.split(/\n/).filter(Boolean).at(-1);
  assert(tarballName?.endsWith('.tgz'), `npm pack did not report a tarball name: ${packOut}`);
  const tarballPath = path.join(packDir, tarballName);
  assert(existsSync(tarballPath), `packed tarball missing at ${tarballPath}`);

  writeFixtureProject();
  installPackedTarball(tarballPath);

  const binPath = path.join(projectDir, 'node_modules', '.bin', 'projscan');
  assert(existsSync(binPath), `installed projscan binary missing at ${binPath}`);

  const version = runProjscan(binPath, ['--version']).trim();
  assert(version === pkg.version, `CLI version mismatch: expected ${pkg.version}, got ${version}`);

  const analyze = parseJson(
    runProjscan(binPath, ['analyze', '--format', 'json', '--quiet']),
    'analyze',
  );
  assert(analyze.schemaVersion === 2, 'analyze JSON did not include schemaVersion 2');
  assert(
    analyze.scan.files.some((file) => file.relativePath === 'src/index.ts'),
    'analyze did not include src/index.ts',
  );

  const structure = parseJson(
    runProjscan(binPath, ['structure', '--format', 'json', '--quiet']),
    'structure',
  );
  assert(structure.structure.totalFileCount >= 1, 'structure JSON did not include files');

  const pluginInit = runProjscan(binPath, [
    'plugin',
    'init',
    '--kind',
    'analyzer',
    '--name',
    'packed-policy',
    '--quiet',
  ]);
  assert(
    pluginInit.includes('packed-policy.projscan-plugin.json'),
    'plugin init did not create packed-policy manifest',
  );
  const generatedPluginTest = parseJson(
    runProjscan(binPath, [
      'plugin',
      'test',
      '.projscan-plugins/packed-policy.projscan-plugin.json',
      '--format',
      'json',
      '--quiet',
    ]),
    'plugin test generated',
  );
  assert(generatedPluginTest.ok === true, 'generated plugin did not pass plugin test');

  writePluginFixture();
  const pluginTest = parseJson(
    runProjscan(binPath, [
      'plugin',
      'test',
      '.projscan-plugins/policy.projscan-plugin.json',
      '--format',
      'json',
      '--quiet',
    ]),
    'plugin test fixture',
  );
  assert(pluginTest.ok === true, 'fixture plugin did not pass plugin test');

  // Trust-on-first-use: the plugin only executes after its bytes are approved.
  // Use an isolated trust store under the temp root so the smoke run never
  // touches the real ~/.config trust store.
  runProjscan(binPath, ['plugin', 'trust', 'policy', '--quiet'], {
    env: { PROJSCAN_PLUGIN_TRUST_HOME: trustHome },
  });

  const doctor = parseJson(
    runProjscan(binPath, ['doctor', '--format', 'json', '--quiet'], {
      env: { PROJSCAN_PLUGINS_PREVIEW: '1', PROJSCAN_PLUGIN_TRUST_HOME: trustHome },
    }),
    'doctor',
  );
  assert(
    doctor.health.issues.some((issue) => issue.id === 'plugin:policy:packed-install-rule'),
    'doctor JSON did not include the packed-install plugin issue',
  );

  verifyMcp(binPath, pkg.version);

  console.log(`packed-install-smoke: ok (${tarballName})`);
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}
