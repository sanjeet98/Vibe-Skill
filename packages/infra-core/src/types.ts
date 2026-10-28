import type { SkillManifest } from "@vibe-skill/manifest";

export interface ProvisionContext {
  projectRoot: string;
  skillId: string;
  env: Record<string, string>; // Current environment variables
  dryRun?: boolean;
}

export interface ProvisionOutput {
  provider: string;
  provisionedVars: Record<string, string>; // Newly generated secrets/keys
  logs: string[];
  appliedMigrations?: string[];
}

export interface ProviderConnector {
  readonly providerName: string;
  canHandle(manifest: SkillManifest): boolean;
  provision(
    manifest: SkillManifest,
    context: ProvisionContext,
  ): Promise<ProvisionOutput>;
}

export interface SecretMaskConfig {
  visiblePrefixLength?: number;
  visibleSuffixLength?: number;
}

export interface EnvSyncResult {
  updated: boolean;
  addedKeys: string[];
  existingKeysPreserved: string[];
  finalContent: string;
}

export interface ProvisionResult {
  success: boolean;
  provider: string;
  provisionedVars: Record<string, string>;
  maskedVars: Record<string, string>;
  appliedMigrations: string[];
  logs: string[];
  error?: string;
  dryRun: boolean;
}
