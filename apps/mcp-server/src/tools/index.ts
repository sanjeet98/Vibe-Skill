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
    "List all registered Vibe Skill skills available for installation, including framework compatibility and required environment variables.",
    {},
    async () => {
      const result = handleListAvailableSkills();
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
    "Inspect a specific Vibe Skill by ID. Returns the complete skill manifest, schema requirements, and agent architecture rules markdown.",
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
    "Programmatically install a Vibe Skill into a target project. Performs deterministic AST code injection, copies database schema files, provisions environment variables, and generates follow-up agent instructions.",
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
    async ({ projectPath, skillId, options }) => {
      const result = await handleInstallSkill(projectPath, skillId, options);
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
