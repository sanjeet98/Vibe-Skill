import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  loadInstalledSkills,
  type InstalledSkillRecord,
} from "../utils/project.js";

export interface ListOptions {
  cwd?: string;
  silent?: boolean;
}

export function listCommand(options: ListOptions = {}): {
  skills: InstalledSkillRecord[];
} {
  const targetDir = options.cwd || process.cwd();
  const isSilent = Boolean(options.silent);

  if (!isSilent) {
    p.intro(pc.bgCyan(pc.black(" Vibe Skill Installed Skills ")));
  }

  const lockfile = loadInstalledSkills(targetDir);
  const skillsMap = lockfile.skills || lockfile.installedSkills || {};
  const skillsList = Object.values(skillsMap);

  if (skillsList.length === 0) {
    if (!isSilent) {
      p.log.warn("No Vibe Skill skills installed in this project yet.");
      p.outro(
        pc.dim(
          'Run "vibe-skill add <skill-path-or-id>" to install your first skill.',
        ),
      );
    }
    return { skills: [] };
  }

  if (!isSilent) {
    p.log.info(
      `Found ${pc.bold(pc.green(skillsList.length.toString()))} installed skill(s):\n`,
    );

    skillsList.forEach((skill, index) => {
      const num = pc.dim(`${index + 1}.`);
      const name = pc.bold(skill.name || skill.id);
      const id = pc.cyan(`(${skill.id}@${skill.version})`);
      const date = pc.dim(
        `installed ${new Date(skill.installedAt).toLocaleDateString()}`,
      );

      p.log.step(`${num} ${name} ${id} - ${date}`);
      p.log.message(
        pc.dim(
          `   Source: ${skill.source} | Injections: ${skill.injectionsCount}`,
        ),
      );
    });

    p.outro(
      pc.green("Use ") +
        pc.cyan("vibe-skill add <skill>") +
        pc.green(" to add more skills."),
    );
  }

  return { skills: skillsList };
}
