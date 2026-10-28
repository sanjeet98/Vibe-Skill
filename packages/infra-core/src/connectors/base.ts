import type { SkillManifest } from "@vibe-skill/manifest";
import type {
  ProviderConnector,
  ProvisionContext,
  ProvisionOutput,
} from "../types.js";

/**
 * Base class for all cloud infrastructure and database connectors.
 */
export abstract class BaseConnector implements ProviderConnector {
  abstract readonly providerName: string;

  abstract canHandle(manifest: SkillManifest): boolean;

  abstract provision(
    manifest: SkillManifest,
    context: ProvisionContext,
  ): Promise<ProvisionOutput>;
}
