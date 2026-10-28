import * as fs from "node:fs";
import type { z } from "zod";
import { SkillManifestSchema, type SkillManifest } from "./schema.js";

export type ValidationResult =
  { success: true; data: SkillManifest } | { success: false; errors: string[] };

/**
 * Format Zod validation issues into friendly, human-readable strings
 * pinpointing the exact JSON path and violation.
 */
export function formatZodError(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}

/**
 * Validates unknown JSON input against the Vibe Skill SkillManifest schema.
 *
 * @param json - Parsed JSON object to validate.
 * @returns An object indicating success with parsed data, or failure with formatted error list.
 */
export function validateManifest(json: unknown): ValidationResult {
  const parseResult = SkillManifestSchema.safeParse(json);

  if (parseResult.success) {
    return {
      success: true,
      data: parseResult.data,
    };
  }

  return {
    success: false,
    errors: formatZodError(parseResult.error),
  };
}

/**
 * Reads a JSON file asynchronously and validates its content against SkillManifestSchema.
 * Handles file reading errors (e.g. file not found) and JSON parsing errors gracefully.
 *
 * @param filePath - Path to skill.json file.
 * @returns ValidationResult with parsed manifest or structured errors.
 */
export async function parseManifestFile(
  filePath: string,
): Promise<ValidationResult> {
  let content: string;
  try {
    content = await fs.promises.readFile(filePath, "utf-8");
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      return {
        success: false,
        errors: [`Manifest file not found: ${filePath}`],
      };
    }
    return {
      success: false,
      errors: [`Failed to read manifest file: ${error.message}`],
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch (err) {
    return {
      success: false,
      errors: [`JSON syntax error in manifest file: ${(err as Error).message}`],
    };
  }

  return validateManifest(json);
}

/**
 * Validates unknown JSON input and returns the parsed SkillManifest,
 * or throws an Error containing all validation errors.
 */
export function assertValidManifest(json: unknown): SkillManifest {
  const result = validateManifest(json);
  if (!result.success) {
    throw new Error(
      `Invalid skill manifest:\n  - ${result.errors.join("\n  - ")}`,
    );
  }
  return result.data;
}
