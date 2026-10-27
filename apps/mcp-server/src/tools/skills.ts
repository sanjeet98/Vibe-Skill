import * as fs from "node:fs";
import * as path from "node:path";
import { applyInjections, type SkillInjection } from "@antigravity/ast-engine";
import { getAllAvailableSkills, getSkillById } from "../catalog.js";

export interface ListSkillsResponse {
  total: number;
  skills: Array<{
    id: string;
    name: string;
    version: string;
    description: string;
    framework: string;
    language: string;
    router: string | null;
    requiredEnvVars: string[];
    dependencies: string[];
  }>;
}

export interface InspectSkillResponse {
  found: boolean;
  skillId: string;
  manifest?: Record<string, unknown>;
  rulesMarkdown?: string;
  message?: string;
}

export interface InstallSkillResponse {
  success: boolean;
  skillId: string;
  projectPath: string;
  filesCopied: string[];
  astInjectionsApplied: string[];
  envVarsRequired: string[];
  dependencies: Record<string, string>;
  followUpGuidance: string;
  errors: string[];
}

/**
 * Tool: list_available_skills
 */
export function handleListAvailableSkills(): ListSkillsResponse {
  const loaded = getAllAvailableSkills();

  return {
    total: loaded.length,
    skills: loaded.map((s) => ({
      id: s.manifest.id,
      name: s.manifest.name,
      version: s.manifest.version,
      description: s.manifest.description,
      framework: s.manifest.compatibility.framework,
      language: s.manifest.compatibility.language,
      router: s.manifest.compatibility.router,
      requiredEnvVars: s.manifest.env
        .filter((e) => e.required)
        .map((e) => e.key),
      dependencies: Object.keys(s.manifest.dependencies.npm || {}),
    })),
  };
}

/**
 * Tool: inspect_skill
 */
export function handleInspectSkill(skillId: string): InspectSkillResponse {
  const skill = getSkillById(skillId);

  if (!skill) {
    return {
      found: false,
      skillId,
      message: `Skill with id "${skillId}" was not found in the Antigravity catalog. Run list_available_skills to view available packages.`,
    };
  }

  return {
    found: true,
    skillId: skill.manifest.id,
    manifest: skill.manifest as unknown as Record<string, unknown>,
    rulesMarkdown:
      skill.rulesContent ||
      `# ${skill.manifest.name}\n\n${skill.manifest.description}`,
  };
}

/**
 * Tool: install_skill
 */
