export interface McpServerHandle {
  handleMessage(line: string): Promise<string | null>;
  /** Stop any active watchers. Idempotent. */
  close(): Promise<void>;
}

export interface McpServerOptions {
  /**
   * Called when the server wants to emit a JSON-RPC notification out of band
   * from the normal request/response cycle. The transport layer is responsible
   * for writing the payload.
   */
  notify?: (payload: string) => void;
  /**
   * When true, start a fs.watch on rootPath and emit notifications/file_changed
   * on each debounced batch. Off by default.
   */
  watch?: boolean;
}
