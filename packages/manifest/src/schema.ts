import semver from "semver";
import { z } from "zod";

/**
 * Regular expression validating strict kebab-case identifiers.
 * E.g., "my-skill", "auth-clerk-nextjs", "db-drizzle".
 */
export const KEBAB_CASE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Regular expression validating screaming snake case identifiers for environment variables.
 * E.g., "DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_API_KEY".
 */
export const SCREAMING_SNAKE_CASE_REGEX = /^[A-Z0-9_]+$/;

/**
 * Schema validating semantic version strings.
 */
export const SemverSchema = z
  .string({ message: "Must be a string" })
  .refine((val) => semver.valid(val) !== null, {
    message: 'Must be a valid semantic version (semver), e.g. "1.0.0"',
  });

/**
 * Schema validating kebab-case strings.
 */
export const KebabCaseSchema = z
  .string({ message: "Must be a string" })
  .regex(
    KEBAB_CASE_REGEX,
    'Must be a valid kebab-case string consisting of lowercase alphanumeric characters and single hyphens (e.g. "my-skill")',
  );

/**
 * Compatibility matrix for framework, language, and routing system.
 */
export const CompatibilityConfigSchema = z.object({
  framework: z.enum(["nextjs", "vite", "remix", "fastapi", "astro"], {
    message:
      "Framework must be one of: 'nextjs', 'vite', 'remix', 'fastapi', 'astro'",
  }),
  language: z.enum(["typescript", "javascript", "python"], {
    message: "Language must be one of: 'typescript', 'javascript', 'python'",
  }),
  router: z
    .enum(["app-router", "pages-router", "pages", "none"], {
      message:
        "Router must be 'app-router', 'pages-router', 'pages', or 'none'",
    })
    .nullable()
    .default(null),
  node: z.string().optional(),
});

export type CompatibilityConfig = z.infer<typeof CompatibilityConfigSchema>;

/**
 * NPM dependencies and peer skill dependencies.
 */
export const DependenciesConfigSchema = z.object({
  npm: z.record(z.string(), z.string()).default({}),
  peerSkills: z
    .record(
      z.string(),
      z
        .string()
        .refine(
          (val) =>
            semver.valid(val) !== null || semver.validRange(val) !== null,
          {
            message:
              "Peer skill version must be a valid semver or semver range",
          },
        ),
    )
    .optional(),
});

export type DependenciesConfig = z.infer<typeof DependenciesConfigSchema>;

/**
 * Environment variable specification.
 */
export const EnvVariableSchema = z.object({
  key: z
    .string()
    .min(1, "Environment variable key is required")
    .regex(
      SCREAMING_SNAKE_CASE_REGEX,
      'Environment variable key must be uppercase screaming snake case (e.g. "DATABASE_URL")',
    ),
  required: z.boolean(),
  secret: z.boolean(),
  description: z.string().optional(),
  autoProvision: z.boolean().optional(),
});

export type EnvVariable = z.infer<typeof EnvVariableSchema>;
export type EnvRequirement = EnvVariable;

/**
 * Database schema files mapping and migrations.
 */
export const DatabaseSchemaFileSchema = z.object({
  source: z.string().min(1, "source schema file path is required"),
  target: z.string().min(1, "target schema file path is required"),
  exportTarget: z.string().optional(),
});

export type DatabaseSchemaFile = z.infer<typeof DatabaseSchemaFileSchema>;

export const DatabaseConfigSchema = z.object({
  orm: z.enum(["drizzle", "prisma", "none"], {
    message: "ORM must be either 'drizzle', 'prisma', or 'none'",
  }),
  schemaFiles: z.array(DatabaseSchemaFileSchema),
  migrationCommand: z.string().optional(),
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

/**
 * Import specification for code injection.
 */
export const ImportSpecifierSchema = z.object({
  identifier: z.string().min(1, "import.identifier is required"),
  module: z.string().min(1, "import.module is required"),
});

export type ImportSpecifier = z.infer<typeof ImportSpecifierSchema>;

/**
 * JSX Wrapper AST Mutation:
 * Wraps root layout/app component with a provider or higher-order component.
 */
export const JsxWrapperInjectionSchema = z.object({
  type: z.literal("jsx_wrapper"),
  targetFile: z.string().min(1, "targetFile is required"),
  import: ImportSpecifierSchema,
  wrapperComponent: z.string().min(1, "wrapperComponent is required"),
});

export type JsxWrapperInjection = z.infer<typeof JsxWrapperInjectionSchema>;

/**
 * Named Export AST Mutation:
 * Injects a named re-export or newly defined export into target file.
 */
export const NamedExportInjectionSchema = z.object({
  type: z.literal("named_export"),
  targetFile: z.string().min(1, "targetFile is required"),
  exportName: z.string().min(1, "exportName is required"),
  module: z.string().min(1, "module is required"),
});

export type NamedExportInjection = z.infer<typeof NamedExportInjectionSchema>;

/**
 * Middleware Chain AST Mutation:
 * Injects middleware function step into target request pipeline.
 */
export const MiddlewareChainInjectionSchema = z.object({
  type: z.literal("middleware_chain"),
  targetFile: z.string().min(1, "targetFile is required"),
  import: ImportSpecifierSchema,
  pipelineStep: z.string().min(1, "pipelineStep is required"),
});

export type MiddlewareChainInjection = z.infer<
  typeof MiddlewareChainInjectionSchema
>;

/**
 * AST Injections discriminated union.
 */
export const ASTInjectionSchema = z.discriminatedUnion("type", [
  JsxWrapperInjectionSchema,
  NamedExportInjectionSchema,
  MiddlewareChainInjectionSchema,
]);

export type ASTInjection = z.infer<typeof ASTInjectionSchema>;
export type SkillInjection = ASTInjection;

/**
 * Agent context guidelines and test verification harness.
 */
export const AgentContextConfigSchema = z.object({
  rulesFile: z.string().min(1, "rulesFile is required"),
  testSuite: z.string().optional(),
});

export type AgentContextConfig = z.infer<typeof AgentContextConfigSchema>;

/**
 * Top-level Vibe Skill Manifest Schema (`skill.json`).
 */
export const SkillManifestSchema = z.object({
  schemaVersion: SemverSchema,
  id: KebabCaseSchema,
  name: z.string().min(1, "name is required"),
  version: SemverSchema,
  description: z.string().min(1, "description is required"),
  compatibility: CompatibilityConfigSchema,
  dependencies: DependenciesConfigSchema,
  env: z.array(EnvVariableSchema),
  database: DatabaseConfigSchema.optional(),
  injections: z.array(ASTInjectionSchema),
  agentContext: AgentContextConfigSchema,
});

export type SkillManifest = z.infer<typeof SkillManifestSchema>;
