import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { validateManifest, type SkillManifest } from "@vibe-skill/manifest";

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
 */
export function getSkillsDirectories(): string[] {
  const dirs: string[] = [];

  if (process.env.VIBE_SKILLS_PATH) {
    dirs.push(path.resolve(process.env.VIBE_SKILLS_PATH));
  } else if (process.env.ANTIGRAVITY_SKILLS_PATH) {
    dirs.push(path.resolve(process.env.ANTIGRAVITY_SKILLS_PATH));
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
 * Scans directories and returns all valid, discoverable skills.
 */
export function getAllAvailableSkills(): LoadedSkill[] {
  const skills: LoadedSkill[] = [];
  const searchDirs = getSkillsDirectories();

  for (const rootDir of searchDirs) {
    if (!fs.existsSync(rootDir)) continue;

    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillDir = path.join(rootDir, entry.name);
        const manifestPath = path.join(skillDir, "skill.json");

        if (fs.existsSync(manifestPath)) {
          try {
            const raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
            const res = validateManifest(raw);
            if (res.success) {
              let rulesContent: string | undefined;
              if (res.data.agentContext?.rulesFile) {
                const rulesPath = path.resolve(
                  skillDir,
                  res.data.agentContext.rulesFile,
                );
                if (fs.existsSync(rulesPath)) {
                  rulesContent = fs.readFileSync(rulesPath, "utf8");
                }
              }

              // Avoid duplicates
              if (!skills.some((s) => s.manifest.id === res.data.id)) {
                skills.push({
                  manifest: res.data,
                  skillDir,
                  manifestPath,
                  rulesContent,
                });
              }
            }
          } catch {
            // Skip invalid json
          }
        }
      }
    }
  }

  return skills;
}

/**
 * Finds a skill by ID from the catalog.
 */
export function getSkillById(skillId: string): LoadedSkill | null {
  const all = getAllAvailableSkills();
  const cleanId = skillId.trim().toLowerCase();
  return all.find((s) => s.manifest.id.toLowerCase() === cleanId) || null;
}
