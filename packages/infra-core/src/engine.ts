import * as path from "node:path";
import type { SkillManifest } from "@vibe-skill/manifest";
import {
  ConnectorRegistry,
  defaultConnectorRegistry,
} from "./connectors/index.js";
import { maskEnv, maskLogs } from "./env/masker.js";
import { loadProjectEnv, syncEnvFile } from "./env/sync.js";
import type {
  ProvisionContext,
  ProvisionOutput,
  ProvisionResult,
} from "./types.js";

export class InfraEngine {
  constructor(
    private readonly registry: ConnectorRegistry = defaultConnectorRegistry,
  ) {}

  /**
   * Automatically provisions cloud credentials, database migrations, and updates .env.local
   * for a target skill. Enforces strict secret masking and non-destructive mutations.
   */
  async provisionSkill(
    manifest: SkillManifest,
    context: ProvisionContext,
  ): Promise<ProvisionResult> {
    const isDryRun = Boolean(context.dryRun);
    const projectRoot = path.resolve(context.projectRoot);

    // 1. Load existing project environment
    const loadedEnv = loadProjectEnv(projectRoot);
    const mergedEnv = {
      ...loadedEnv,
      ...context.env,
    };

    const connector = this.registry.findConnectorForSkill(manifest);
    let output: ProvisionOutput;

    if (connector) {
      output = await connector.provision(manifest, {
        ...context,
        projectRoot,
        env: mergedEnv,
        dryRun: isDryRun,
      });
    } else {
      // Generic fallback for skills without specialized cloud connectors
      const genericLogs: string[] = [
        `[infra-core] No specialized cloud connector for ${manifest.id}; using declarative manifest defaults.`,
      ];
      const genericVars: Record<string, string> = {};

      for (const item of manifest.env) {
        if (!mergedEnv[item.key]) {
          genericVars[item.key] = "";
          genericLogs.push(
            `[infra-core] Added placeholder template for ${item.key}`,
          );
        }
      }

      output = {
        provider: "generic",
        provisionedVars: genericVars,
        logs: genericLogs,
        appliedMigrations: [],
      };
    }

    // 2. Synchronize newly provisioned variables non-destructively to .env.local
    const targetEnvPath = path.join(projectRoot, ".env.local");
    const descriptions: Record<string, string> = {};
    for (const item of manifest.env) {
      if (item.description) {
        descriptions[item.key] = item.description;
      }
    }

    syncEnvFile(targetEnvPath, output.provisionedVars, {
      skillName: manifest.name,
      dryRun: isDryRun,
      descriptions,
    });

    // 3. Mask secrets in outputs and logs
    const secretKeys = manifest.env
      .filter((item) => item.secret)
      .map((item) => item.key);

    const maskedVars = maskEnv(output.provisionedVars, secretKeys);
    const rawSecretValues = Object.entries(output.provisionedVars)
      .filter(([k]) => secretKeys.includes(k))
      .map(([, v]) => v);

    const sanitizedLogs = maskLogs(output.logs, rawSecretValues);

    return {
      success: true,
      provider: output.provider,
      provisionedVars: output.provisionedVars,
      maskedVars,
      appliedMigrations: output.appliedMigrations || [],
      logs: sanitizedLogs,
      dryRun: isDryRun,
    };
  }
}

export const defaultInfraEngine = new InfraEngine();

export async function provisionSkillResources(
  manifest: SkillManifest,
  context: ProvisionContext,
  registry: ConnectorRegistry = defaultConnectorRegistry,
): Promise<ProvisionResult> {
  const engine = new InfraEngine(registry);
  return engine.provisionSkill(manifest, context);
}
