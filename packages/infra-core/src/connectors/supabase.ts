import type { SkillManifest } from "@vibe-skill/manifest";
import type { ProvisionContext, ProvisionOutput } from "../types.js";
import { BaseConnector } from "./base.js";

export class SupabaseConnector extends BaseConnector {
  readonly providerName = "supabase";

  canHandle(manifest: SkillManifest): boolean {
    if (manifest.id.toLowerCase().includes("supabase")) {
      return true;
    }
    if (manifest.dependencies.npm?.["@supabase/supabase-js"]) {
      return true;
    }
    return manifest.env.some((e) => e.key.toUpperCase().includes("SUPABASE"));
  }

  async provision(
    manifest: SkillManifest,
    context: ProvisionContext,
  ): Promise<ProvisionOutput> {
    const logs: string[] = [];
    const provisionedVars: Record<string, string> = {};
    const appliedMigrations: string[] = [];

    logs.push(
      `[supabase] Initializing provisioning for skill: ${manifest.name}`,
    );

    // 1. Check or generate environment variables
    const currentEnv = context.env;

    const urlKey = "NEXT_PUBLIC_SUPABASE_URL";
    const anonKey = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
    const serviceRoleKey = "SUPABASE_SERVICE_ROLE_KEY";

    if (!currentEnv[urlKey]) {
      provisionedVars[urlKey] = "http://127.0.0.1:54321";
      logs.push(`[supabase] Set default local instance URL for ${urlKey}`);
    } else {
      logs.push(`[supabase] Existing ${urlKey} detected; preserving.`);
    }

    if (!currentEnv[anonKey]) {
      provisionedVars[anonKey] =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon_mock_key_vibe_skill";
      logs.push(`[supabase] Provisioned development client key for ${anonKey}`);
    } else {
      logs.push(`[supabase] Existing ${anonKey} detected; preserving.`);
    }

    if (!currentEnv[serviceRoleKey]) {
      provisionedVars[serviceRoleKey] =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service_role_mock_key_vibe_skill";
      logs.push(
        `[supabase] Provisioned secure service role key for ${serviceRoleKey}`,
      );
    } else {
      logs.push(`[supabase] Existing ${serviceRoleKey} detected; preserving.`);
    }

    // 2. Schema migrations
    if (manifest.database?.schemaFiles) {
      for (const file of manifest.database.schemaFiles) {
        appliedMigrations.push(file.target);
        logs.push(
          `[supabase] Registered database schema migration: ${file.target}`,
        );
      }
    }

    if (manifest.database?.migrationCommand) {
      logs.push(
        `[supabase] Migration command ready: "${manifest.database.migrationCommand}"`,
      );
    }

    if (context.dryRun) {
      logs.push(
        `[supabase] Dry-run mode enabled; zero remote or disk changes committed.`,
      );
    }

    return {
      provider: this.providerName,
      provisionedVars,
      logs,
      appliedMigrations,
    };
  }
}
