import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parseManifestFile, type SkillManifest } from "@vibe-skill/manifest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface LoadedSkill {
  manifest: SkillManifest;
  skillDir: string;
  manifestPath: string;
  rulesContent?: string;
}

/**
 * Searches for skills root directories in the workspace or environment.
 * Supports both VIBE_SKILLS_PATH and legacy ANTIGRAVITY_SKILLS_PATH.
 */
export function getSkillsDirectories(): string[] {
  const dirs: string[] = [];

  const envPath =
    process.env.VIBE_SKILLS_PATH || process.env.ANTIGRAVITY_SKILLS_PATH;
  if (envPath) {
    dirs.push(path.resolve(envPath));
  }

  // Check current working directory
  const cwdSkills = path.resolve(process.cwd(), "skills");
  if (fs.existsSync(cwdSkills) && !dirs.includes(cwdSkills)) {
    dirs.push(cwdSkills);
  }

  // Walk up from __dirname to locate monorepo skills directory
  let curr = __dirname;
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(curr, "skills");
    if (fs.existsSync(candidate) && !dirs.includes(candidate)) {
      dirs.push(candidate);
      break;
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }

  return dirs;
}

/**
 * Scans directories and returns loaded skills with manifests and paths.
 */
export async function getSkillEntries(): Promise<LoadedSkill[]> {
  const skills: LoadedSkill[] = [];
  const searchDirs = getSkillsDirectories();

  for (const rootDir of searchDirs) {
    if (!fs.existsSync(rootDir)) continue;

    try {
      const entries = await fs.promises.readdir(rootDir, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillDir = path.join(rootDir, entry.name);
        const manifestPath = path.join(skillDir, "skill.json");

        if (fs.existsSync(manifestPath)) {
          const res = await parseManifestFile(manifestPath);
          if (res.success) {
            let rulesContent: string | undefined;
            if (res.data.agentContext?.rulesFile) {
              const rulesPath = path.resolve(
                skillDir,
                res.data.agentContext.rulesFile,
              );
              if (fs.existsSync(rulesPath)) {
                rulesContent = await fs.promises.readFile(rulesPath, "utf8");
              }
            }

            if (!skills.some((s) => s.manifest.id === res.data.id)) {
              skills.push({
                manifest: res.data,
                skillDir,
                manifestPath,
                rulesContent,
              });
            }
          } else {
            console.error(
              `[vibe-skill-mcp-server] Invalid skill manifest at ${manifestPath}: ${res.errors.join(", ")}`,
            );
          }
        }
      }
    } catch (err) {
      console.error(
        `[vibe-skill-mcp-server] Failed to scan skills directory ${rootDir}: ${(err as Error).message}`,
      );
    }
  }

  return skills;
}

/**
 * Scans subdirectories in the skills path, reads and validates each skill.json.
 * Ignores or reports invalid directories to stderr.
 */
export async function listSkills(): Promise<SkillManifest[]> {
  const entries = await getSkillEntries();
  return entries.map((e) => e.manifest);
}

/**
 * Locates a specific skill by its unique id.
 */
export async function getSkill(
  skillId: string,
): Promise<{ manifest: SkillManifest; skillDir: string } | null> {
  const cleanId = skillId.trim().toLowerCase();
  const entries = await getSkillEntries();
  const found = entries.find((e) => e.manifest.id.toLowerCase() === cleanId);
  if (!found) return null;
  return {
    manifest: found.manifest,
    skillDir: found.skillDir,
  };
}

/**
 * Reads the markdown instructions specified in agentContext.rulesFile.
 */
export async function getSkillRules(skillId: string): Promise<string | null> {
  const cleanId = skillId.trim().toLowerCase();
  const entries = await getSkillEntries();
  const found = entries.find((e) => e.manifest.id.toLowerCase() === cleanId);
  if (!found) return null;

  if (found.rulesContent) {
    return found.rulesContent;
  }

  if (found.manifest.agentContext?.rulesFile) {
    const rulesPath = path.resolve(
      found.skillDir,
      found.manifest.agentContext.rulesFile,
    );
    if (fs.existsSync(rulesPath)) {
      return await fs.promises.readFile(rulesPath, "utf8");
    }
  }

  return null;
}
