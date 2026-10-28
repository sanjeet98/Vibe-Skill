import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { registerMcpTools } from "./tools/index.js";
import {
  handleInspectSkill,
  handleInstallSkill,
  handleListAvailableSkills,
} from "./tools/skills.js";

export const SERVER_NAME = "vibe-skill-mcp-server";
export const SERVER_VERSION = "0.1.0";

/**
 * Creates and configures the high-level McpServer instance.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerMcpTools(server);
  return server;
}

/**
 * Creates and configures the low-level Server instance directly with
 * ListToolsRequestSchema and CallToolRequestSchema handlers.
 */
export function createLowLevelServer(): Server {
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "list_available_skills",
          description:
            "List all production-ready full-stack skills available in the Vibe Skill registry, including their descriptions, target frameworks, and required environment variables.",
          inputSchema: {
            type: "object",
            properties: {
              framework: {
                type: "string",
                description:
                  "Optional framework filter (e.g. 'nextjs', 'vite')",
              },
            },
          },
        },
        {
          name: "inspect_skill",
          description:
            "Inspect full specifications and AI agent integration rules for a specific skill before installation.",
          inputSchema: {
            type: "object",
            properties: {
              skillId: {
                type: "string",
                description:
                  "The unique identifier of the skill (e.g. 'auth-clerk-nextjs')",
              },
            },
            required: ["skillId"],
          },
        },
        {
          name: "install_skill",
          description:
            "Safely scaffold and inject a full-stack skill into a target project. Performs non-destructive AST merging, schema copying, and environment variable initialization.",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description:
                  "Absolute or relative path to the root of the target project directory",
              },
              skillId: {
                type: "string",
                description: "Unique identifier of the skill to install",
              },
              dryRun: {
                type: "boolean",
                description:
                  "If true, simulates changes without writing to disk",
              },
            },
            required: ["projectPath", "skillId"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    switch (name) {
      case "list_available_skills": {
        const framework =
          typeof args.framework === "string" ? args.framework : undefined;
        const result = handleListAvailableSkills({ framework });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "inspect_skill": {
        if (!args.skillId || typeof args.skillId !== "string") {
          throw new McpError(
            ErrorCode.InvalidParams,
            "skillId is required and must be a string",
          );
        }
        const result = handleInspectSkill(args.skillId);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "install_skill": {
        if (!args.projectPath || typeof args.projectPath !== "string") {
          throw new McpError(
            ErrorCode.InvalidParams,
            "projectPath is required and must be a string",
          );
        }
        if (!args.skillId || typeof args.skillId !== "string") {
          throw new McpError(
            ErrorCode.InvalidParams,
            "skillId is required and must be a string",
          );
        }
        const dryRun = Boolean(args.dryRun);
        const result = await handleInstallSkill(
          args.projectPath,
          args.skillId,
          { dryRun },
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  });

  return server;
}
