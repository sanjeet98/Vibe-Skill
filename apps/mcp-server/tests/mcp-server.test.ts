import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createLowLevelServer,
  createServer,
  getSkill,
  getSkillRules,
  handleInspectSkill,
  handleInstallSkill,
  handleListAvailableSkills,
  listSkills,
} from "../src/index.js";

describe("Vibe Skill MCP Server & Programmatic Tools", () => {
  let tempAppDir: string;

  beforeEach(() => {
    tempAppDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-server-test-"));

    // Create minimal Next.js fixture in temp directory
    const appDir = path.join(tempAppDir, "src/app");
    fs.mkdirSync(appDir, { recursive: true });

    fs.writeFileSync(
      path.join(tempAppDir, "package.json"),
      JSON.stringify(
        {
          name: "test-app",
          version: "0.1.0",
          dependencies: { next: "^14.2.0", react: "^18.3.0" },
        },
        null,
        2,
      ),
      "utf8",
    );

    fs.writeFileSync(
      path.join(appDir, "layout.tsx"),
      `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
`,
      "utf8",
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(tempAppDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it("initializes McpServer and low-level Server instances", () => {
    const mcpServer = createServer();
    expect(mcpServer).toBeDefined();

    const lowLevelServer = createLowLevelServer();
    expect(lowLevelServer).toBeDefined();
  });

  describe("Registry Scanner Module", () => {
    it("listSkills scans and returns all valid skill manifests", async () => {
      const skills = await listSkills();
      expect(skills.length).toBeGreaterThanOrEqual(1);
      const ids = skills.map((s) => s.id);
      expect(ids).toContain("auth-clerk-nextjs");
    });

    it("getSkill locates a specific skill by id", async () => {
      const skill = await getSkill("auth-clerk-nextjs");
      expect(skill).not.toBeNull();
      expect(skill?.manifest.id).toBe("auth-clerk-nextjs");
      expect(fs.existsSync(skill?.skillDir || "")).toBe(true);
    });

    it("getSkill returns null for non-existent skill", async () => {
      const skill = await getSkill("non-existent-skill");
      expect(skill).toBeNull();
    });

    it("getSkillRules returns markdown documentation for a skill", async () => {
      const rules = await getSkillRules("auth-clerk-nextjs");
      expect(rules).not.toBeNull();
      expect(rules).toContain("Clerk Authentication Architectural Rules");
    });
  });

  describe("MCP Tools Direct Handlers", () => {
    it("executes list_available_skills without filter", () => {
      const response = handleListAvailableSkills();
      expect(response.total).toBeGreaterThanOrEqual(1);

      const clerkSkill = response.skills.find(
        (s) => s.id === "auth-clerk-nextjs",
      );
      expect(clerkSkill).toBeDefined();
      expect(clerkSkill?.name).toContain("Clerk");
      expect(clerkSkill?.framework).toBe("nextjs");
      expect(clerkSkill?.requiredEnvVars).toContain(
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      );
    });

    it("executes list_available_skills with framework filter", () => {
      const nextjsSkills = handleListAvailableSkills({ framework: "nextjs" });
      expect(nextjsSkills.total).toBeGreaterThanOrEqual(1);
      expect(
        nextjsSkills.skills.every(
          (s) => s.framework.toLowerCase() === "nextjs",
        ),
      ).toBe(true);

      const nonExistentFramework = handleListAvailableSkills({
        framework: "unknown-framework",
      });
      expect(nonExistentFramework.total).toBe(0);
      expect(nonExistentFramework.skills).toHaveLength(0);
    });

    it("executes inspect_skill for an existing skill and returns architecture rules", () => {
      const response = handleInspectSkill("auth-clerk-nextjs");
      expect(response.found).toBe(true);
      expect(response.skillId).toBe("auth-clerk-nextjs");
      expect(response.manifest).toBeDefined();
      expect(response.rulesMarkdown).toContain(
        "Clerk Authentication Architectural Rules",
      );
    });

    it("handles inspect_skill for a non-existent skill gracefully", () => {
      const response = handleInspectSkill("non-existent-skill");
      expect(response.found).toBe(false);
      expect(response.message).toContain(
        "was not found in the Vibe Skill catalog",
      );
    });

    it("fails install_skill if target directory lacks package.json", async () => {
      const emptyDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "mcp-empty-project-"),
      );
      try {
        const response = await handleInstallSkill(
          emptyDir,
          "auth-clerk-nextjs",
        );
        expect(response.success).toBe(false);
        expect(response.errors[0]).toContain("package.json");
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it("fails install_skill if skillId is not in catalog", async () => {
      const response = await handleInstallSkill(
        tempAppDir,
        "invalid-skill-xyz",
      );
      expect(response.success).toBe(false);
      expect(response.errors[0]).toContain("not found in available catalog");
    });

    it("executes install_skill in dryRun mode without writing to disk", async () => {
      const originalLayout = fs.readFileSync(
        path.join(tempAppDir, "src/app/layout.tsx"),
        "utf8",
      );

      const response = await handleInstallSkill(
        tempAppDir,
        "auth-clerk-nextjs",
        {
          dryRun: true,
          skipDependencies: true,
        },
      );

      expect(response.success).toBe(true);
      expect(response.dryRun).toBe(true);
      expect(response.followUpGuidance).toContain("[Dry Run]");

      // Verify files on disk were not modified
      const currentLayout = fs.readFileSync(
        path.join(tempAppDir, "src/app/layout.tsx"),
        "utf8",
      );
      expect(currentLayout).toBe(originalLayout);

      // Verify .env.local was NOT created
      expect(fs.existsSync(path.join(tempAppDir, ".env.local"))).toBe(false);

      // Verify .vibe-skill/installed.json was NOT created
      expect(
        fs.existsSync(path.join(tempAppDir, ".vibe-skill", "installed.json")),
      ).toBe(false);
    });

    it("executes install_skill programmatically and applies AST merges, env keys, and lockfile", async () => {
      const response = await handleInstallSkill(
        tempAppDir,
        "auth-clerk-nextjs",
        {
          skipDependencies: true,
        },
      );

      expect(response.success).toBe(true);
      expect(response.skillId).toBe("auth-clerk-nextjs");
      expect(response.astInjectionsApplied.length).toBeGreaterThan(0);
      expect(response.followUpGuidance).toContain("successfully installed");

      // 1. Verify layout was patched
      const layoutContent = fs.readFileSync(
        path.join(tempAppDir, "src/app/layout.tsx"),
        "utf8",
      );
      expect(layoutContent).toContain(
        "import { ClerkProvider } from '@clerk/nextjs';",
      );
      expect(layoutContent).toContain(
        '<body className="antialiased">\n        <ClerkProvider>{children}</ClerkProvider>\n      </body>',
      );

      // 2. Verify environment file was populated
      const envContent = fs.readFileSync(
        path.join(tempAppDir, ".env.local"),
        "utf8",
      );
      expect(envContent).toContain("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=");
      expect(envContent).toContain("CLERK_SECRET_KEY=");

      // 3. Verify .vibe-skill/installed.json record
      const lockfilePath = path.join(
        tempAppDir,
        ".vibe-skill",
        "installed.json",
      );
      expect(fs.existsSync(lockfilePath)).toBe(true);
      const lockData = JSON.parse(fs.readFileSync(lockfilePath, "utf8"));
      expect(lockData.installedSkills["auth-clerk-nextjs"]).toBeDefined();
      expect(lockData.skills["auth-clerk-nextjs"]).toBeDefined();
    });
  });
});
