import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerMcpTools } from "./tools/index.js";

export * from "./tools/index.js";
export * from "./catalog.js";

/**
 * Creates and configures the Antigravity MCP Server.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "antigravity-mcp-server",
    version: "0.1.0",
  });

  registerMcpTools(server);
  return server;
}

/**
 * Starts the MCP Server over StdioServerTransport for AI agents (Cursor, Claude Code, Windsurf).
 */
export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  // Log lifecycle messages exclusively to stderr to protect stdio JSON-RPC transport
  process.stderr.write(
    "[antigravity-mcp-server] Initializing stdio transport...\n",
  );

  await server.connect(transport);
  process.stderr.write("[antigravity-mcp-server] Server listening on stdio.\n");
}

// Auto-start if executed directly
if (
  process.argv[1] &&
  (process.argv[1].endsWith("mcp-server") ||
    process.argv[1].endsWith("index.js") ||
    process.argv[1].endsWith("index.ts"))
) {
  startServer().catch((error) => {
    process.stderr.write(
      `[antigravity-mcp-server] Fatal error: ${(error as Error).message}\n`,
    );
    process.exit(1);
  });
}
