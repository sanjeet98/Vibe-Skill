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
 * Validates unknown JSON input against the Antigravity SkillManifest schema.
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
