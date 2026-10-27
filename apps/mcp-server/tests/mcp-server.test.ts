import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createServer,
  handleInspectSkill,
  handleInstallSkill,
  handleListAvailableSkills,
} from "../src/index.js";

describe("Antigravity MCP Server & Programmatic Tools", () => {
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

  it("initializes McpServer instance with registered tools", () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  it("executes list_available_skills and discovers catalog skills", () => {
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
      "was not found in the Antigravity catalog",
    );
  });

  it("executes install_skill programmatically and returns structured report", async () => {
    const response = await handleInstallSkill(tempAppDir, "auth-clerk-nextjs", {
      skipDependencies: true,
    });

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

    // 3. Verify .antigravity/installed.json record
    const lockfilePath = path.join(
      tempAppDir,
      ".antigravity",
      "installed.json",
    );
    expect(fs.existsSync(lockfilePath)).toBe(true);
    const lockData = JSON.parse(fs.readFileSync(lockfilePath, "utf8"));
    expect(lockData.installedSkills["auth-clerk-nextjs"]).toBeDefined();
  });
});
