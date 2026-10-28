import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

export * from "./server.js";
export * from "./tools/index.js";
export * from "./catalog.js";
export * from "./registry.js";

/**
 * Starts the MCP Server over StdioServerTransport for AI agents (Cursor, Claude Code, Windsurf).
 * Ensures stdio protocol cleanliness: process.stdout is strictly reserved for JSON-RPC messages;
 * diagnostic and startup messages are logged to process.stderr (console.error).
 */
export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error("Vibe Skill MCP server running on stdio");
}

// Auto-start if executed directly
if (
  process.argv[1] &&
  (process.argv[1].endsWith("mcp-server") ||
    process.argv[1].endsWith("index.js") ||
    process.argv[1].endsWith("index.ts"))
) {
  startServer().catch((error) => {
    console.error(
      `[vibe-skill-mcp-server] Fatal error: ${(error as Error).message}`,
    );
    process.exit(1);
  });
}
