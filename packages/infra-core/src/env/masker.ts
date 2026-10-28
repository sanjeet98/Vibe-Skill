import type { SecretMaskConfig } from "../types.js";

/**
 * Masks a sensitive string, showing only prefix and suffix if long enough.
 * Example: "sk_test_51Mz...48a2" -> "sk_test_****48a2"
 * Example: "secret12" -> "********"
 */
export function maskSecret(
  value: string,
  config: SecretMaskConfig = {},
): string {
  if (!value) return "";

  const prefixLen = config.visiblePrefixLength ?? 8;
  const suffixLen = config.visibleSuffixLength ?? 4;

  if (value.length <= prefixLen + suffixLen + 4) {
    return "********";
  }

  const prefix = value.slice(0, prefixLen);
  const suffix = value.slice(-suffixLen);
  return `${prefix}****${suffix}`;
}

/**
 * Masks all values in an environment dictionary whose keys are marked as secret.
 */
export function maskEnv(
  env: Record<string, string>,
  secretKeys: string[],
): Record<string, string> {
  const result: Record<string, string> = {};
  const secretSet = new Set(secretKeys.map((k) => k.toUpperCase()));

  for (const [key, val] of Object.entries(env)) {
    if (secretSet.has(key.toUpperCase())) {
      result[key] = maskSecret(val);
    } else {
      result[key] = val;
    }
  }

  return result;
}

/**
 * Sanitizes an array of log lines by replacing any exact matches of raw secret values
 * with their masked representations, preventing accidental leakage in agent traces.
 */
export function maskLogs(logs: string[], rawSecrets: string[]): string[] {
  if (rawSecrets.length === 0) return [...logs];

  const validSecrets = rawSecrets.filter(
    (s) => s && s.length >= 6 && s !== "********",
  );

  return logs.map((log) => {
    let sanitized = log;
    for (const secret of validSecrets) {
      if (sanitized.includes(secret)) {
        sanitized = sanitized.replaceAll(secret, maskSecret(secret));
      }
    }
    return sanitized;
  });
}
