import * as fs from "node:fs";
import * as path from "node:path";

export interface InstalledSkillRecord {
  id: string;
  name?: string;
  version: string;
  installedAt: string;
  filesCopied?: string[];
  injectionsApplied?: number;
  injectionsCount?: number;
  source?: string;
}

export interface VibeSkillLockfile {
  schemaVersion?: string;
  version?: string;
  skills: Record<string, InstalledSkillRecord>;
  installedSkills?: Record<string, InstalledSkillRecord>;
}

export type AntigravityLockfile = VibeSkillLockfile;
export type InstalledLockfile = VibeSkillLockfile;

/**
 * Returns path to `<projectRoot>/.vibe-skill/installed.json`.
 */
export function getLockfilePath(projectRoot: string): string {
  return path.join(projectRoot, ".vibe-skill", "installed.json");
}

export const getInstalledLockfilePath = getLockfilePath;

/**
 * Loads the installed skills lockfile, or returns an empty initialized state.
 */
export function loadLockfile(projectRoot: string): VibeSkillLockfile {
  const filePath = getLockfilePath(projectRoot);
  if (!fs.existsSync(filePath)) {
    return {
      version: "1.0.0",
      schemaVersion: "1.0.0",
      skills: {},
      installedSkills: {},
    };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    const skills = data.skills || data.installedSkills || {};
    return {
      version: data.version || data.schemaVersion || "1.0.0",
      schemaVersion: data.schemaVersion || data.version || "1.0.0",
      skills,
      installedSkills: skills,
    };
  } catch {
    return {
      version: "1.0.0",
      schemaVersion: "1.0.0",
      skills: {},
      installedSkills: {},
    };
  }
}

export const loadInstalledSkills = loadLockfile;

/**
 * Saves or updates a skill record in the workspace lockfile.
 */
export function recordSkill(
  projectRoot: string,
  record: InstalledSkillRecord,
): void {
  const lockfile = loadLockfile(projectRoot);
  const skills = lockfile.skills || lockfile.installedSkills || {};

  skills[record.id] = {
    ...record,
    injectionsCount: record.injectionsCount ?? record.injectionsApplied ?? 0,
    injectionsApplied: record.injectionsApplied ?? record.injectionsCount ?? 0,
    filesCopied: record.filesCopied ?? [],
  };

  lockfile.skills = skills;
  lockfile.installedSkills = skills;

  const targetPath = getLockfilePath(projectRoot);
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(lockfile, null, 2), "utf8");
}

export const recordInstalledSkill = recordSkill;
