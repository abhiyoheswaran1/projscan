import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import { createMcpServer } from '../../src/mcp/server.js';
import { getToolDefinitions } from '../../src/mcp/tools.js';
import type { FileEntry } from '../../src/types.js';

async function send(
  server: ReturnType<typeof createMcpServer>,
  message: unknown,
): Promise<unknown> {
  const line = JSON.stringify(message);
  const raw = await server.handleMessage(line);
  return raw === null ? null : JSON.parse(raw);
}

async function makeFixtureRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-server-'));
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0' }),
  );
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}

async function withFixtureServer<T>(
  fn: (server: ReturnType<typeof createMcpServer>, root: string) => Promise<T>,
): Promise<T> {
  const root = await makeFixtureRoot();
  try {
    return await fn(createMcpServer(root), root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

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

describe('MCP server', () => {
  it('responds to initialize with protocol + server info', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05' },
    })) as {
      id: number;
      result: { serverInfo: { name: string }; capabilities: { tools: unknown } };
    };

    expect(response.id).toBe(1);
    expect(response.result.serverInfo.name).toBe('projscan');
    expect(response.result.capabilities.tools).toBeDefined();
  });

  it('ignores notifications (no response)', async () => {
    const server = createMcpServer(process.cwd());
    const response = await send(server, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect(response).toBeNull();
  });

  it('returns tool definitions on tools/list', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    })) as { result: { tools: Array<{ name: string }> } };

    const names = response.result.tools.map((t) => t.name);
    expect(names).toContain('projscan_doctor');
    expect(names).toContain('projscan_hotspots');
    expect(names).toContain('projscan_file');
    expect(names).toContain('projscan_coupling');
    expect(names.length).toBe(getToolDefinitions().length);
  });

  it('returns MethodNotFound for unknown method', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 3,
      method: 'does/not/exist',
    })) as { error: { code: number; message: string } };
    expect(response.error.code).toBe(-32601);
  });

  it('returns ParseError for invalid JSON', async () => {
    const server = createMcpServer(process.cwd());
    const raw = await server.handleMessage('{not json');
    expect(raw).not.toBeNull();
    const response = JSON.parse(raw as string) as { error: { code: number } };
    expect(response.error.code).toBe(-32700);
  });

  it('returns InvalidRequest when jsonrpc version is missing', async () => {
    const server = createMcpServer(process.cwd());
    const raw = await server.handleMessage(JSON.stringify({ id: 1, method: 'ping' }));
    expect(raw).not.toBeNull();
    const response = JSON.parse(raw as string) as { error: { code: number } };
    expect(response.error.code).toBe(-32600);
  });

  it('preserves message parser edge cases', async () => {
    const server = createMcpServer(process.cwd());

    await expect(server.handleMessage('   ')).resolves.toBeNull();

    const raw = await server.handleMessage(JSON.stringify({ id: 'bad-request', method: 'ping' }));
    expect(raw).not.toBeNull();
    const response = JSON.parse(raw as string) as { id: string; error: { code: number } };
    expect(response.id).toBe('bad-request');
    expect(response.error.code).toBe(-32600);
  });

  it('handles tools/call with unknown tool name', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'projscan_nope', arguments: {} },
    })) as { error: { code: number } };
    expect(response.error.code).toBe(-32601);
  });

  it('tools/call returns content with text JSON payload', async () => {
    await withFixtureServer(async (server) => {
      const response = (await send(server, {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'projscan_structure', arguments: {} },
      })) as {
        result: {
          content: Array<{ type: string; text: string }>;
          isError: boolean;
        };
      };

      expect(response.result.isError).toBe(false);
      expect(response.result.content[0].type).toBe('text');
      const payload = JSON.parse(response.result.content[0].text);
      expect(payload).toHaveProperty('structure');
      expect(payload).toHaveProperty('totalFiles');
    });
  });

  it('projscan_file refuses to read paths outside the root', async () => {
    await withFixtureServer(async (server) => {
      const response = (await send(server, {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'projscan_file',
          arguments: { file: '../../../etc/passwd' },
        },
      })) as {
        result: { content: Array<{ text: string }>; isError: boolean };
      };

      // projscan_file reports the rejection in its payload rather than throwing,
      // but the security guarantee is the same: it never reads out-of-root
      // content. Assert the refusal is signalled and no passwd content leaks.
      const text = response.result.content[0].text;
      expect(text).toMatch(/outside the project root|not found|ENOENT/i);
      expect(text).not.toMatch(/root:.*:0:0:|\/bin\/(ba)?sh/);
    });
  });

  it('error responses short-circuit budget + cost sidecars', async () => {
    // When a tool throws, the dispatcher returns isError:true with the
    // bare error text. The cost / budget sidecars (which only make
    // sense for real result payloads) must not appear inside the error
    // content — otherwise an agent inspecting `result.content[0].text`
    // would see a JSON envelope instead of the error message. A missing
    // required arg makes projscan_file throw, exercising that path.
    await withFixtureServer(async (server) => {
      const response = (await send(server, {
        jsonrpc: '2.0',
        id: 99,
        method: 'tools/call',
        params: {
          name: 'projscan_file',
          arguments: { max_tokens: 5 },
        },
      })) as {
        result: { content: Array<{ text: string }>; isError: boolean };
      };
      expect(response.result.isError).toBe(true);
      const text = response.result.content[0].text;
      expect(text).toMatch(/^Error:/);
      expect(text).not.toContain('_cost');
      expect(text).not.toContain('_budget');
    });
  });

  it('returns method-not-found for unknown tools without crashing the dispatcher', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 100,
      method: 'tools/call',
      params: { name: 'projscan_nonexistent', arguments: {} },
    })) as { error?: { code: number; message: string }; result?: unknown };
    expect(response.error?.code).toBe(-32601);
    expect(response.error?.message).toMatch(/Unknown tool/);
    // Dispatcher must still respond to subsequent valid calls.
    const followup = (await send(server, {
      jsonrpc: '2.0',
      id: 101,
      method: 'tools/list',
    })) as { result: { tools: unknown[] } };
    expect(Array.isArray(followup.result.tools)).toBe(true);
  });

  it('returns invalid-params for tools/call with no name', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 102,
      method: 'tools/call',
      params: { arguments: {} },
    })) as { error?: { code: number; message: string } };
    expect(response.error?.code).toBe(-32602);
    expect(response.error?.message).toMatch(/Missing tool name/);
  });

  it('returns method-not-found for entirely unknown JSON-RPC method', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 103,
      method: 'totally/made/up',
    })) as { error?: { code: number; message: string } };
    expect(response.error?.code).toBe(-32601);
  });

  it('all tool definitions have valid inputSchema', () => {
    for (const tool of getToolDefinitions()) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });

  it('initialize advertises tools, prompts, and resources capabilities', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 99,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05' },
    })) as {
      result: {
        capabilities: { tools?: unknown; prompts?: unknown; resources?: unknown };
      };
    };
    expect(response.result.capabilities.tools).toBeDefined();
    expect(response.result.capabilities.prompts).toBeDefined();
    expect(response.result.capabilities.resources).toBeDefined();
  });

  it('prompts/list returns the prompts', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 10,
      method: 'prompts/list',
    })) as { result: { prompts: Array<{ name: string }> } };
    const names = response.result.prompts.map((p) => p.name);
    expect(names).toContain('prioritize_refactoring');
    expect(names).toContain('investigate_file');
  });

  it('prompts/get prioritize_refactoring returns a user message', async () => {
    const root = await makeFixtureRoot();
    try {
      const server = createMcpServer(root);
      const response = (await send(server, {
        jsonrpc: '2.0',
        id: 11,
        method: 'prompts/get',
        params: { name: 'prioritize_refactoring', arguments: { limit: 3 } },
      })) as { result: { messages: Array<{ role: string; content: { text: string } }> } };
      expect(response.result.messages[0].role).toBe('user');
      expect(response.result.messages[0].content.text.length).toBeGreaterThan(100);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('prompts/get investigate_file requires a file arg', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 12,
      method: 'prompts/get',
      params: { name: 'investigate_file', arguments: {} },
    })) as { error: { code: number; message: string } };
    expect(response.error).toBeDefined();
    expect(response.error.message).toMatch(/file/i);
  });

  it('resources/list returns the canonical resources', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 13,
      method: 'resources/list',
    })) as { result: { resources: Array<{ uri: string }> } };
    const uris = response.result.resources.map((r) => r.uri);
    expect(uris).toContain('projscan://health');
    expect(uris).toContain('projscan://hotspots');
    expect(uris).toContain('projscan://structure');
  });

  it('resources/read returns JSON content', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 14,
      method: 'resources/read',
      params: { uri: 'projscan://structure' },
    })) as {
      result: {
        contents: Array<{ uri: string; mimeType: string; text: string }>;
      };
    };
    expect(response.result.contents[0].uri).toBe('projscan://structure');
    expect(response.result.contents[0].mimeType).toBe('application/json');
    expect(() => JSON.parse(response.result.contents[0].text)).not.toThrow();
  });

  it('resources/read rejects unknown URIs', async () => {
    const server = createMcpServer(process.cwd());
    const response = (await send(server, {
      jsonrpc: '2.0',
      id: 15,
      method: 'resources/read',
      params: { uri: 'projscan://nope' },
    })) as { error: { code: number } };
    expect(response.error).toBeDefined();
  });

  it('projscan_file tool returns hotspot + issues + exports in one payload', async () => {
    await withFixtureServer(async (server) => {
      const response = (await send(server, {
        jsonrpc: '2.0',
        id: 16,
        method: 'tools/call',
        params: { name: 'projscan_file', arguments: { file: 'src/index.ts' } },
      })) as {
        result: {
          isError: boolean;
          content: Array<{ text: string }>;
        };
      };
      expect(response.result.isError).toBe(false);
      const payload = JSON.parse(response.result.content[0].text) as {
        exists: boolean;
        relativePath: string;
        exports: unknown[];
      };
      expect(payload.exists).toBe(true);
      expect(payload.relativePath).toBe('src/index.ts');
      expect(Array.isArray(payload.exports)).toBe(true);
    });
  }, 20000);
});
