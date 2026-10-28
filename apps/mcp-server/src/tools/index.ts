import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  handleInspectSkill,
  handleInstallSkill,
  handleListAvailableSkills,
} from "./skills.js";

export * from "./skills.js";

/**
 * Registers all Vibe Skill agent tools with the MCP Server instance.
 */
export function registerMcpTools(server: McpServer): void {
  // 1. list_available_skills
  server.tool(
    "list_available_skills",
    "List all production-ready full-stack skills available in the Vibe Skill registry, including their descriptions, target frameworks, and required environment variables.",
    {
      framework: z
        .string()
        .optional()
        .describe(
          "Optional target framework to filter skills by (e.g. 'nextjs', 'vite')",
        ),
    },
    async ({ framework }) => {
      const result = handleListAvailableSkills({ framework });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  // 2. inspect_skill
  server.tool(
    "inspect_skill",
    "Inspect full specifications and AI agent integration rules for a specific skill before installation.",
    {
      skillId: z
        .string()
        .describe(
          'The unique identifier of the skill (e.g. "auth-clerk-nextjs")',
        ),
    },
    async ({ skillId }) => {
      const result = handleInspectSkill(skillId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  // 3. install_skill
  server.tool(
    "install_skill",
    "Safely scaffold and inject a full-stack skill into a target project. Performs non-destructive AST merging, schema copying, and environment variable initialization.",
    {
      projectPath: z
        .string()
        .describe(
          "Absolute or relative path to the root of the target project directory",
        ),
      skillId: z
        .string()
        .describe(
          'Unique identifier of the skill to install (e.g. "auth-clerk-nextjs")',
        ),
      dryRun: z
        .boolean()
        .optional()
        .describe(
          "If true, simulates changes without modifying target files (default: false)",
        ),
      options: z
        .object({
          skipDependencies: z
            .boolean()
            .optional()
            .describe(
              "Skip instructions to install external npm package dependencies",
            ),
        })
        .optional(),
    },
    async ({ projectPath, skillId, dryRun, options }) => {
      const result = await handleInstallSkill(projectPath, skillId, {
        dryRun: dryRun ?? false,
        skipDependencies: options?.skipDependencies,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}
