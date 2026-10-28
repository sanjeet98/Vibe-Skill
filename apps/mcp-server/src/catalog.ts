import * as fs from "node:fs";
import * as path from "node:path";
import { validateManifest, type SkillManifest } from "@vibe-skill/manifest";
import { getSkillsDirectories, type LoadedSkill } from "./registry.js";

export * from "./registry.js";

/**
 * Scans directories synchronously and returns all valid, discoverable skills.
 */
export function getAllAvailableSkills(): LoadedSkill[] {
  const skills: LoadedSkill[] = [];
  const searchDirs = getSkillsDirectories();

  for (const rootDir of searchDirs) {
    if (!fs.existsSync(rootDir)) continue;

    try {
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
              } else {
                console.error(
                  `[vibe-skill-mcp-server] Invalid skill manifest at ${manifestPath}: ${res.errors.join(", ")}`,
                );
              }
            } catch (err) {
              console.error(
                `[vibe-skill-mcp-server] Failed to parse manifest JSON at ${manifestPath}: ${(err as Error).message}`,
              );
            }
          }
        }
      }
    } catch (err) {
      console.error(
        `[vibe-skill-mcp-server] Failed to read skills directory ${rootDir}: ${(err as Error).message}`,
      );
    }
  }

  return skills;
}

/**
 * Finds a skill by ID from the catalog synchronously.
 */
export function getSkillById(skillId: string): LoadedSkill | null {
  const all = getAllAvailableSkills();
  const cleanId = skillId.trim().toLowerCase();
  return all.find((s) => s.manifest.id.toLowerCase() === cleanId) || null;
}
