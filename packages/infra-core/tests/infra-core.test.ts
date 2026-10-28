import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { SkillManifest } from "@vibe-skill/manifest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ConnectorRegistry,
  InfraEngine,
  StripeConnector,
  SupabaseConnector,
  loadProjectEnv,
  maskEnv,
  maskLogs,
  maskSecret,
  provisionSkillResources,
  syncEnvFile,
} from "../src/index.js";

const mockSupabaseManifest: SkillManifest = {
  schemaVersion: "1.0.0",
  id: "auth-supabase-rbac",
  name: "Supabase Auth & RBAC",
  version: "1.0.0",
  description: "Supabase Auth with RBAC",
  compatibility: {
    framework: "nextjs",
    language: "typescript",
    router: "app-router",
  },
  dependencies: {
    npm: {
      "@supabase/supabase-js": "^2.49.0",
    },
  },
  database: {
    orm: "none",
    migrationCommand: "supabase db push",
    schemaFiles: [
      {
        source: "template/schema/roles.sql",
        target: "supabase/migrations/roles.sql",
      },
    ],
  },
  env: [
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      required: true,
      secret: false,
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      required: true,
      secret: false,
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      required: true,
      secret: true,
    },
  ],
  injections: [],
  agentContext: {
    rulesFile: "agent/rules.md",
  },
};

const mockStripeManifest: SkillManifest = {
  schemaVersion: "1.0.0",
  id: "payments-stripe-subscriptions",
  name: "Stripe Subscriptions",
  version: "1.0.0",
  description: "Stripe Billing and Subscriptions",
  compatibility: {
    framework: "nextjs",
    language: "typescript",
    router: "app-router",
  },
  dependencies: {
    npm: {
      stripe: "^15.0.0",
    },
  },
  env: [
    {
      key: "STRIPE_SECRET_KEY",
      required: true,
      secret: true,
    },
    {
      key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      required: true,
      secret: false,
    },
    {
      key: "STRIPE_WEBHOOK_SECRET",
      required: true,
      secret: true,
    },
  ],
  injections: [],
  agentContext: {
    rulesFile: "agent/rules.md",
  },
};

