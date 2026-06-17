import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import type { FileEntry } from '../../src/types.js';

async function inspectRepoSourceFile(rel: string) {
  const root = process.cwd();
  const abs = path.join(root, rel);
  const stat = await fs.stat(abs);
  const file: FileEntry = {
    relativePath: rel,
    absolutePath: abs,
    extension: path.extname(rel).toLowerCase(),
    sizeBytes: stat.size,
    directory: path.posix.dirname(rel),
  };
  const graph = await buildCodeGraph(root, [file]);
  return inspectFile(root, rel, { scan: { files: [file] }, issues: [], graph });
}

describe('MCP server maintainability', () => {
  it('keeps package-version loading out of server orchestration', async () => {
    const serverSource = await fs.readFile(path.join(process.cwd(), 'src/mcp/server.ts'), 'utf-8');
    expect(serverSource).not.toContain('readFileSync');
    expect(serverSource).not.toContain('function readPackageVersion');
    expect(serverSource).toContain("from './serverVersion.js'");

    const versionModule = await inspectRepoSourceFile('src/mcp/serverVersion.ts');
    const readVersion = versionModule.functions?.find((fn) => fn.name === 'readMcpPackageVersion');
    expect(readVersion).toBeDefined();
    expect(readVersion!.cyclomaticComplexity).toBeLessThanOrEqual(3);
  });

  it('keeps JSON-RPC dispatch routing out of server orchestration', async () => {
    const server = await inspectRepoSourceFile('src/mcp/server.ts');
    expect(server.functions?.some((fn) => fn.name === 'dispatch')).toBe(false);

    const dispatchModule = await inspectRepoSourceFile('src/mcp/serverDispatch.ts');
    const dispatch = dispatchModule.functions?.find((fn) => fn.name === 'dispatchMcpRequest');
    expect(dispatch).toBeDefined();
    expect(dispatch!.cyclomaticComplexity).toBeLessThanOrEqual(6);
  });

  it('keeps tool context and progress emitters out of server orchestration', async () => {
    const server = await inspectRepoSourceFile('src/mcp/server.ts');
    const contextFunctions = new Set(['buildToolContext', 'buildProgressEmitter']);
    expect(server.functions?.some((fn) => contextFunctions.has(fn.name))).toBe(false);

    const contextModule = await inspectRepoSourceFile('src/mcp/serverContext.ts');
    const createToolContext = contextModule.functions?.find((fn) => fn.name === 'createToolContext');
    const buildProgressEmitter = contextModule.functions?.find(
      (fn) => fn.name === 'buildProgressEmitter',
    );

    expect(createToolContext).toBeDefined();
    expect(createToolContext!.cyclomaticComplexity).toBeLessThanOrEqual(4);
    expect(buildProgressEmitter).toBeDefined();
    expect(buildProgressEmitter!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  });

  it('keeps session recording out of server orchestration', async () => {
    const server = await inspectRepoSourceFile('src/mcp/server.ts');
    const sessionFunctions = new Set([
      'ensureSession',
      'persistSessionIfDirty',
      'recordSessionTouches',
    ]);
    expect(server.functions?.some((fn) => sessionFunctions.has(fn.name))).toBe(false);

    const sessionModule = await inspectRepoSourceFile('src/mcp/serverSession.ts');
    const createRecorder = sessionModule.functions?.find(
      (fn) => fn.name === 'createServerSessionRecorder',
    );
    const recordToolCall = sessionModule.functions?.find((fn) => fn.name === 'recordToolCall');
    const recordFileWatch = sessionModule.functions?.find((fn) => fn.name === 'recordFileWatch');

    expect(createRecorder).toBeDefined();
    expect(createRecorder!.cyclomaticComplexity).toBeLessThanOrEqual(3);
    expect(recordToolCall).toBeDefined();
    expect(recordToolCall!.cyclomaticComplexity).toBeLessThanOrEqual(6);
    expect(recordFileWatch).toBeDefined();
    expect(recordFileWatch!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  });

  it('keeps JSON-RPC message parsing out of server orchestration', async () => {
    const serverSource = await fs.readFile(path.join(process.cwd(), 'src/mcp/server.ts'), 'utf-8');
    expect(serverSource).not.toContain('JSON.parse(trimmed)');
    expect(serverSource).not.toContain('Invalid JSON-RPC request');

    const messageModule = await inspectRepoSourceFile('src/mcp/serverMessage.ts');
    const parser = messageModule.functions?.find((fn) => fn.name === 'parseJsonRpcMessage');
    expect(parser).toBeDefined();
    expect(parser!.cyclomaticComplexity).toBeLessThanOrEqual(6);
  });

  it('keeps watcher lifecycle out of server orchestration', async () => {
    const server = await inspectRepoSourceFile('src/mcp/server.ts');
    const lifecycleFunctions = new Set(['startFileWatcher', 'close']);
    expect(server.functions?.some((fn) => lifecycleFunctions.has(fn.name))).toBe(false);

    const lifecycleModule = await inspectRepoSourceFile('src/mcp/serverLifecycle.ts');
    const createLifecycle = lifecycleModule.functions?.find(
      (fn) => fn.name === 'createMcpServerLifecycle',
    );
    const startFileWatcher = lifecycleModule.functions?.find((fn) => fn.name === 'startFileWatcher');
    const close = lifecycleModule.functions?.find((fn) => fn.name === 'close');

    expect(createLifecycle).toBeDefined();
    expect(createLifecycle!.cyclomaticComplexity).toBeLessThanOrEqual(3);
    expect(startFileWatcher).toBeDefined();
    expect(startFileWatcher!.cyclomaticComplexity).toBeLessThanOrEqual(3);
    expect(close).toBeDefined();
    expect(close!.cyclomaticComplexity).toBeLessThanOrEqual(6);
  });

  it('keeps MCP request handlers out of server orchestration', async () => {
    const serverSource = await fs.readFile(path.join(process.cwd(), 'src/mcp/server.ts'), 'utf-8');
    for (const handlerName of [
      'handleInitialize',
      'handleToolsCall',
      'handlePromptsGet',
      'handleResourcesRead',
    ]) {
      expect(serverSource).not.toContain(`function ${handlerName}`);
    }
    expect(serverSource).not.toContain('Missing tool name');
    expect(serverSource).not.toContain('Missing prompt name');
    expect(serverSource).not.toContain('Missing resource uri');

    const handlersModule = await inspectRepoSourceFile('src/mcp/serverHandlers.ts');
    const createHandlers = handlersModule.functions?.find(
      (fn) => fn.name === 'createMcpDispatchHandlers',
    );
    expect(createHandlers).toBeDefined();
    expect(createHandlers!.cyclomaticComplexity).toBeLessThanOrEqual(3);

    const expectedHandlers = new Map([
      ['handleInitialize', 5],
      ['handleToolsCall', 7],
      ['handlePromptsGet', 6],
      ['handleResourcesRead', 5],
    ]);
    for (const [handlerName, maxComplexity] of expectedHandlers) {
      const handler = handlersModule.functions?.find((fn) => fn.name === handlerName);
      expect(handler).toBeDefined();
      expect(handler!.cyclomaticComplexity).toBeLessThanOrEqual(maxComplexity);
    }
  });

  it('keeps MCP tool catalog data out of registry lookup helpers', async () => {
    const registrySource = await fs.readFile(path.join(process.cwd(), 'src/mcp/tools.ts'), 'utf-8');
    expect(registrySource).not.toContain("import { analyzeTool }");
    expect(registrySource).not.toContain('const tools: McpTool[] = [');

    const catalogSource = await fs.readFile(
      path.join(process.cwd(), 'src/mcp/toolCatalog.ts'),
      'utf-8',
    );
    expect(catalogSource).toContain('export const mcpTools');
    expect(catalogSource).toContain('analyzeTool');
    expect(catalogSource).toContain('coordinateWatchTool');
  });

  it('keeps stdio transport wiring out of server orchestration', async () => {
    const serverSource = await fs.readFile(path.join(process.cwd(), 'src/mcp/server.ts'), 'utf-8');
    expect(serverSource).toContain("from './serverStdio.js'");
    expect(serverSource).not.toContain(
      "export type { RunMcpServerOptions } from './serverStdio.js';",
    );
    expect(serverSource).not.toContain(
      "export type { McpServerHandle, McpServerOptions } from './serverTypes.js';",
    );
    expect(serverSource).not.toContain("from 'node:readline'");
    expect(serverSource).not.toContain('readline.createInterface');
    expect(serverSource).not.toContain('process.stdin.on');
    expect(serverSource).not.toContain('process.stderr.write');

    const stdioSource = await fs.readFile(
      path.join(process.cwd(), 'src/mcp/serverStdio.ts'),
      'utf-8',
    );
    expect(stdioSource).not.toContain("from './server.js'");
    expect(stdioSource).toContain("from './serverTypes.js'");

    const stdioModule = await inspectRepoSourceFile('src/mcp/serverStdio.ts');
    const runStdio = stdioModule.functions?.find((fn) => fn.name === 'runMcpServerStdio');
    expect(runStdio).toBeDefined();
    expect(runStdio!.cyclomaticComplexity).toBeLessThanOrEqual(5);
  });

  it('keeps session-recording tool tests off the real repository root', async () => {
    const testsRoot = path.join(process.cwd(), 'tests/mcp');
    const sessionRecordingTools = ['projscan_structure', 'projscan_file', 'projscan_search'];
    const repoRootToolTests: string[] = [];

    for (const fileName of await fs.readdir(testsRoot)) {
      if (!fileName.endsWith('.test.ts')) continue;
      const source = await fs.readFile(path.join(testsRoot, fileName), 'utf-8');
      const blocks = source.split(/\n\s+it\(/).slice(1);
      for (const block of blocks) {
        const usesRepoRoot = block.includes('createMcpServer(process.cwd())');
        const sessionTool = sessionRecordingTools.find((tool) =>
          block.includes(`name: '${tool}'`) || block.includes(`name: "${tool}"`),
        );
        if (usesRepoRoot && sessionTool) {
          repoRootToolTests.push(`${fileName}: ${sessionTool}`);
        }
      }
    }

    expect(repoRootToolTests).toEqual([]);
  });
});
