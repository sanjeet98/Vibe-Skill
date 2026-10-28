# Changelog

All notable changes to the **Vibe Skill** platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed

- **Platform Branding & Renaming to "Vibe Skill"**:
  - Established platform and CLI name as "Vibe Skill" across all documentation files, specifications, architecture diagrams, and operational governance files.
  - Aligned CLI binary (`vibe-skill`) and MCP server package (`@vibe-skill/mcp-server`), environment variables (`VIBE_SKILLS_PATH`), and lockfile path (`.vibe-skill/installed.json`).
  - Completely purged legacy references from all pages, codebases, tests, and configuration files.

### Added

- **Cloud Resource & Database Provisioning Engine (`@vibe-skill/infra-core`)**:
  - Implemented `ProviderConnector` architecture and `ConnectorRegistry` for automated third-party cloud resource provisioning.
  - Implemented `SupabaseConnector` for automated environment variable generation (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and database schema migration queues.
  - Implemented `StripeConnector` for payment configuration, test API keys, and automated webhook endpoint/secret management.
  - Implemented non-destructive `.env.local` synchronizer (`syncEnvFile`) that cleanly appends configuration blocks while strictly preserving existing user keys.
  - Implemented `SecretMasker` (`maskSecret`, `maskEnv`, `maskLogs`) ensuring zero raw secret leakage in agent traces and CLI logs per `SECURITY.md` and `AGENTS.md`.
  - Implemented `InfraEngine` orchestrator and `provisionSkillResources` entrypoint supporting full `dryRun` simulation mode.
  - Added unit and integration test suite with 11 tests across connectors, environment synchronization, secret masking, and engine orchestration (`packages/infra-core/tests/infra-core.test.ts`).
- **Canonical Skill: Supabase Authentication & RBAC (`skills/auth-supabase-rbac`)**:
  - Implemented production-ready reference skill package for Next.js App Router applications.
  - Manifest (`skill.json`): Configured with `@supabase/supabase-js`, `@supabase/ssr`, environment variables, declarative database schema migrations (`roles.sql`), JSX root wrapping, and middleware session update chain.
  - Architecture Rules (`agent/rules.md`): Detailed AI agent guide covering Client Components (`useAuth`), Server Components (`createClient`, `supabase.auth.getUser()`), Server Actions, and Postgres RLS policies.
  - Template Codebase (`template/`): Implemented `AuthProvider`, typed browser/server/middleware Supabase client factories with `CookieOptions`, and robust SQL schema migrations (`roles.sql`).
  - Integration Tests: Validated end-to-end scaffolding via both CLI `vibe-skill add` and MCP `install_skill`.
- **Official Model Context Protocol Server (`@vibe-skill/mcp-server`)**:
  - Implemented registry scanner module (`apps/mcp-server/src/registry.ts`) with `listSkills()`, `getSkill()`, and `getSkillRules()`.
  - Added dual server architecture supporting both high-level `McpServer` and low-level `Server` with `ListToolsRequestSchema` and `CallToolRequestSchema` error handling in `apps/mcp-server/src/server.ts`.
  - Implemented `list_available_skills` with optional framework filtering (`nextjs`, `vite`).
  - Implemented `inspect_skill` returning full manifest specifications and architectural rules markdown.
  - Implemented `install_skill` supporting `dryRun` simulation, `package.json` prerequisite validation, AST injection, `.env.local` provisioning, and workspace lockfile updating.
  - Enforced strict stdio protocol cleanliness routing diagnostic and lifecycle messages exclusively to `process.stderr` (`console.error()`).
  - Added comprehensive test suite with 13 unit tests across registry, tools, dryRun mode, and server initializations (`apps/mcp-server/tests/mcp-server.test.ts`).
  - Updated agent integration guide (`docs/specs/mcp-configuration.md`) covering Cursor, Claude Desktop, Claude Code, and Windsurf.
- **Workspace Lockfile Management & CLI Enhancements (`@vibe-skill/cli`)**:
  - Implemented modular lockfile utilities in `apps/cli/src/utils/lockfile.ts` with `loadLockfile`, `recordSkill`, and `getLockfilePath` supporting `.vibe-skill/installed.json`.
  - Added full dual-compatibility for `.skills` and `.installedSkills` schemas and aliases in `apps/cli/src/utils/project.ts`.
  - Extended CLI test suite (`apps/cli/tests/cli.test.ts`) with dedicated lockfile unit tests verifying creation, schema compatibility, and normalized injection tracking (all 11 CLI tests passing).
  - Hardened `apps/cli/src/commands/list.ts` to strictly handle nullable skills collections and fallback names under strict TypeScript checking.
- **Deterministic AST Engine Enhancements (`@vibe-skill/ast-engine`)**:
  - Implemented `injectNamedImport` returning boolean change flags.
  - Implemented `injectStarExport` for idempotent barrel exports.
  - Added `applySkillInjections` and `AstEngine` orchestrator returning categorized `modifiedFiles` and `skippedFiles`.
  - Configured dual CJS/ESM distribution with TypeScript declaration maps using `tsup`.
- **Manifest Specification Enhancements (`@vibe-skill/manifest`)**:
  - Added screaming snake case validation (`/^[A-Z0-9_]+$/`) for environment variable keys.
  - Added `astro` framework, `javascript` language, `none` router, and optional `node` runtime constraints to `CompatibilityConfigSchema`.
  - Added `none` ORM support to `DatabaseConfigSchema`.
  - Added `parseManifestFile` asynchronous file loader handling missing files and malformed JSON syntax gracefully.
  - Added dual CJS/ESM bundling with `.d.ts` via `tsup`.
- **Developer Tooling & Pre-Flight Git Hooks**:
  - Configured Husky v9 git hooks for `commit-msg` (enforcing Conventional Commits via `@commitlint/cli` and `@commitlint/config-conventional`) and `pre-commit` (running `lint-staged`).
  - Added `lint-staged` configuration formatting `*.{ts,tsx,json,md}` with Prettier before commits.
  - Added `@vibe-skill/tsconfig/node.json` extending strict base configuration tailored for Node libraries and CLI.
  - Enhanced GitHub Actions CI workflow to validate Node 20 across `main` and `develop` branches running `pnpm turbo run lint test build`.
- **Continuous File Currency & Synchronization Rule**:
  - Established workspace-wide file synchronization invariant ensuring documentation, specifications, schemas, lockfiles, tests, and changelog remain 100% current whenever code changes occur.
  - Added dedicated workspace rule in `.agents/rules/file-currency.md`.
  - Added hierarchical workspace rule in `GEMINI.md`.
  - Enforced operational rules in `RULES.md` (Section 5) and `AGENTS.md` (Section 4).

### Planned

- **Phase 4 Registry Client**: Remote package resolution, tarball fetching, and cryptographic SHA-256 verification via `@vibe-skill/infra-core`.
- **Sandboxed Execution Runtime**: Isolated V8/WebWorker runtime for executing pre/post-install lifecycle verification hooks.
- **Additional Canonical Blueprints**:
  - `auth-better-auth`: Modern TypeScript authentication engine integration.
  - `db-prisma-pg`: Prisma ORM client with automated migrations.
  - `ui-shadcn-tailwind`: Shadcn UI primitives and Tailwind CSS v4 scaffolding.

---

## [0.1.0] - 2026-10-28

### Added

- **Monorepo Foundation & Tooling**:
  - Initialized high-performance monorepo using `pnpm` workspaces (v12.15+) and `Turborepo` (v2+).
  - Configured shared strict TypeScript configurations (`@vibe-skill/tsconfig`) with `ES2022` and `NodeNext` targets.
  - Established automated GitHub Actions CI pipeline (`.github/workflows/ci.yml`) for linting, building, and testing.
- **Manifest Specification Standard (`@vibe-skill/manifest`)**:
  - Implemented `SkillManifestSchema` using Zod for runtime `skill.json` validation.
  - Added strict validation for SemVer versions, kebab-case IDs, framework compatibility matrices, environment variable declarations, and discriminated injection unions.
  - Built `formatZodError` providing path-specific validation diagnostics.
  - Created 26 unit tests verifying schema boundaries.
- **Deterministic AST Engine (`@vibe-skill/ast-engine`)**:
  - Built AST transformation engine using `ts-morph` and Prettier.
  - Implemented `import-injector.ts` for clean, duplicate-free import management.
  - Implemented `jsx-wrapper-injector.ts` for idempotent component wrapping (e.g., `<AuthProvider>`).
  - Implemented `export-reexport-injector.ts` for barrel re-exports (`export * from './module'`).
  - Added in-memory rollback snapshots restoring pristine code on any compiler diagnostic failure.
  - Created 12 unit and transform tests.
- **Developer Command-Line Interface (`@vibe-skill/cli`)**:
  - Built standalone executable binary (`vibe-skill`) with `Commander` and `tsup`.
  - Added `vibe-skill init` command for project environment and framework detection.
  - Added `vibe-skill add <skill>` command for atomic AST code injection and template copying.
  - Added `vibe-skill list` command for querying `.vibe-skill/installed.json` lockfiles.
  - Created end-to-end fixture tests against simulated Next.js App Router applications.
- **Model Context Protocol Server (`@vibe-skill/mcp-server`)**:
  - Built MCP-compliant server using `@modelcontextprotocol/sdk` over `stdio` transport.
  - Registered `list_available_skills`, `inspect_skill`, and `install_skill` tools for AI coding agents.
  - Created integration tests verifying agent discovery, inspection, and programmatic installation.
- **Canonical Reference Skills**:
  - `skills/auth-supabase-rbac`: Production-grade Supabase Auth with SSR middleware and Postgres RBAC migrations.
  - `skills/auth-clerk-nextjs`: Clerk authentication integration for Next.js 14 App Router.
  - `skills/db-drizzle-pg`: Drizzle ORM schema and PostgreSQL database client.
- **System Architecture & Operational Governance Documentation**:
  - Created `ARCHITECTURE.md`, `DESIGN.md`, `FLOW.md`, `DECISIONS.md`.
  - Created `AGENTS.md`, `RULES.md`, `MEMORY.md`, and updated `README.md`.
  - Created `SECURITY.md`, `AUDIT.md`, `TESTING.md`, and `CHANGELOG.md`.