describe("@vibe-skill/infra-core: Cloud Provisioning Engine", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "infra-core-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe("Secret Masker (`src/env/masker.ts`)", () => {
    it("masks secrets correctly based on length", () => {
      expect(maskSecret("short")).toBe("********");
      expect(maskSecret("sk_test_51Mz0000000000000000048a2")).toBe(
        "sk_test_****48a2",
      );
    });

    it("masks only secret keys in an environment object", () => {
      const rawEnv = {
        PUBLIC_URL: "https://example.com",
        API_TOKEN: "secret_token_1234567890",
      };
      const masked = maskEnv(rawEnv, ["API_TOKEN"]);
      expect(masked.PUBLIC_URL).toBe("https://example.com");
      expect(masked.API_TOKEN).toContain("****");
      expect(masked.API_TOKEN).not.toBe("secret_token_1234567890");
    });

    it("masks exact secret occurrences in log streams", () => {
      const rawSecret = "super_secret_key_99999";
      const logs = [
        "Starting provisioning...",
        `Generated secret key: ${rawSecret}`,
        "Complete.",
      ];
      const sanitized = maskLogs(logs, [rawSecret]);
      expect(sanitized[1]).not.toContain(rawSecret);
      expect(sanitized[1]).toContain("****");
    });
  });

  describe("Environment Synchronizer (`src/env/sync.ts`)", () => {
    it("loads project env merging .env and .env.local with proper priority", () => {
      fs.writeFileSync(
        path.join(tempDir, ".env"),
        "VAR_A=from_env\nVAR_B=from_env\n",
        "utf8",
      );
      fs.writeFileSync(
        path.join(tempDir, ".env.local"),
        "VAR_B=from_local\nVAR_C=from_local\n",
        "utf8",
      );

      const loaded = loadProjectEnv(tempDir);
      expect(loaded.VAR_A).toBe("from_env");
      expect(loaded.VAR_B).toBe("from_local");
      expect(loaded.VAR_C).toBe("from_local");
    });

    it("synchronizes variables non-destructively preserving existing user keys", () => {
      const envLocal = path.join(tempDir, ".env.local");
      fs.writeFileSync(
        envLocal,
        "# User comment\nEXISTING_KEY=original_val\n",
        "utf8",
      );

      const result = syncEnvFile(
        envLocal,
        {
          EXISTING_KEY: "overwritten_attempt",
          NEW_KEY: "new_value",
        },
        {
          skillName: "Test Skill",
          descriptions: { NEW_KEY: "Test description" },
        },
      );

      expect(result.updated).toBe(true);
      expect(result.existingKeysPreserved).toContain("EXISTING_KEY");
      expect(result.addedKeys).toContain("NEW_KEY");

      const fileOnDisk = fs.readFileSync(envLocal, "utf8");
      expect(fileOnDisk).toContain("EXISTING_KEY=original_val");
      expect(fileOnDisk).toContain("# --- Test Skill ---");
      expect(fileOnDisk).toContain("# Test description");
      expect(fileOnDisk).toContain("NEW_KEY=new_value");
    });

    it("respects dryRun mode without modifying disk", () => {
      const envLocal = path.join(tempDir, ".env.local");
      const result = syncEnvFile(envLocal, { KEY: "val" }, { dryRun: true });

      expect(result.updated).toBe(true);
      expect(fs.existsSync(envLocal)).toBe(false);
      expect(result.finalContent).toContain("KEY=val");
    });
  });

  describe("Supabase Connector (`src/connectors/supabase.ts`)", () => {
    it("detects Supabase skill and provisions dev credentials & migrations", async () => {
      const connector = new SupabaseConnector();
      expect(connector.canHandle(mockSupabaseManifest)).toBe(true);

      const output = await connector.provision(mockSupabaseManifest, {
        projectRoot: tempDir,
        skillId: mockSupabaseManifest.id,
        env: {},
      });

      expect(output.provider).toBe("supabase");
      expect(output.provisionedVars.NEXT_PUBLIC_SUPABASE_URL).toBe(
        "http://127.0.0.1:54321",
      );
      expect(
        output.provisionedVars.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ).toBeDefined();
      expect(output.provisionedVars.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();
      expect(output.appliedMigrations).toContain(
        "supabase/migrations/roles.sql",
      );
    });

    it("preserves pre-existing Supabase keys in context.env", async () => {
      const connector = new SupabaseConnector();
      const output = await connector.provision(mockSupabaseManifest, {
        projectRoot: tempDir,
        skillId: mockSupabaseManifest.id,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: "https://custom-project.supabase.co",
        },
      });

      expect(output.provisionedVars.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
      expect(
        output.logs.some((l) =>
          l.includes("Existing NEXT_PUBLIC_SUPABASE_URL"),
        ),
      ).toBe(true);
    });
  });

  describe("Stripe Connector (`src/connectors/stripe.ts`)", () => {
    it("detects Stripe skill and provisions secret, publishable, and webhook keys", async () => {
      const connector = new StripeConnector();
      expect(connector.canHandle(mockStripeManifest)).toBe(true);

      const output = await connector.provision(mockStripeManifest, {
        projectRoot: tempDir,
        skillId: mockStripeManifest.id,
        env: {},
      });

      expect(output.provider).toBe("stripe");
      expect(output.provisionedVars.STRIPE_SECRET_KEY).toContain("sk_test_");
      expect(
        output.provisionedVars.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      ).toContain("pk_test_");
      expect(output.provisionedVars.STRIPE_WEBHOOK_SECRET).toContain("whsec_");
    });
  });

  describe("InfraEngine Orchestrator (`src/engine.ts`)", () => {
    it("provisions resources end-to-end, writes .env.local, and masks secrets in outputs", async () => {
      const engine = new InfraEngine();
      const result = await engine.provisionSkill(mockSupabaseManifest, {
        projectRoot: tempDir,
        skillId: mockSupabaseManifest.id,
        env: {},
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe("supabase");
      expect(result.appliedMigrations).toContain(
        "supabase/migrations/roles.sql",
      );

      // Raw secrets available in provisionedVars
      expect(result.provisionedVars.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();

      // Masked secrets in maskedVars
      expect(result.maskedVars.SUPABASE_SERVICE_ROLE_KEY).toContain("****");

      // Verify written to .env.local on disk
      const envLocal = path.join(tempDir, ".env.local");
      expect(fs.existsSync(envLocal)).toBe(true);
      const content = fs.readFileSync(envLocal, "utf8");
      expect(content).toContain("NEXT_PUBLIC_SUPABASE_URL=");
      expect(content).toContain("SUPABASE_SERVICE_ROLE_KEY=");

      // Verify logs do not leak raw secret tokens
      const rawSecret = result.provisionedVars.SUPABASE_SERVICE_ROLE_KEY;
      expect(result.logs.some((l) => l.includes(rawSecret))).toBe(false);
    });

    it("respects dryRun and leaves project files intact", async () => {
      const result = await provisionSkillResources(mockSupabaseManifest, {
        projectRoot: tempDir,
        skillId: mockSupabaseManifest.id,
        env: {},
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);

      // Verify .env.local was NOT created
      expect(fs.existsSync(path.join(tempDir, ".env.local"))).toBe(false);
    });
  });
});
