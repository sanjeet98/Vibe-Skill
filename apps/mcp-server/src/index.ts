/**
 * @antigravity/mcp-server
 * Model Context Protocol (MCP) server for Antigravity skills and AST scaffolding tools.
 */

import { ASTEngine } from "@antigravity/ast-engine";
import { RegistryClient } from "@antigravity/infra-core";

export interface MCPServerConfig {
  name: string;
  version: string;
  registryUrl?: string;
}

export class AntigravityMCPServer {
  private astEngine: ASTEngine;
  private registryClient: RegistryClient;

  constructor(private readonly config: MCPServerConfig) {
    this.astEngine = new ASTEngine();
    this.registryClient = new RegistryClient({
      registryUrl: config.registryUrl || "https://registry.antigravity.dev",
    });
  }

  async start(): Promise<void> {
    console.log(`Starting ${this.config.name} v${this.config.version}...`);
  }
}

if (process.env.NODE_ENV !== "test") {
  const server = new AntigravityMCPServer({
    name: "antigravity-mcp-server",
    version: "0.1.0",
  });
  server.start().catch((err) => {
    console.error("Failed to start MCP server:", err);
    process.exit(1);
  });
}
