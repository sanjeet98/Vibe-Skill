/**
 * @antigravity/manifest
 * Skill manifest schemas, parsing, and validation definitions.
 */

export interface SkillAuthor {
  name: string;
  email?: string;
  url?: string;
}

export interface SkillCapability {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface SkillManifest {
  schemaVersion: string;
  name: string;
  version: string;
  description: string;
  author: SkillAuthor;
  license?: string;
  repository?: string;
  tags?: string[];
  capabilities?: SkillCapability[];
  dependencies?: Record<string, string>;
}

export function defineSkillManifest(manifest: SkillManifest): SkillManifest {
  return manifest;
}
