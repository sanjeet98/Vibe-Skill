import type { SkillManifest } from "@vibe-skill/manifest";
import type { ProviderConnector } from "../types.js";
import { BaseConnector } from "./base.js";
import { StripeConnector } from "./stripe.js";
import { SupabaseConnector } from "./supabase.js";

export * from "./base.js";
export * from "./stripe.js";
export * from "./supabase.js";

export class ConnectorRegistry {
  private connectors: Map<string, ProviderConnector> = new Map();

  constructor() {
    this.registerConnector(new SupabaseConnector());
    this.registerConnector(new StripeConnector());
  }

  registerConnector(connector: ProviderConnector): void {
    this.connectors.set(connector.providerName.toLowerCase(), connector);
  }

  getConnector(providerName: string): ProviderConnector | undefined {
    return this.connectors.get(providerName.toLowerCase());
  }

  getAllConnectors(): ProviderConnector[] {
    return Array.from(this.connectors.values());
  }

  findConnectorForSkill(
    manifest: SkillManifest,
  ): ProviderConnector | undefined {
    for (const connector of this.connectors.values()) {
      if (connector.canHandle(manifest)) {
        return connector;
      }
    }
    return undefined;
  }
}

export const defaultConnectorRegistry = new ConnectorRegistry();
