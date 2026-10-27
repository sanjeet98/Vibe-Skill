import { describe, expect, it } from "vitest";
import {
  assertValidManifest,
  validateManifest,
  type SkillManifest,
} from "../src/index.js";

describe("SkillManifest Schema & Validator", () => {
  const sampleValidManifest: SkillManifest = {
    schemaVersion: "1.0.0",
    id: "auth-clerk-nextjs",
    name: "Clerk Authentication for Next.js",
    version: "0.1.0",
    description:
      "Integrates Clerk auth providers, middleware, and session management into Next.js App Router.",
    compatibility: {
      framework: "nextjs",
      language: "typescript",
      router: "app-router",
    },
    dependencies: {
      npm: {
        "@clerk/nextjs": "^5.0.0",
      },
      peerSkills: {
        "ui-components": "^1.0.0",
      },
    },
    env: [
      {
        key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        required: true,
        secret: false,
        description: "Clerk public publishable key",
        autoProvision: false,
      },
      {
        key: "CLERK_SECRET_KEY",
        required: true,
        secret: true,
        description: "Clerk secret server key",
        autoProvision: true,
      },
    ],
    database: {
      orm: "drizzle",
      schemaFiles: [
        {
          source: "templates/schema.ts",
          target: "src/db/schema/auth.ts",
          exportTarget: "src/db/schema/index.ts",
        },
      ],
      migrationCommand: "pnpm drizzle-kit generate",
    },
    injections: [
      {
        type: "jsx_wrapper",
        targetFile: "src/app/layout.tsx",
        import: {
          identifier: "ClerkProvider",
          module: "@clerk/nextjs",
        },
        wrapperComponent: "ClerkProvider",
      },
      {
        type: "named_export",
        targetFile: "src/auth.ts",
        exportName: "auth",
        module: "@clerk/nextjs/server",
      },
      {
        type: "middleware_chain",
        targetFile: "src/middleware.ts",
        import: {
          identifier: "clerkMiddleware",
          module: "@clerk/nextjs/server",
        },
        pipelineStep: "clerkMiddleware()",
      },
    ],
    agentContext: {
      rulesFile: "prompts/clerk-rules.md",
      testSuite: "tests/auth.spec.ts",
    },
  };

  describe("Valid Manifests", () => {
    it("should validate a complete valid manifest with all fields", () => {
      const result = validateManifest(sampleValidManifest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("auth-clerk-nextjs");
        expect(result.data.compatibility.router).toBe("app-router");
        expect(result.data.injections).toHaveLength(3);
      }
    });

    it("should validate a minimal valid manifest without optional database or peerSkills", () => {
      const minimalManifest = {
        schemaVersion: "1.0.0",
        id: "fastapi-cors",
        name: "FastAPI CORS Support",
        version: "0.2.1",
        description: "Configures cross-origin resource sharing for FastAPI.",
        compatibility: {
          framework: "fastapi",
          language: "python",
          router: null,
        },
        dependencies: {
          npm: {},
        },
        env: [],
        injections: [],
        agentContext: {
          rulesFile: "prompts/cors-rules.md",
        },
      };

      const result = validateManifest(minimalManifest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.database).toBeUndefined();
        expect(result.data.compatibility.router).toBeNull();
        expect(result.data.agentContext.testSuite).toBeUndefined();
      }
    });

    it("should accept null or pages router in compatibility", () => {
      const pagesManifest = {
        ...sampleValidManifest,
        id: "pages-skill",
        compatibility: {
          framework: "nextjs" as const,
          language: "typescript" as const,
          router: "pages" as const,
        },
      };

      const result = validateManifest(pagesManifest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.compatibility.router).toBe("pages");
      }
    });

    it("should accept prisma ORM in database block", () => {
      const prismaManifest = {
        ...sampleValidManifest,
        id: "prisma-skill",
        database: {
          orm: "prisma" as const,
          schemaFiles: [
            {
              source: "templates/user.prisma",
              target: "prisma/schema.prisma",
            },
          ],
        },
      };

      const result = validateManifest(prismaManifest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.database?.orm).toBe("prisma");
      }
    });
  });

  describe("Missing Required Keys", () => {
    it("should fail when schemaVersion is missing", () => {
      const { schemaVersion, ...invalid } = sampleValidManifest;
      const result = validateManifest(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.errors.some((err) => err.startsWith("schemaVersion:")),
        ).toBe(true);
      }
    });

    it("should fail when id is missing", () => {
      const { id, ...invalid } = sampleValidManifest;
      const result = validateManifest(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((err) => err.startsWith("id:"))).toBe(true);
      }
    });

    it("should fail when compatibility framework is missing", () => {
      const invalid = {
        ...sampleValidManifest,
        compatibility: {
          language: "typescript",
          router: "app-router",
        },
      };
      const result = validateManifest(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.errors.some((err) =>
            err.startsWith("compatibility.framework:"),
          ),
        ).toBe(true);
      }
    });

    it("should fail when agentContext.rulesFile is missing", () => {
      const invalid = {
        ...sampleValidManifest,
        agentContext: {},
      };
      const result = validateManifest(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.errors.some((err) =>
            err.startsWith("agentContext.rulesFile:"),
          ),
        ).toBe(true);
      }
    });
  });

  describe("Semantic Version Validation", () => {
    it("should reject invalid semver in schemaVersion", () => {
      const invalid = {
        ...sampleValidManifest,
        schemaVersion: "1.0",
      };
      const result = validateManifest(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.errors.some(
            (err) =>
              err.includes("schemaVersion:") &&
              err.includes("semantic version"),
          ),
        ).toBe(true);
      }
    });

    it("should reject non-semver strings in version", () => {
      const invalid = {
        ...sampleValidManifest,
        version: "beta-v1",
      };
      const result = validateManifest(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.errors.some(
            (err) =>
              err.includes("version:") && err.includes("semantic version"),
          ),
        ).toBe(true);
      }
    });
  });

  describe("Kebab-case ID Validation", () => {
    it.each([
      "CamelCase",
      "snake_case",
      "-leading-hyphen",
      "trailing-hyphen-",
      "double--hyphen",
      "has spaces",
      "@scope/package",
      "",
    ])('should reject invalid kebab-case id: "%s"', (invalidId) => {
      const invalid = {
        ...sampleValidManifest,
        id: invalidId,
      };
      const result = validateManifest(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.errors.some(
            (err) => err.includes("id:") && err.includes("kebab-case"),
          ),
        ).toBe(true);
      }
    });
  });

  describe("Injection Union Discriminators", () => {
    it("should validate jsx_wrapper injection type", () => {
      const manifest = {
        ...sampleValidManifest,
        injections: [
          {
            type: "jsx_wrapper" as const,
            targetFile: "src/app/layout.tsx",
            import: {
              identifier: "ThemeProvider",
              module: "@/components/theme-provider",
            },
            wrapperComponent: "ThemeProvider",
          },
        ],
      };
      const result = validateManifest(manifest);
      expect(result.success).toBe(true);
    });

    it("should validate named_export injection type", () => {
      const manifest = {
        ...sampleValidManifest,
        injections: [
          {
            type: "named_export" as const,
            targetFile: "src/index.ts",
            exportName: "createClient",
            module: "./client",
          },
        ],
      };
      const result = validateManifest(manifest);
      expect(result.success).toBe(true);
    });

    it("should validate middleware_chain injection type", () => {
      const manifest = {
        ...sampleValidManifest,
        injections: [
          {
            type: "middleware_chain" as const,
            targetFile: "src/middleware.ts",
            import: {
              identifier: "rateLimit",
              module: "@/lib/rate-limit",
            },
            pipelineStep: "rateLimit()",
          },
        ],
      };
      const result = validateManifest(manifest);
      expect(result.success).toBe(true);
    });

    it("should reject unknown injection discriminator type", () => {
      const invalid = {
        ...sampleValidManifest,
        injections: [
          {
            type: "unsupported_type",
            targetFile: "src/index.ts",
          },
        ],
      };
      const result = validateManifest(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.errors.some((err) => err.startsWith("injections.0.type:")),
        ).toBe(true);
      }
    });

    it("should pinpoint missing properties within an injection", () => {
      const invalid = {
        ...sampleValidManifest,
        injections: [
          {
            type: "jsx_wrapper",
            targetFile: "src/app/layout.tsx",
            // missing import and wrapperComponent
          },
        ],
      };
      const result = validateManifest(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.errors.some((err) =>
            err.startsWith("injections.0.wrapperComponent:"),
          ),
        ).toBe(true);
      }
    });
  });

  describe("Database ORM Validation", () => {
    it("should reject invalid ORMs", () => {
      const invalid = {
        ...sampleValidManifest,
        database: {
          orm: "typeorm",
          schemaFiles: [],
        },
      };
      const result = validateManifest(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.errors.some((err) => err.startsWith("database.orm:")),
        ).toBe(true);
      }
    });
  });

  describe("assertValidManifest Helper", () => {
    it("should return data when valid", () => {
      const data = assertValidManifest(sampleValidManifest);
      expect(data.id).toBe(sampleValidManifest.id);
    });

    it("should throw an error with detailed message when invalid", () => {
      expect(() =>
        assertValidManifest({
          schemaVersion: "bad-semver",
        }),
      ).toThrowError(/Invalid skill manifest:/);
    });
  });
});
