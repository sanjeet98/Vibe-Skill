/**
 * @antigravity/infra-core
 * Core infrastructure, registry client, storage, and execution runtime.
 */

import type { SkillManifest } from "@antigravity/manifest";

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
