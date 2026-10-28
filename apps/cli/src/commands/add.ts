import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { applyInjections, type SkillInjection } from "@vibe-skill/ast-engine";
import { validateManifest, type SkillManifest } from "@vibe-skill/manifest";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  detectProject,
  recordInstalledSkill,
  type ProjectInfo,
} from "../utils/project.js";

export interface AddOptions {
  cwd?: string;
  dryRun?: boolean;
  yes?: boolean;
  noInstall?: boolean;
  force?: boolean;
  silent?: boolean;
}

export interface AddResult {
  success: boolean;
  manifest?: SkillManifest;
  mutatedFilesCount: number;
  installedDependencies: string[];
  addedEnvVars: string[];
  errors: string[];
}

/**
 * Resolves the path to the skill.json file from a given path or ID.
 */
export function resolveSkillPath(
  skillPathOrId: string,
  cwd: string = process.cwd(),
): { skillDir: string; manifestPath: string } {
  const candidateBases = [process.cwd(), cwd];

  for (const base of candidateBases) {
    const directPath = path.isAbsolute(skillPathOrId)
      ? skillPathOrId
      : path.resolve(base, skillPathOrId);

    // If path is a file ending in .json
    if (
      fs.existsSync(directPath) &&
      fs.statSync(directPath).isFile() &&
      directPath.endsWith(".json")
    ) {
      return {
        skillDir: path.dirname(directPath),
        manifestPath: directPath,
      };
    }

    // If path is a directory containing skill.json
    const inDir = path.join(directPath, "skill.json");
    if (fs.existsSync(inDir) && fs.statSync(inDir).isFile()) {
      return {
        skillDir: directPath,
        manifestPath: inDir,
      };
    }

    // Check workspace / skills/<id>
    const inSkillsDir = path.resolve(
      base,
      "skills",
      skillPathOrId,
      "skill.json",
    );
    if (fs.existsSync(inSkillsDir)) {
      return {
        skillDir: path.dirname(inSkillsDir),
        manifestPath: inSkillsDir,
      };
    }
  }

  throw new Error(
    `Skill not found at "${skillPathOrId}". Expected a directory with "skill.json" or direct file path.`,
  );
}

/**
 * Command: vibe-skill add <skill-path-or-id>
 */
