import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import type { EnvSyncResult } from "../types.js";

/**
 * Loads and merges environment variables from a target project directory.
 * Priority: .env.local takes precedence over .env.
 */
export function loadProjectEnv(projectRoot: string): Record<string, string> {
  const env: Record<string, string> = {};

  const envPath = path.join(projectRoot, ".env");
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf8");
      const parsed = dotenv.parse(content);
      Object.assign(env, parsed);
    } catch {
      // Ignore parse failure
    }
  }

  const envLocalPath = path.join(projectRoot, ".env.local");
  if (fs.existsSync(envLocalPath)) {
    try {
      const content = fs.readFileSync(envLocalPath, "utf8");
      const parsed = dotenv.parse(content);
      Object.assign(env, parsed);
    } catch {
      // Ignore parse failure
    }
  }

  return env;
}

export interface SyncEnvOptions {
  skillName?: string;
  dryRun?: boolean;
  descriptions?: Record<string, string>;
}

/**
 * Non-destructively synchronizes variables into a project's `.env.local` file.
 * Preserves all pre-existing user variables, comments, and structure.
 */
export function syncEnvFile(
  targetEnvPath: string,
  varsToSync: Record<string, string>,
  options: SyncEnvOptions = {},
): EnvSyncResult {
  const isDryRun = Boolean(options.dryRun);
  let existingContent = "";
  let parsedExisting: Record<string, string> = {};

  if (fs.existsSync(targetEnvPath)) {
    existingContent = fs.readFileSync(targetEnvPath, "utf8");
    try {
      parsedExisting = dotenv.parse(existingContent);
    } catch {
      parsedExisting = {};
    }
  }

  const addedKeys: string[] = [];
  const existingKeysPreserved: string[] = [];
  const toAppend: Array<{ key: string; value: string; description?: string }> =
    [];

  for (const [key, value] of Object.entries(varsToSync)) {
    if (Object.prototype.hasOwnProperty.call(parsedExisting, key)) {
      existingKeysPreserved.push(key);
    } else {
      addedKeys.push(key);
      toAppend.push({
        key,
        value,
        description: options.descriptions?.[key],
      });
    }
  }

  let finalContent = existingContent;

  if (toAppend.length > 0) {
    let block = "";
    if (finalContent.length > 0 && !finalContent.endsWith("\n")) {
      block += "\n";
    }

    const title = options.skillName || "Vibe Skill Configuration";
    block += `\n# --- ${title} ---\n`;

    for (const item of toAppend) {
      if (item.description) {
        block += `# ${item.description}\n`;
      }
      block += `${item.key}=${item.value}\n`;
    }

    finalContent += block;
  }

  const updated = addedKeys.length > 0;

  if (updated && !isDryRun) {
    fs.mkdirSync(path.dirname(targetEnvPath), { recursive: true });
    fs.writeFileSync(targetEnvPath, finalContent, "utf8");
  }

  return {
    updated,
    addedKeys,
    existingKeysPreserved,
    finalContent,
  };
}
