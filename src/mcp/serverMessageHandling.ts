import { dispatchMcpRequest, type McpDispatchHandlers } from './serverDispatch.js';
import { parseJsonRpcMessage } from './serverMessage.js';
import type { McpServerHandle } from './serverTypes.js';

export function createMcpMessageHandler(
  dispatchHandlers: McpDispatchHandlers,
): McpServerHandle['handleMessage'] {
  return async function handleMessage(line: string): Promise<string | null> {
    const parsed = parseJsonRpcMessage(line);
    if (parsed.kind === 'empty') return null;
    if (parsed.kind === 'error') return JSON.stringify(parsed.response);

    const response = await dispatchMcpRequest(parsed.request, dispatchHandlers);
    if (!response) return null;
    return JSON.stringify(response);
  };
}