export async function handleInstallSkill(
  projectPath: string,
  skillId: string,
  options: { skipDependencies?: boolean } = {},
): Promise<InstallSkillResponse> {
  const resolvedProject = path.resolve(projectPath);
  const skill = getSkillById(skillId);

  if (!skill) {
    return {
      success: false,
      skillId,
      projectPath: resolvedProject,
      filesCopied: [],
      astInjectionsApplied: [],
      envVarsRequired: [],
      dependencies: {},
      followUpGuidance: "",
      errors: [`Skill "${skillId}" not found in available catalog.`],
    };
  }

  const manifest = skill.manifest;
  const filesCopied: string[] = [];
  const astInjectionsApplied: string[] = [];
  const envVarsRequired: string[] = manifest.env.map((e) => e.key);

  try {
    // 1. Copy schema and template files
    if (manifest.database?.schemaFiles) {
      for (const item of manifest.database.schemaFiles) {
        const srcPath = path.resolve(skill.skillDir, item.source);
        const destPath = path.resolve(resolvedProject, item.target);

        if (fs.existsSync(srcPath)) {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.copyFileSync(srcPath, destPath);
          filesCopied.push(item.target);
        }
      }
    }

    // 2. Prepare AST injections
    const injectionsToApply: SkillInjection[] = [...manifest.injections];

    if (manifest.database?.schemaFiles) {
      for (const item of manifest.database.schemaFiles) {
        if (item.exportTarget) {
          const relDir = path.relative(
            path.dirname(item.exportTarget),
            item.target,
          );
          const cleanRel = relDir.startsWith(".") ? relDir : `./${relDir}`;
          const moduleSpecifier = cleanRel.replace(/\.tsx?$|\.jsx?$/, "");

          injectionsToApply.push({
            type: "re_export",
            targetFile: item.exportTarget,
            module: moduleSpecifier,
          });
        }
      }
    }

    // 3. Execute AST injections via engine
    if (injectionsToApply.length > 0) {
      const astResult = await applyInjections(
        resolvedProject,
        injectionsToApply,
      );
      if (!astResult.success) {
        return {
          success: false,
          skillId,
          projectPath: resolvedProject,
          filesCopied,
          astInjectionsApplied,
          envVarsRequired,
          dependencies: manifest.dependencies.npm || {},
          followUpGuidance: "Rollback triggered due to AST injection failure.",
          errors: astResult.errors,
        };
      }

      astResult.mutatedFiles
        .filter((m) => m.hasChanged)
        .forEach((m) => {
          astInjectionsApplied.push(path.relative(resolvedProject, m.filePath));
        });
    }

    // 4. Append environment variables to .env.local
    if (manifest.env && manifest.env.length > 0) {
      const envLocalPath = path.join(resolvedProject, ".env.local");
      const envPath = path.join(resolvedProject, ".env");
      const targetEnvFile =
        fs.existsSync(envPath) && !fs.existsSync(envLocalPath)
          ? envPath
          : envLocalPath;

      const existingContent = fs.existsSync(targetEnvFile)
        ? fs.readFileSync(targetEnvFile, "utf8")
        : "";

      const missing = manifest.env.filter((item) => {
        const regex = new RegExp(`^${item.key}=`, "m");
        return !regex.test(existingContent);
      });

      if (missing.length > 0) {
        let block = `\n# --- Antigravity: ${manifest.name} ---\n`;
        for (const item of missing) {
          block += `# ${item.description || item.key}\n${item.key}=\n`;
        }
        fs.writeFileSync(targetEnvFile, existingContent + block, "utf8");
      }
    }

    // 5. Record in .antigravity/installed.json
    const antigravityDir = path.join(resolvedProject, ".antigravity");
    fs.mkdirSync(antigravityDir, { recursive: true });
    const lockfilePath = path.join(antigravityDir, "installed.json");

    let lockData: {
      schemaVersion: string;
      installedSkills: Record<string, unknown>;
    } = {
      schemaVersion: "1.0.0",
      installedSkills: {},
    };

    if (fs.existsSync(lockfilePath)) {
      try {
        lockData = JSON.parse(fs.readFileSync(lockfilePath, "utf8"));
      } catch {
        // Use default
      }
    }

    lockData.installedSkills[manifest.id] = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      installedAt: new Date().toISOString(),
      source: skill.skillDir,
      injectionsCount: manifest.injections.length,
    };

    fs.writeFileSync(lockfilePath, JSON.stringify(lockData, null, 2), "utf8");

    // 6. Generate Follow-Up Guidance for the AI Agent
    const npmDeps = Object.entries(manifest.dependencies.npm || {})
      .map(([k, v]) => `${k}@${v}`)
      .join(" ");

    const guidanceParts = [
      `Skill "${manifest.name}" was successfully installed into ${resolvedProject}.`,
    ];

    if (npmDeps && !options.skipDependencies) {
      guidanceParts.push(
        `Dependencies: Run 'pnpm add ${npmDeps}' (or npm install) in ${resolvedProject}.`,
      );
    }

    if (manifest.env && manifest.env.length > 0) {
      const requiredEnv = manifest.env
        .filter((e) => e.required)
        .map((e) => e.key)
        .join(", ");
      guidanceParts.push(
        `Environment: Populate required keys in .env.local (${requiredEnv}).`,
      );
    }

    if (manifest.database?.migrationCommand) {
      guidanceParts.push(
        `Database: Execute migration command '${manifest.database.migrationCommand}'.`,
      );
    }

    return {
      success: true,
      skillId,
      projectPath: resolvedProject,
      filesCopied,
      astInjectionsApplied,
      envVarsRequired,
      dependencies: manifest.dependencies.npm || {},
      followUpGuidance: guidanceParts.join("\n"),
      errors: [],
    };
  } catch (err) {
    return {
      success: false,
      skillId,
      projectPath: resolvedProject,
      filesCopied,
      astInjectionsApplied,
      envVarsRequired,
      dependencies: manifest.dependencies.npm || {},
      followUpGuidance: "Failed to complete skill installation.",
      errors: [(err as Error).message],
    };
  }
}
