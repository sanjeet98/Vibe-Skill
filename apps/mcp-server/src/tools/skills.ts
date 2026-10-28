import * as fs from "node:fs";
import * as path from "node:path";
import { applyInjections, type SkillInjection } from "@vibe-skill/ast-engine";
import { getAllAvailableSkills, getSkillById } from "../catalog.js";

export interface ListSkillsOptions {
  framework?: string;
}

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

export interface InstallSkillOptions {
  dryRun?: boolean;
  skipDependencies?: boolean;
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
  dryRun?: boolean;
}

/**
 * Tool: list_available_skills
 */
export function handleListAvailableSkills(
  filter: ListSkillsOptions = {},
): ListSkillsResponse {
  let loaded = getAllAvailableSkills();

  if (filter.framework) {
    const target = filter.framework.trim().toLowerCase();
    loaded = loaded.filter(
      (s) => s.manifest.compatibility.framework.toLowerCase() === target,
    );
  }

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
      message: `Skill with id "${skillId}" was not found in the Vibe Skill catalog. Run list_available_skills to view available packages.`,
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
  options: InstallSkillOptions = {},
): Promise<InstallSkillResponse> {
  const resolvedProject = path.resolve(projectPath);
  const isDryRun = Boolean(options.dryRun);

  // 1. Verify target directory contains package.json
  const pkgJsonPath = path.join(resolvedProject, "package.json");
  if (!fs.existsSync(pkgJsonPath)) {
    return {
      success: false,
      skillId,
      projectPath: resolvedProject,
      filesCopied: [],
      astInjectionsApplied: [],
      envVarsRequired: [],
      dependencies: {},
      followUpGuidance: "",
      errors: [
        `Target directory "${resolvedProject}" does not contain a package.json file.`,
      ],
      dryRun: isDryRun,
    };
  }

  // 2. Retrieve skill
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
      dryRun: isDryRun,
    };
  }

  const manifest = skill.manifest;
  const filesCopied: string[] = [];
  const astInjectionsApplied: string[] = [];
  const envVarsRequired: string[] = manifest.env.map((e) => e.key);

  try {
    // 3. Copy schema and template files
    if (manifest.database?.schemaFiles) {
      for (const item of manifest.database.schemaFiles) {
        const srcPath = path.resolve(skill.skillDir, item.source);
        const destPath = path.resolve(resolvedProject, item.target);

        if (fs.existsSync(srcPath)) {
          if (!isDryRun) {
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(srcPath, destPath);
          }
          filesCopied.push(item.target);
        }
      }
    }

    // Copy general template files if template/ directory exists
    const templateDir = path.join(skill.skillDir, "template");
    if (fs.existsSync(templateDir) && fs.statSync(templateDir).isDirectory()) {
      const hasSrc = fs.existsSync(path.join(resolvedProject, "src"));

      const copyTemplateDir = (sourceDir: string, relativePrefix: string) => {
        const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
        for (const entry of entries) {
          const entrySource = path.join(sourceDir, entry.name);
          const relPath = relativePrefix
            ? path.join(relativePrefix, entry.name)
            : entry.name;

          if (entry.isDirectory()) {
            copyTemplateDir(entrySource, relPath);
          } else if (entry.isFile()) {
            let targetRel = relPath;
            if (hasSrc) {
              if (
                relPath.startsWith("components/") ||
                relPath.startsWith("lib/") ||
                relPath === "middleware.ts"
              ) {
                targetRel = path.join("src", relPath);
              } else if (relPath.startsWith("schema/")) {
                targetRel = path.join(
                  "supabase",
                  "migrations",
                  path.basename(relPath),
                );
              }
            } else if (relPath.startsWith("schema/")) {
              targetRel = path.join(
                "supabase",
                "migrations",
                path.basename(relPath),
              );
            }

            const targetDest = path.join(resolvedProject, targetRel);
            if (!isDryRun) {
              fs.mkdirSync(path.dirname(targetDest), { recursive: true });
              fs.copyFileSync(entrySource, targetDest);
            }
            filesCopied.push(targetRel);
          }
        }
      };

      copyTemplateDir(templateDir, "");
    }

    // 4. Prepare AST injections
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

    // 5. Execute AST injections via engine
    if (injectionsToApply.length > 0) {
      const astResult = await applyInjections(
        resolvedProject,
        injectionsToApply,
        { dryRun: isDryRun },
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
          dryRun: isDryRun,
        };
      }

      astResult.mutatedFiles
        .filter((m) => m.hasChanged)
        .forEach((m) => {
          astInjectionsApplied.push(path.relative(resolvedProject, m.filePath));
        });
    }

    // 6. Append environment variables to .env.local
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

      if (missing.length > 0 && !isDryRun) {
        let block = `\n# --- Vibe Skill: ${manifest.name} ---\n`;
        for (const item of missing) {
          block += `# ${item.description || item.key}\n${item.key}=\n`;
        }
        fs.writeFileSync(targetEnvFile, existingContent + block, "utf8");
      }
    }

    // 7. Record in .vibe-skill/installed.json
    if (!isDryRun) {
      const lockDirs = [path.join(resolvedProject, ".vibe-skill")];
      // Support legacy .antigravity directory if present
      if (fs.existsSync(path.join(resolvedProject, ".antigravity"))) {
        lockDirs.push(path.join(resolvedProject, ".antigravity"));
      }

      for (const baseDir of lockDirs) {
        const lockfilePath = path.join(baseDir, "installed.json");
        fs.mkdirSync(baseDir, { recursive: true });

        let lockData: {
          version?: string;
          schemaVersion: string;
          skills: Record<string, unknown>;
          installedSkills: Record<string, unknown>;
        } = {
          version: "1.0.0",
          schemaVersion: "1.0.0",
          skills: {},
          installedSkills: {},
        };

        if (fs.existsSync(lockfilePath)) {
          try {
            const raw = JSON.parse(fs.readFileSync(lockfilePath, "utf8"));
            const existingSkills = raw.skills || raw.installedSkills || {};
            lockData = {
              version: raw.version || raw.schemaVersion || "1.0.0",
              schemaVersion: raw.schemaVersion || raw.version || "1.0.0",
              skills: existingSkills,
              installedSkills: existingSkills,
            };
          } catch {
            // Use default
          }
        }

        const skillRecord = {
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          installedAt: new Date().toISOString(),
          source: skill.skillDir,
          injectionsCount: manifest.injections.length,
          filesCopied,
          mutatedFiles: astInjectionsApplied,
        };

        lockData.skills[manifest.id] = skillRecord;
        lockData.installedSkills[manifest.id] = skillRecord;

        fs.writeFileSync(
          lockfilePath,
          JSON.stringify(lockData, null, 2),
          "utf8",
        );
      }
    }

    // 8. Generate Follow-Up Guidance for the AI Agent
    const npmDeps = Object.entries(manifest.dependencies.npm || {})
      .map(([k, v]) => `${k}@${v}`)
      .join(" ");

    const guidanceParts = [
      isDryRun
        ? `[Dry Run] Skill "${manifest.name}" would be installed into ${resolvedProject}. No changes were written to disk.`
        : `Skill "${manifest.name}" was successfully installed into ${resolvedProject}.`,
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
      dryRun: isDryRun,
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
      dryRun: isDryRun,
    };
  }
}
