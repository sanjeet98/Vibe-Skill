import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addCommand } from "../src/commands/add.js";
import { initCommand } from "../src/commands/init.js";
import { listCommand } from "../src/commands/list.js";
import { detectProject } from "../src/utils/project.js";

describe("Antigravity CLI End-to-End Tests", () => {
  let tempAppDir: string;
  const fixturesDir = path.resolve(__dirname, "../fixtures");
  const sampleAppFixture = path.join(fixturesDir, "sample-app");
  const sampleSkillFixture = path.join(fixturesDir, "sample-skill");

  beforeEach(() => {
    tempAppDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "antigravity-cli-test-"),
    );
    // Copy sample app into temp dir to keep fixture clean
    fs.cpSync(sampleAppFixture, tempAppDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempAppDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it("detects Next.js project with App Router and TypeScript", () => {
    const project = detectProject(tempAppDir);
    expect(project.hasPackageJson).toBe(true);
    expect(project.framework).toBe("nextjs");
    expect(project.language).toBe("typescript");
    expect(project.router).toBe("app-router");
  });

  it("runs antigravity init to initialize project lockfile", async () => {
    const result = await initCommand({ cwd: tempAppDir, silent: true });
    expect(result.success).toBe(true);

    const lockfilePath = path.join(
      tempAppDir,
      ".antigravity",
      "installed.json",
    );
    expect(fs.existsSync(lockfilePath)).toBe(true);
  });

  it("runs antigravity add to inject a skill end-to-end into Next.js fixture", async () => {
    const result = await addCommand(sampleSkillFixture, {
      cwd: tempAppDir,
      noInstall: true,
      silent: true,
    });

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.manifest?.id).toBe("clerk-auth");

    // 1. Verify AST patched layout.tsx
    const layoutPath = path.join(tempAppDir, "src/app/layout.tsx");
    const layoutContent = fs.readFileSync(layoutPath, "utf8");

    expect(layoutContent).toContain(
      "import { ClerkProvider } from '@clerk/nextjs';",
    );
    expect(layoutContent).toContain(
      '<body className="antialiased">\n        <ClerkProvider>{children}</ClerkProvider>\n      </body>',
    );

    // 2. Verify environment variables added
    const envPath = path.join(tempAppDir, ".env.local");
    expect(fs.existsSync(envPath)).toBe(true);
    const envContent = fs.readFileSync(envPath, "utf8");
    expect(envContent).toContain("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=");
    expect(envContent).toContain("CLERK_SECRET_KEY=");

    // 3. Verify .antigravity/installed.json record
    const listResult = listCommand({ cwd: tempAppDir, silent: true });
    expect(listResult.skills).toHaveLength(1);
    expect(listResult.skills[0].id).toBe("clerk-auth");
    expect(listResult.skills[0].name).toBe("Clerk Auth Integration");
  });

  it("is idempotent when running antigravity add multiple times", async () => {
    // Pass 1
    const res1 = await addCommand(sampleSkillFixture, {
      cwd: tempAppDir,
      noInstall: true,
      silent: true,
    });
    expect(res1.success).toBe(true);

    // Pass 2
    const res2 = await addCommand(sampleSkillFixture, {
      cwd: tempAppDir,
      noInstall: true,
      silent: true,
    });
    expect(res2.success).toBe(true);
    expect(res2.mutatedFilesCount).toBe(0);

    const layoutContent = fs.readFileSync(
      path.join(tempAppDir, "src/app/layout.tsx"),
      "utf8",
    );
    const occurrences = (layoutContent.match(/ClerkProvider/g) || []).length;
    // 1 in import statement, 1 in opening tag, 1 in closing tag = 3 total occurrences
    expect(occurrences).toBe(3);
  });

  it("enforces framework compatibility checks", async () => {
    // Modify temp app to pretend it is a Vite project
    const pkgPath = path.join(tempAppDir, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    delete pkg.dependencies.next;
    pkg.dependencies.vite = "^5.0.0";
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8");

    const result = await addCommand(sampleSkillFixture, {
      cwd: tempAppDir,
      noInstall: true,
      silent: true,
    });

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain(
      'requires framework "nextjs", but target project is "vite"',
    );
  });

  it("installs the canonical auth-supabase-rbac blueprint end-to-end", async () => {
    const supabaseSkillPath = path.resolve(
      __dirname,
      "../../../skills/auth-supabase-rbac",
    );

    const result = await addCommand(supabaseSkillPath, {
      cwd: tempAppDir,
      noInstall: true,
      silent: true,
    });

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.manifest?.id).toBe("auth-supabase-rbac");

    // 1. Verify placed template files
    expect(
      fs.existsSync(path.join(tempAppDir, "src/components/auth-provider.tsx")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tempAppDir, "src/lib/supabase/client.ts")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tempAppDir, "src/lib/supabase/server.ts")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tempAppDir, "supabase/migrations/roles.sql")),
    ).toBe(true);

    // 2. Verify AST patched layout.tsx
    const layoutContent = fs.readFileSync(
      path.join(tempAppDir, "src/app/layout.tsx"),
      "utf8",
    );
    expect(layoutContent).toContain(
      "import { AuthProvider } from '@/components/auth-provider';",
    );
    expect(layoutContent).toContain(
      '<body className="antialiased">\n        <AuthProvider>{children}</AuthProvider>\n      </body>',
    );

    // 3. Verify environment variables
    const envContent = fs.readFileSync(
      path.join(tempAppDir, ".env.local"),
      "utf8",
    );
    expect(envContent).toContain("NEXT_PUBLIC_SUPABASE_URL=");
    expect(envContent).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY=");
    expect(envContent).toContain("SUPABASE_SERVICE_ROLE_KEY=");
  });
});
