/**
 * @vibe-skill/infra-core
 * Automated cloud resource and database provisioning engine, environment sync, and secret management.
 */

import type { SkillManifest } from "@vibe-skill/manifest";

export * from "./types.js";
export * from "./env/masker.js";
export * from "./env/sync.js";
export * from "./connectors/index.js";
export * from "./engine.js";

export interface RegistryConfig {
  registryUrl: string;
  cacheDir?: string;
  authToken?: string;
}

export class RegistryClient {
  constructor(private readonly config: RegistryConfig) {}

  async resolveSkill(
    name: string,
    version = "latest",
  ): Promise<SkillManifest | null> {
    return null;
  }

  async fetchSkillBundle(
    name: string,
    version = "latest",
  ): Promise<Uint8Array | null> {
    return null;
  }
}
