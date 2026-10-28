import * as fs from "node:fs";
import * as path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  detectProject,
  getInstalledLockfilePath,
  type ProjectInfo,
} from "../utils/project.js";

export interface InitOptions {
  cwd?: string;
  silent?: boolean;
}

export async function initCommand(options: InitOptions = {}): Promise<{
  success: boolean;
  project: ProjectInfo;
}> {
  const targetDir = options.cwd || process.cwd();
  const project = detectProject(targetDir);

  if (!options.silent) {
    p.intro(pc.bgCyan(pc.black(" Vibe Skill CLI ")));
  }

  if (!project.hasPackageJson && project.framework !== "fastapi") {
    if (!options.silent) {
      p.log.error(
        pc.red(
          `No valid project found in ${targetDir} (missing package.json or pyproject.toml).`,
        ),
      );
      p.outro(pc.yellow("Run this command inside a project directory."));
    }
    return { success: false, project };
  }

  // Ensure lockfile directory and installed.json lockfile exist
  const lockfilePath = getInstalledLockfilePath(targetDir);
  const lockfileDir = path.dirname(lockfilePath);
  fs.mkdirSync(lockfileDir, { recursive: true });

  if (!fs.existsSync(lockfilePath)) {
    fs.writeFileSync(
      lockfilePath,
      JSON.stringify(
        {
          schemaVersion: "1.0.0",
          installedSkills: {},
        },
        null,
        2,
      ),
      "utf8",
    );
  }

  if (!options.silent) {
    p.log.success(
      `Project detected: ${pc.bold(project.packageName || path.basename(targetDir))} ${pc.dim(project.packageVersion || "v0.1.0")}`,
    );
    p.log.info(`Framework:       ${pc.cyan(project.framework)}`);
    p.log.info(`Language:        ${pc.cyan(project.language)}`);
    p.log.info(`Router:          ${pc.cyan(project.router || "none")}`);
    p.log.info(`Package Manager: ${pc.cyan(project.packageManager)}`);
    p.log.info(
      `Git Repository:  ${project.hasGit ? pc.green("yes") : pc.yellow("no")}`,
    );

    const relLockfile = path.relative(targetDir, lockfilePath);
    p.log.step(`Initialized ${pc.magenta(relLockfile)} lockfile.`);
    p.outro(
      pc.green("Vibe Skill is ready. Run ") +
        pc.bold(pc.cyan("vibe-skill add <skill>")) +
        pc.green(" to install skills."),
    );
  }

  return { success: true, project };
}