export async function addCommand(
  skillPathOrId: string,
  options: AddOptions = {},
): Promise<AddResult> {
  const targetDir = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const isSilent = Boolean(options.silent);
  const isDryRun = Boolean(options.dryRun);

  if (!isSilent) {
    p.intro(pc.bgCyan(pc.black(" Vibe Skill Installer ")));
  }

  const errors: string[] = [];

  try {
    // 1. Load and validate skill manifest
    const { skillDir, manifestPath } = resolveSkillPath(
      skillPathOrId,
      targetDir,
    );
    const rawManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    const validation = validateManifest(rawManifest);
    if (!validation.success) {
      const errList = validation.errors;
      if (!isSilent) {
        p.log.error(pc.red("Skill manifest validation failed:"));
        errList.forEach((e) => p.log.error(pc.red(`  • ${e}`)));
      }
      return {
        success: false,
        mutatedFilesCount: 0,
        installedDependencies: [],
        addedEnvVars: [],
        errors: errList,
      };
    }

    const manifest = validation.data;
    if (!isSilent) {
      p.log.info(
        `Installing: ${pc.bold(pc.green(manifest.name))} ${pc.dim(`(${manifest.id}@${manifest.version})`)}`,
      );
    }

    // 2. Verify framework compatibility against target project
    const project: ProjectInfo = detectProject(targetDir);

    if (
      project.framework !== "unknown" &&
      manifest.compatibility.framework !== project.framework
    ) {
      const compError = `Skill "${manifest.id}" requires framework "${manifest.compatibility.framework}", but target project is "${project.framework}".`;
      if (!options.force) {
        if (!isSilent) {
          p.log.error(pc.red(compError));
          p.log.warn("Use --force to bypass this compatibility check.");
        }
        return {
          success: false,
          manifest,
          mutatedFilesCount: 0,
          installedDependencies: [],
          addedEnvVars: [],
          errors: [compError],
        };
      } else if (!isSilent) {
        p.log.warn(
          pc.yellow(`[Warning] ${compError} Continuing due to --force.`),
        );
      }
    }

    // 3. Copy schema and template files
    const copiedFiles: string[] = [];
    if (manifest.database?.schemaFiles) {
      for (const item of manifest.database.schemaFiles) {
        const srcPath = path.resolve(skillDir, item.source);
        const destPath = path.resolve(targetDir, item.target);

        if (fs.existsSync(srcPath)) {
          if (!isDryRun) {
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(srcPath, destPath);
          }
          copiedFiles.push(item.target);
          if (!isSilent) {
            p.log.step(`Copied schema: ${pc.dim(item.target)}`);
          }
        }
      }
    }

    // Copy general template files if template/ directory exists
    const templateDir = path.join(skillDir, "template");
    if (fs.existsSync(templateDir) && fs.statSync(templateDir).isDirectory()) {
      const hasSrc = fs.existsSync(path.join(targetDir, "src"));

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

            const targetDest = path.join(targetDir, targetRel);
            if (!isDryRun) {
              fs.mkdirSync(path.dirname(targetDest), { recursive: true });
              fs.copyFileSync(entrySource, targetDest);
            }
            copiedFiles.push(targetRel);
            if (!isSilent) {
              p.log.step(`Placed template file: ${pc.dim(targetRel)}`);
            }
          }
        }
      };

      copyTemplateDir(templateDir, "");
    }

    // 4. Execute AST Injections
    const injectionsToApply: SkillInjection[] = [...manifest.injections];

    // If schema files specify an exportTarget (e.g. src/db/schema/index.ts), inject barrel re-export
    if (manifest.database?.schemaFiles) {
      for (const item of manifest.database.schemaFiles) {
        if (item.exportTarget) {
          // Relative module from exportTarget to target
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

    const astResult = await applyInjections(targetDir, injectionsToApply, {
      dryRun: isDryRun,
    });

    if (!astResult.success) {
      if (!isSilent) {
        p.log.error(pc.red("AST injection failed:"));
        astResult.errors.forEach((e) => p.log.error(pc.red(`  • ${e}`)));
      }
      return {
        success: false,
        manifest,
        mutatedFilesCount: 0,
        installedDependencies: [],
        addedEnvVars: [],
        errors: astResult.errors,
      };
    }

    const changedFiles = astResult.mutatedFiles.filter((m) => m.hasChanged);
    if (!isSilent) {
      changedFiles.forEach((f) => {
        const rel = path.relative(targetDir, f.filePath);
        p.log.step(
          `AST Patched: ${pc.cyan(rel)} ${isDryRun ? pc.yellow("[dry-run]") : ""}`,
        );
      });
    }

    // 5. Environment variables configuration
    const addedEnvVars: string[] = [];
    if (manifest.env && manifest.env.length > 0) {
      const envLocalPath = path.join(targetDir, ".env.local");
      const envPath = path.join(targetDir, ".env");
      const targetEnvFile =
        fs.existsSync(envPath) && !fs.existsSync(envLocalPath)
          ? envPath
          : envLocalPath;

      let existingEnvContent = fs.existsSync(targetEnvFile)
        ? fs.readFileSync(targetEnvFile, "utf8")
        : "";

      const missingEnvEntries = manifest.env.filter((envItem) => {
        const regex = new RegExp(`^${envItem.key}=`, "m");
        return !regex.test(existingEnvContent);
      });

      if (missingEnvEntries.length > 0 && !isDryRun) {
        let appendBlock = "\n# --- Vibe Skill: " + manifest.name + " ---\n";
        for (const envItem of missingEnvEntries) {
          appendBlock += `# ${envItem.description || envItem.key}\n${envItem.key}=\n`;
          addedEnvVars.push(envItem.key);
        }

        fs.writeFileSync(
          targetEnvFile,
          existingEnvContent + appendBlock,
          "utf8",
        );

        // Also update .env.example if present in the target project
        const envExamplePath = path.join(targetDir, ".env.example");
        if (fs.existsSync(envExamplePath)) {
          const exampleContent = fs.readFileSync(envExamplePath, "utf8");
          const missingInExample = manifest.env.filter((envItem) => {
            const regex = new RegExp(`^${envItem.key}=`, "m");
            return !regex.test(exampleContent);
          });
          if (missingInExample.length > 0) {
            let exampleAppend =
              "\n# --- Vibe Skill: " + manifest.name + " ---\n";
            for (const item of missingInExample) {
              exampleAppend += `# ${item.description || item.key}\n${item.key}=\n`;
            }
            fs.writeFileSync(
              envExamplePath,
              exampleContent + exampleAppend,
              "utf8",
            );
          }
        }

        if (!isSilent) {
          p.log.step(
            `Added ${missingEnvEntries.length} environment variables to ${pc.dim(path.basename(targetEnvFile))}`,
          );
        }
      }
    }

    // 6. Dependencies installation
    const installedDeps: string[] = [];
    const npmDeps = manifest.dependencies.npm || {};
    const depEntries = Object.entries(npmDeps);

    if (depEntries.length > 0) {
      const depArgs = depEntries.map(([pkg, version]) => `${pkg}@${version}`);
      installedDeps.push(...depArgs);

      if (!options.noInstall && !isDryRun && project.hasPackageJson) {
        const pm = project.packageManager;
        const installCmd =
          pm === "pnpm"
            ? `pnpm add ${depArgs.join(" ")}`
            : pm === "yarn"
              ? `yarn add ${depArgs.join(" ")}`
              : pm === "bun"
                ? `bun add ${depArgs.join(" ")}`
                : `npm install ${depArgs.join(" ")}`;

        if (!isSilent) {
          p.log.step(`Installing dependencies: ${pc.cyan(installCmd)}`);
        }

        try {
          execSync(installCmd, {
            cwd: targetDir,
            stdio: isSilent ? "ignore" : "inherit",
          });
        } catch {
          if (!isSilent) {
            p.log.warn(
              pc.yellow(
                `Auto-install encountered an error. Run: ${installCmd}`,
              ),
            );
          }
        }
      } else if (!isSilent) {
        p.log.info(`Dependencies required: ${pc.cyan(depArgs.join(", "))}`);
      }
    }

    // 7. Record installed skill in lockfile
    if (!isDryRun) {
      recordInstalledSkill(targetDir, {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        installedAt: new Date().toISOString(),
        source: skillPathOrId,
        injectionsCount: manifest.injections.length,
      });
    }

    if (!isSilent) {
      p.outro(
        pc.green(
          `Successfully ${isDryRun ? "simulated" : "installed"} skill: `,
        ) + pc.bold(manifest.name),
      );
    }

    return {
      success: true,
      manifest,
      mutatedFilesCount: changedFiles.length,
      installedDependencies: installedDeps,
      addedEnvVars,
      errors: [],
    };
  } catch (err) {
    const errorMsg = (err as Error).message;
    errors.push(errorMsg);
    if (!isSilent) {
      p.log.error(pc.red(`Installation failed: ${errorMsg}`));
      p.outro(pc.red("Skill installation aborted."));
    }
    return {
      success: false,
      mutatedFilesCount: 0,
      installedDependencies: [],
      addedEnvVars: [],
      errors,
    };
  }
}
