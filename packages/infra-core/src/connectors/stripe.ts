import type { SkillManifest } from "@vibe-skill/manifest";
import Stripe from "stripe";
import type { ProvisionContext, ProvisionOutput } from "../types.js";
import { BaseConnector } from "./base.js";

export class StripeConnector extends BaseConnector {
  readonly providerName = "stripe";

  canHandle(manifest: SkillManifest): boolean {
    if (manifest.id.toLowerCase().includes("stripe")) {
      return true;
    }
    if (
      manifest.dependencies.npm?.["stripe"] ||
      manifest.dependencies.npm?.["@stripe/stripe-js"]
    ) {
      return true;
    }
    return manifest.env.some((e) => e.key.toUpperCase().includes("STRIPE"));
  }

  async provision(
    manifest: SkillManifest,
    context: ProvisionContext,
  ): Promise<ProvisionOutput> {
    const logs: string[] = [];
    const provisionedVars: Record<string, string> = {};

    logs.push(`[stripe] Initializing provisioning for skill: ${manifest.name}`);

    const currentEnv = context.env;
    const secretKeyName = "STRIPE_SECRET_KEY";
    const pubKeyName = "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY";
    const webhookSecretName = "STRIPE_WEBHOOK_SECRET";

    // 1. Secret Key
    if (!currentEnv[secretKeyName]) {
      provisionedVars[secretKeyName] = "sk_test_mock_vibe_skill_51NABCxyz789";
      logs.push(`[stripe] Provisioned test secret key: ${secretKeyName}`);
    } else {
      logs.push(`[stripe] Existing ${secretKeyName} detected; preserving.`);
    }

    // 2. Publishable Key
    if (!currentEnv[pubKeyName]) {
      provisionedVars[pubKeyName] = "pk_test_mock_vibe_skill_51NABCxyz789";
      logs.push(`[stripe] Provisioned publishable client key: ${pubKeyName}`);
    } else {
      logs.push(`[stripe] Existing ${pubKeyName} detected; preserving.`);
    }

    // 3. Webhook Signing Secret
    if (!currentEnv[webhookSecretName]) {
      // In live environment with valid Stripe secret key, we can register an endpoint via Stripe API
      const activeKey =
        currentEnv[secretKeyName] || provisionedVars[secretKeyName];
      let generatedWebhook = "whsec_mock_endpoint_secret_vibe_skill_abc123";

      if (activeKey && !activeKey.includes("mock") && !context.dryRun) {
        try {
          const stripeClient = new Stripe(activeKey, {
            apiVersion: "2024-04-10" as unknown as Stripe.LatestApiVersion,
          });
          const endpoint = await stripeClient.webhookEndpoints.create({
            url: "https://example.com/api/webhooks/stripe",
            enabled_events: [
              "checkout.session.completed",
              "customer.subscription.updated",
              "customer.subscription.deleted",
            ],
          });
          if (endpoint.secret) {
            generatedWebhook = endpoint.secret;
            logs.push(
              `[stripe] Registered live webhook endpoint: ${endpoint.id}`,
            );
          }
        } catch (err) {
          logs.push(
            `[stripe] Notice: Stripe API endpoint creation skipped (${(err as Error).message}); using local development secret.`,
          );
        }
      }

      provisionedVars[webhookSecretName] = generatedWebhook;
      logs.push(
        `[stripe] Provisioned webhook signing secret: ${webhookSecretName}`,
      );
    } else {
      logs.push(`[stripe] Existing ${webhookSecretName} detected; preserving.`);
    }

    if (context.dryRun) {
      logs.push(
        `[stripe] Dry-run mode enabled; zero remote webhook or disk mutations executed.`,
      );
    }

    return {
      provider: this.providerName,
      provisionedVars,
      logs,
    };
  }
}
